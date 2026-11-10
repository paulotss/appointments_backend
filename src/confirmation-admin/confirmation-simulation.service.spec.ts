import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma, ServiceTokenScope } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ConfirmationSimulationController,
  ConfirmationSimulationHistoryController,
} from './confirmation-simulation.controller';
import {
  ConfirmationSimulationService,
  campaignRevision,
  type SimulationReport,
} from './confirmation-simulation.service';

const actor = {
  typ: 'service' as const,
  sub: 1,
  jti: 'fixture',
  scopes: ['CONFIRMATION_SIMULATE' as const],
};
const ref = (kind: string, byte = 'ab') =>
  `${kind}:v1:fixture:${byte.repeat(32)}`;
const report: SimulationReport = {
  mode: 'simulation',
  dispatchEnabled: false,
  blocked: null,
  items: [{ itemId: 10, result: 'simulated' }],
};
const clone = <T>(value: T): T => structuredClone(value);

function fixture() {
  const campaign = {
    id: 1,
    campaignDate: new Date('2026-11-05T00:00:00Z'),
    source: 'SAUDEVIANET',
    status: 'APPROVED',
    approvedAt: new Date('2026-11-04T12:00:00Z'),
    approvedByUserId: 8,
    consultationState: 'READY',
    events: [{ id: 1, action: 'CAMPAIGN_APPROVED' }],
    items: [
      {
        id: 10,
        campaignId: 1,
        appointmentRef: ref('appt'),
        patientRef: ref('patient'),
        recipientRef: ref('recipient'),
        informedPhoneRef: ref('phone'),
        professionalRef: 'fixture-professional',
        appointmentTime: '09:00',
        agendaRef: 'fixture-agenda',
        sourceResolution: 'candidate',
        isMinor: false,
        recipientState: 'ELIGIBLE',
        reasonCode: 'contact_ready',
      },
    ],
  };
  const runs: Array<Record<string, any>> = [];
  const prisma: Record<string, any> = {
    confirmationCampaign: {
      findUnique: jest.fn(async () => clone(campaign)),
      findUniqueOrThrow: jest.fn(async () => clone(campaign)),
    },
    confirmationSimulation: {
      create: jest.fn(async ({ data }) => {
        if (
          runs.some(
            (run) =>
              run.campaignId === data.campaignId &&
              run.revision === data.revision,
          )
        )
          throw new Prisma.PrismaClientKnownRequestError('fixture duplicate', {
            code: 'P2002',
            clientVersion: 'fixture',
          });
        const run = {
          ...data,
          id: randomUUID(),
          status: 'RUNNING',
          report: null,
          createdAt: new Date(),
          completedAt: null,
        };
        runs.push(run);
        return clone(run);
      }),
      findUnique: jest.fn(async ({ where }) =>
        clone(runs.find((run) => run.id === where.id)),
      ),
      findUniqueOrThrow: jest.fn(async ({ where }) =>
        clone(
          runs.find((run) =>
            where.id
              ? run.id === where.id
              : run.campaignId === where.campaignId_revision.campaignId &&
                run.revision === where.campaignId_revision.revision,
          ),
        ),
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        const run = runs.find(
          (run) =>
            run.id === where.id &&
            run.status === where.status &&
            run.claimHash === where.claimHash &&
            (where.leaseUntil?.lte
              ? run.leaseUntil <= where.leaseUntil.lte
              : run.leaseUntil > where.leaseUntil.gt),
        );
        if (!run) return { count: 0 };
        Object.assign(run, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }) => {
        const run = runs.find((run) => run.id === where.id)!;
        Object.assign(run, clone(data));
        return clone(run);
      }),
      findMany: jest.fn(async () => clone(runs)),
    },
    $queryRaw: jest.fn(async () => []),
  };
  prisma.$transaction = async (fn) => fn(prisma);
  const live = {
    connected: true,
    availability: 'ready',
    items: clone(campaign.items),
  };
  const source = { load: jest.fn(async () => clone(live)) };
  const service = new ConfirmationSimulationService(
    prisma as never,
    { get: () => source } as never,
  );
  return { service, prisma, campaign, runs, live, source };
}

