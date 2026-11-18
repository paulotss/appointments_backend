import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ConfirmationExecutionService,
  executionKey,
} from './confirmation-execution.service';
import { ConfirmationExecutionController } from './confirmation-execution.controller';
import { campaignRevision } from './campaign-approval';

const actor = {
  typ: 'service' as const,
  sub: 1,
  jti: 'fixture',
  scopes: ['CONFIRMATION_EXECUTION_READ' as const],
};
const ref = (kind: string, byte = 'ab') =>
  `${kind}:v1:fixture:${byte.repeat(32)}`;
function fixture() {
  const campaign = {
    id: 1,
    campaignDate: new Date('2026-11-05'),
    source: 'SAUDEVIANET',
    status: 'APPROVED',
    approvedAt: new Date('2026-11-04T12:00:00Z'),
    responseDeadlineAt: new Date('2026-11-05T10:00:00Z'),
    approvedByUserId: 1,
    consultationState: 'READY',
    items: [
      {
        id: 10,
        appointmentRef: ref('appt'),
        patientRef: ref('patient'),
        recipientRef: ref('recipient'),
        informedPhoneRef: ref('phone'),
        appointmentTime: '09:00',
        agendaRef: 'fixture-agenda',
        isMinor: false,
        recipientState: 'ELIGIBLE',
        reasonCode: 'contact_ready',
      },
    ],
    events: [{ id: 1, action: 'CAMPAIGN_APPROVED' }],
  };
  const live = {
    connected: true,
    availability: 'ready',
    items: structuredClone(campaign.items),
  };
  const source = { load: jest.fn(async () => structuredClone(live)) };
  const prisma = {
    confirmationCampaign: {
      findUnique: jest.fn(async () => structuredClone(campaign)),
    },
  };
  return {
    campaign,
    live,
    source,
    service: new ConfirmationExecutionService(
      prisma as never,
      { get: () => source } as never,
    ),
  };
}
describe('operational approval contract, transport remains disabled', () => {
  it('has a separate scope and cannot promote simulation/registry/staff access', async () => {
    const { service } = fixture();
    for (const scopes of [['CONFIRMATION_SIMULATE'], ['CLINIC_REGISTRY_READ']])
      await expect(
        service.snapshot({ ...actor, scopes } as never, 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.snapshot({ typ: 'user', role: 'ADMIN' } as never, 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const guard = new RolesGuard(new Reflector());
    const ctx = (user) =>
      ({
        getClass: () => ConfirmationExecutionController,
        getHandler: () => ConfirmationExecutionController.prototype.snapshot,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as never;
    expect(guard.canActivate(ctx(actor))).toBe(true);
    expect(() =>
      guard.canActivate(ctx({ ...actor, scopes: ['CLINIC_REGISTRY_READ'] })),
    ).toThrow(ForbiddenException);
  });
  it('exports only opaque references and a key bound to the approval, with no dispatch permission', async () => {
    const { service } = fixture();
    const snapshot = await service.snapshot(actor, 1);
    expect(snapshot.dispatchEnabled).toBe(false);
    expect(snapshot.mode).toBe('operational');
    expect(snapshot.items[0].executionKey).toBe(
      executionKey(1, snapshot.revision, 10),
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      /fixture-agenda|phoneE164|displayName|patient_id|provider/,
    );
    expect((await service.snapshot(actor, 1)).items[0].executionKey).toBe(
      snapshot.items[0].executionKey,
    );
  });
  it.each(['DRAFT', 'IN_REVIEW'])('blocks unapproved %s', async (status) => {
    const { service, campaign } = fixture();
    campaign.status = status;
    await expect(service.snapshot(actor, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it.each(['PARTIAL', 'FAILED', 'NOT_CONNECTED'])(
    'blocks collection %s',
    async (state) => {
      const { service, campaign } = fixture();
      campaign.consultationState = state;
      await expect(service.snapshot(actor, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );
  it('revalidates independently on every call and blocks changes after the source read', async () => {
    const { service, campaign, source, live } = fixture();
    const revision = campaignRevision(campaign as never);
    expect((await service.check(actor, 1, 10, revision)).ready).toBe(true);
    expect((await service.check(actor, 1, 10, revision)).ready).toBe(true);
    expect(source.load).toHaveBeenCalledTimes(2);
    source.load.mockImplementationOnce(async () => {
      campaign.status = 'IN_REVIEW';
      return structuredClone(live);
    });
    await expect(service.check(actor, 1, 10, revision)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('accepts zero seconds from Python without accepting a changed second', async () => {
    const { service, campaign, live } = fixture();
    const revision = campaignRevision(campaign as never);
    live.items[0].appointmentTime = '09:00:00';
    expect((await service.check(actor, 1, 10, revision)).ready).toBe(true);
    live.items[0].appointmentTime = '09:00:30';
    expect((await service.check(actor, 1, 10, revision)).ready).toBe(false);
  });
  it('rejects stale approval revisions', async () => {
    const { service, campaign } = fixture();
    const revision = campaignRevision(campaign as never);
    campaign.events.push({ id: 2, action: 'CAMPAIGN_REOPENED' });
    await expect(service.check(actor, 1, 10, revision)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('blocks missing authorization, phone/time mismatch, duplicate, absent and unavailable source', async () => {
    for (const change of [
      (live) => (live.items[0].recipientState = 'PENDING'),
      (live) => (live.items[0].informedPhoneRef = ref('phone', 'cd')),
      (live) => (live.items[0].appointmentTime = '10:00'),
      (live) => live.items.push({ ...live.items[0] }),
      (live) =>
        live.items.push({
          ...live.items[0],
          appointmentRef: ref('appt', 'ef'),
        }),
      (live) => (live.items = []),
      (live) => (live.availability = 'failed'),
    ]) {
      const { service, campaign, live } = fixture();
      change(live);
      expect(
        (await service.check(actor, 1, 10, campaignRevision(campaign as never)))
          .ready,
      ).toBe(false);
    }
  });
  it('keeps shared-phone and persisted pending recipients blocked', async () => {
    const { service, campaign } = fixture();
    campaign.items.push({
      ...campaign.items[0],
      id: 11,
      appointmentRef: ref('appt', 'cd'),
    });
    expect(
      (await service.check(actor, 1, 10, campaignRevision(campaign as never)))
        .ready,
    ).toBe(false);
    campaign.items.pop();
    campaign.items[0].recipientState = 'PENDING';
    expect(
      (await service.check(actor, 1, 10, campaignRevision(campaign as never)))
        .ready,
    ).toBe(false);
  });
});

describe('precise fail-closed revalidation diagnostics', () => {
  it.each([
    ['patientRef', 'patient_changed', ref('patient', 'cd')],
    ['recipientRef', 'recipient_changed', ref('recipient', 'cd')],
    ['informedPhoneRef', 'phone_changed', ref('phone', 'cd')],
    ['appointmentTime', 'appointment_time_changed', '10:00'],
    ['agendaRef', 'agenda_changed', 'fixture-other-agenda'],
    ['isMinor', 'minor_status_changed', true],
    ['recipientState', 'recipient_not_eligible', 'PENDING'],
    ['reasonCode', 'contact_not_ready', 'verification_missing'],
  ])(
    'identifies %s without returning either value',
    async (field, reason, value) => {
      const { service, campaign, live } = fixture();
      (live.items[0] as any)[field] = value;
      const result = await service.check(
        actor,
        1,
        10,
        campaignRevision(campaign as never),
      );
      expect(result).toEqual({
        mode: 'operational',
        dispatchEnabled: false,
        ready: false,
        reason,
      });
    },
  );
  it.each([
    'source_timeout',
    'source_http_error',
    'source_invalid_response',
    'source_query_failed',
    'source_not_configured',
  ])('preserves finite source failure %s', async (reason) => {
    const { service, campaign, source } = fixture();
    source.load.mockResolvedValueOnce({
      connected: true,
      availability: 'failed',
      reason,
      items: [],
    } as never);
    expect(
      await service.check(actor, 1, 10, campaignRevision(campaign as never)),
    ).toEqual({
      mode: 'operational',
      dispatchEnabled: false,
      ready: false,
      reason,
    });
  });
  it.each([
    ['partial', 'source_partial'],
    ['empty', 'source_empty'],
  ])('distinguishes %s from changed data', async (availability, reason) => {
    const { service, campaign, live } = fixture();
    live.availability = availability;
    expect(
      await service.check(actor, 1, 10, campaignRevision(campaign as never)),
    ).toMatchObject({ reason });
  });
  it.each(['fixture-private-upstream-message', 'constructor', '__proto__'])(
    'never reflects arbitrary source messages (%s)',
    async (unsafeReason) => {
      const { service, campaign, source } = fixture();
      source.load.mockResolvedValueOnce({
        connected: true,
        availability: 'failed',
        reason: unsafeReason,
        items: [],
      } as never);
      const result = await service.check(
        actor,
        1,
        10,
        campaignRevision(campaign as never),
      );
      expect(result).toMatchObject({ reason: 'source_unavailable' });
      expect(JSON.stringify(result)).not.toContain(
        'fixture-private-upstream-message',
      );
    },
  );
  it('distinguishes a disconnected source and a missing appointment', async () => {
    const { service, campaign, source } = fixture();
    const revision = campaignRevision(campaign as never);
    source.load.mockResolvedValueOnce({ connected: false } as never);
    expect(await service.check(actor, 1, 10, revision)).toMatchObject({
      reason: 'source_disconnected',
    });
    source.load.mockResolvedValueOnce({
      connected: true,
      availability: 'ready',
      items: [],
    } as never);
    expect(await service.check(actor, 1, 10, revision)).toMatchObject({
      reason: 'appointment_missing',
    });
  });
});

describe('authenticated non-identifying read configuration', () => {
  const key = 'SAUDEVIANET_CAMPAIGN_SOURCE_TIMEOUT_MS';
  let prior: string | undefined;
  beforeEach(() => {
    prior = process.env[key];
    delete process.env[key];
  });
  afterEach(() => {
    if (prior === undefined) delete process.env[key];
    else process.env[key] = prior;
  });
  it.each([
    [undefined, 120000],
    ['90000', 90000],
    ['120000', 120000],
  ])('reports effective read budget (%s)', (configured, expected) => {
    if (configured !== undefined) process.env[key] = String(configured);
    const { service, source } = fixture();
    expect(service.readConfiguration(actor)).toEqual({
      dispatchEnabled: false,
      partialConsultationRecoverySupported: true,
      sourceReadTimeoutMs: expected,
      sourceReadTimeoutConfigured: configured !== undefined,
    });
    expect(source.load).not.toHaveBeenCalled();
  });
  it('does not extend the registry or staff capability', () => {
    const { service } = fixture();
    expect(() =>
      service.readConfiguration({
        ...actor,
        scopes: ['CLINIC_REGISTRY_READ'],
      } as never),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.readConfiguration({ typ: 'user', role: 'ADMIN' } as never),
    ).toThrow(ForbiddenException);
  });
});
