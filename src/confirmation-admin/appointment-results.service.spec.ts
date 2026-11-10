import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import {
  ConfirmationResultsService,
  validateResult,
} from './confirmation-results.service';
import { executionKey } from './confirmation-execution.service';

const result = () => ({
  eventId: 'ab'.repeat(32),
  executionKey: executionKey(1, 'cd'.repeat(32), 2),
  campaignId: 1,
  itemId: 2,
  revision: 'cd'.repeat(32),
  appointmentRef: `appt:v1:fixture:${'ef'.repeat(32)}`,
  sequence: 2,
  accountId: 1,
  inboxId: 2,
  conversationId: 3,
  transportStatus: 'accepted',
  deliveryStatus: 'read',
  responseStatus: 'confirmed',
  reason: null,
  responseDeadlineAt: '2026-11-11T10:00:00.000Z',
  occurredAt: '2026-11-10T12:00:00.000Z',
  kind: 'appointment',
  appointmentStatus: 'confirmed',
});
function fixture(
  current: Record<string, unknown> | null = {
    responseStatus: 'confirmed',
    appointmentStatus: 'not_requested',
  },
) {
  const p = result();
  const tx = {
    $executeRaw: jest.fn(),
    confirmationResponseEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    confirmationApprovalSnapshot: {
      findUnique: jest.fn().mockResolvedValue({
        campaignId: 1,
        snapshot: {
          responseDeadlineAt: p.responseDeadlineAt,
          items: [
            {
              itemId: 2,
              appointmentRef: p.appointmentRef,
              appointmentTime: '09:00',
            },
          ],
        },
      }),
    },
    confirmationResponse: {
      findUnique: jest.fn().mockResolvedValue(
        current && {
          sequence: 1,
          accountId: 1,
          inboxId: 2,
          conversationId: 3,
          transportStatus: 'accepted',
          deliveryStatus: 'read',
          ...current,
        },
      ),
      upsert: jest.fn(),
    },
    confirmationResponsePending: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new ConfirmationResultsService({
    $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
  } as never);
  const actor = {
    typ: 'service',
    scopes: [ServiceTokenScope.CONFIRMATION_RESULTS_WRITE],
  } as never;
  return { service, tx, actor, p };
}
describe('legacy confirmation results', () => {
  it('accepts an explicit observed reconciliation only for an indeterminate result', async () => {
    const f = fixture({
      responseStatus: 'confirmed',
      appointmentStatus: 'indeterminate',
    });
    await f.service.ingest(f.actor, {
      ...f.p,
      kind: 'appointment_reconciliation',
    });
    expect(f.tx.confirmationResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ appointmentStatus: 'confirmed' }),
      }),
    );
    const other = fixture({
      responseStatus: 'confirmed',
      appointmentStatus: 'blocked',
    });
    await expect(
      other.service.ingest(other.actor, {
        ...other.p,
        kind: 'appointment_reconciliation',
      }),
    ).rejects.toThrow(ConflictException);
    expect(() =>
      validateResult({
        ...f.p,
        kind: 'appointment_reconciliation',
        appointmentStatus: 'indeterminate',
        reason: 'appointment_indeterminate',
      }),
    ).toThrow(BadRequestException);
  });
  it.each([
    'confirmed',
    'already_confirmed',
    'blocked',
    'refused',
    'indeterminate',
  ])('validates separate outcome %s', (appointmentStatus) => {
    const p = {
      ...result(),
      appointmentStatus,
      reason: ['confirmed', 'already_confirmed'].includes(appointmentStatus)
        ? null
        : `appointment_${appointmentStatus}`,
    };
    expect(validateResult(p)).toEqual(p);
  });
  it('rejects a claimed success with a pending reason, unsupported outcomes and unrecognized fields', () => {
    for (const change of [
      { reason: 'appointment_indeterminate' },
      { appointmentStatus: 'sent' },
      { phone: 'fixture' },
      { responseStatus: 'waiting' },
      { kind: 'reply' },
    ])
      expect(() => validateResult({ ...result(), ...change })).toThrow(
        BadRequestException,
      );
  });
  it('preserves compatibility for historical reply events', () => {
    const { appointmentStatus, ...p } = result();
    expect(validateResult({ ...p, kind: 'reply' })).toEqual({
      ...p,
      kind: 'reply',
    });
  });
  it('persists confirmation separately from the patient reply', async () => {
    const f = fixture();
    await f.service.ingest(f.actor, f.p);
    expect(f.tx.confirmationResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          appointmentStatus: 'confirmed',
          responseStatus: 'confirmed',
        }),
      }),
    );
    expect(f.tx.confirmationResponsePending.create).not.toHaveBeenCalled();
  });
  it('requires an earlier validated response', async () => {
    for (const current of [
      null,
      { responseStatus: 'waiting', appointmentStatus: 'not_requested' },
    ]) {
      const f = fixture(current);
      if (!current) f.p.sequence = 1;
      await expect(f.service.ingest(f.actor, f.p)).rejects.toThrow(
        ConflictException,
      );
    }
  });
  it('does not silently replace an indeterminate legacy outcome', async () => {
    const f = fixture({
      responseStatus: 'confirmed',
      appointmentStatus: 'indeterminate',
    });
    await expect(f.service.ingest(f.actor, f.p)).rejects.toThrow(
      ConflictException,
    );
  });
  it('creates an internal pending item for an indeterminate write', async () => {
    const f = fixture();
    await f.service.ingest(f.actor, {
      ...f.p,
      appointmentStatus: 'indeterminate',
      reason: 'appointment_indeterminate',
    });
    expect(f.tx.confirmationResponsePending.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'appointment_indeterminate' }),
      }),
    );
  });
  it('does not reset the legacy status on a subsequent delivery event', async () => {
    const f = fixture({
      responseStatus: 'confirmed',
      appointmentStatus: 'confirmed',
    });
    const { appointmentStatus, ...p } = f.p;
    await f.service.ingest(f.actor, { ...p, kind: 'delivery' });
    expect(
      f.tx.confirmationResponse.upsert.mock.calls[0][0].update,
    ).not.toHaveProperty('appointmentStatus');
  });
});