describe('approved campaign simulation contract', () => {
  it('requires a dedicated service scope; registry read and staff are insufficient', async () => {
    const { service } = fixture();
    await expect(
      service.begin({ ...actor, scopes: [ServiceTokenScope.CLINIC_REGISTRY_READ] }, 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.begin({ typ: 'user' } as never, 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['DRAFT', 'IN_REVIEW'])(
    'rejects unapproved status %s',
    async (status) => {
      const { service, campaign } = fixture();
      campaign.status = status;
      await expect(service.begin(actor, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );
  it.each(['PARTIAL', 'FAILED', 'EMPTY', 'NOT_CONNECTED'])(
    'blocks collection %s',
    async (state) => {
      const { service, campaign } = fixture();
      campaign.consultationState = state;
      await expect(service.begin(actor, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );
  it('reserves a single run atomically and excludes administrative identity and raw data', async () => {
    const { service, runs } = fixture();
    const [a, b] = await Promise.all([
      service.begin(actor, 1),
      service.begin(actor, 1),
    ]);
    expect([a.claimed, b.claimed].sort()).toEqual([false, true]);
    expect(runs).toHaveLength(1);
    expect(JSON.stringify(a)).not.toMatch(
      /patientRef|patient_id|displayName|phoneE164|claimHash|serviceTokenId/,
    );
    expect(a.dispatchEnabled).toBe(false);
    expect(a.items[0].appointmentRef).toBe(ref('appt'));
  });
  it('allows lease recovery but rejects an old claimant', async () => {
    const { service, runs } = fixture();
    const first = await service.begin(actor, 1);
    runs[0].leaseUntil = new Date(0);
    const second = await service.begin(actor, 1);
    expect(second.claimed).toBe(true);
    expect(second.runId).toBe(first.runId);
    expect(second.claimToken).not.toBe(first.claimToken);
    await expect(
      service.check(actor, first.runId, 10, first.claimToken!),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('performs a fresh source read for every check and returns no phone', async () => {
    const { service, source } = fixture();
    const run = await service.begin(actor, 1);
    const checked = await service.check(actor, run.runId, 10, run.claimToken!);
    await service.check(actor, run.runId, 10, run.claimToken!);
    expect(source.load).toHaveBeenCalledTimes(2);
    expect(checked).toEqual({
      appointment: 'current',
      appointmentTime: '09:00',
      recipientReady: true,
      recipientRef: ref('recipient'),
    });
  });
  it('blocks recipient/phone mismatch, missing authorization, unavailability and changed time', async () => {
    const { service, live } = fixture();
    const run = await service.begin(actor, 1);
    live.items[0].informedPhoneRef = ref('phone', 'cd');
    expect(
      (await service.check(actor, run.runId, 10, run.claimToken!))
        .recipientReady,
    ).toBe(false);
    live.items[0].recipientState = 'PENDING';
    expect(
      (await service.check(actor, run.runId, 10, run.claimToken!))
        .recipientReady,
    ).toBe(false);
    live.items[0].recipientState = 'UNAVAILABLE';
    expect(
      (await service.check(actor, run.runId, 10, run.claimToken!)).appointment,
    ).toBe('unavailable');
    live.items[0].recipientState = 'ELIGIBLE';
    live.items[0].appointmentTime = '10:00';
    expect(
      (await service.check(actor, run.runId, 10, run.claimToken!)).appointment,
    ).toBe('changed');
  });
  it('does not convert source failure or absent appointments into readiness', async () => {
    const { service, source, live } = fixture();
    const run = await service.begin(actor, 1);
    source.load.mockRejectedValueOnce(new Error('fixture timeout'));
    expect(
      (await service.check(actor, run.runId, 10, run.claimToken!)).appointment,
    ).toBe('unavailable');
    live.items = [];
    expect(
      (await service.check(actor, run.runId, 10, run.claimToken!)).appointment,
    ).toBe('absent');
  });
  it('checks the campaign again after an independent read', async () => {
    const { service, source, campaign, live } = fixture();
    const run = await service.begin(actor, 1);
    source.load.mockImplementationOnce(async () => {
      campaign.status = 'IN_REVIEW';
      return clone(live);
    });
    await expect(
      service.check(actor, run.runId, 10, run.claimToken!),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('persists only simulation results, supports identical replay and refuses changed replay', async () => {
    const { service, prisma } = fixture();
    const run = await service.begin(actor, 1);
    const done = await service.complete(
      actor,
      run.runId,
      run.claimToken!,
      report,
    );
    expect(done.status).toBe('COMPLETED');
    expect(done.dispatchEnabled).toBe(false);
    expect(
      await service.complete(actor, run.runId, run.claimToken!, report),
    ).toEqual(done);
    await expect(
      service.complete(actor, run.runId, run.claimToken!, {
        ...report,
        items: [{ itemId: 10, result: 'held' }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.confirmationSimulation.update).toHaveBeenCalledTimes(1);
    expect((await service.begin(actor, 1)).claimed).toBe(false);
  });
  it('invalidates stale results and distinguishes reopening/reapproval with the same clock', async () => {
    const { service, campaign } = fixture();
    const first = await service.begin(actor, 1);
    const original = campaignRevision(campaign as never);
    campaign.events.push(
      { id: 2, action: 'CAMPAIGN_REOPENED' },
      { id: 3, action: 'CAMPAIGN_APPROVED' },
    );
    expect(campaignRevision(campaign as never)).not.toBe(original);
    expect(
      (await service.complete(actor, first.runId, first.claimToken!, report))
        .status,
    ).toBe('INVALIDATED');
    expect((await service.begin(actor, 1)).runId).not.toBe(first.runId);
  });
  it('rejects forged, incomplete, duplicate, personal or actual-send results', async () => {
    const { service } = fixture();
    const run = await service.begin(actor, 1);
    for (const body of [
      { ...report, mode: 'real' },
      { ...report, dispatchEnabled: true },
      { ...report, phone: '+5511900000000' },
      { ...report, items: [] },
      { ...report, items: [{ itemId: 10, result: 'sent' }] },
      { ...report, items: [...report.items, ...report.items] },
    ]) {
      await expect(
        service.complete(actor, run.runId, run.claimToken!, body),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
  it('never accepts a pending recipient as simulated and identifies expired/current history', async () => {
    const { service, campaign, runs } = fixture();
    campaign.items[0].recipientState = 'PENDING';
    const run = await service.begin(actor, 1);
    await expect(
      service.complete(actor, run.runId, run.claimToken!, report),
    ).rejects.toBeInstanceOf(BadRequestException);
    runs[0].leaseUntil = new Date(0);
    expect((await service.list(1))[0]).toMatchObject({
      currentApproval: true,
      leaseExpired: true,
    });
    campaign.status = 'IN_REVIEW';
    expect((await service.list(1))[0].currentApproval).toBe(false);
  });
  it('requires an active reservation and the correct token for completion', async () => {
    const { service, runs } = fixture();
    const run = await service.begin(actor, 1);
    await expect(
      service.complete(actor, run.runId, 'wrong-claim', report),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.complete(
        { ...actor, sub: 2 },
        run.runId,
        run.claimToken!,
        report,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    runs[0].leaseUntil = new Date(0);
    await expect(
      service.complete(actor, run.runId, run.claimToken!, report),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('simulation route scopes', () => {
  const guard = new RolesGuard(new Reflector());
  function context(controller, handler, user) {
    return {
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as never;
  }
  it('allows the simulation scope, without granting registry tokens or user tokens execution access', () => {
    const controller = ConfirmationSimulationController;
    expect(
      guard.canActivate(context(controller, controller.prototype.begin, actor)),
    ).toBe(true);
    for (const denied of [
      { ...actor, scopes: ['CLINIC_REGISTRY_READ'] },
      { typ: 'user', role: 'ADMIN' },
    ]) {
      expect(() =>
        guard.canActivate(
          context(controller, controller.prototype.begin, denied),
        ),
      ).toThrow(ForbiddenException);
    }
  });
  it('restricts history to administrative staff', () => {
    const controller = ConfirmationSimulationHistoryController;
    expect(
      guard.canActivate(
        context(controller, controller.prototype.list, {
          typ: 'user',
          role: 'RECEPTIONIST',
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(context(controller, controller.prototype.list, actor)),
    ).toThrow(ForbiddenException);
  });
});
