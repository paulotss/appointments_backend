import { ForbiddenException } from '@nestjs/common';
import {
  ConfirmationExecutionService,
  executionKey,
} from './confirmation-execution.service';

describe('persisted reply authority', () => {
  function fixture() {
    const revision = 'ab'.repeat(32);
    const p = {
      mode: 'operational',
      campaignId: 1,
      itemId: 2,
      revision,
      campaignDate: '2026-11-11',
      responseDeadlineAt: '2026-11-11T10:00:00.000Z',
      source: 'SAUDEVIANET',
      executionKey: executionKey(1, revision, 2),
      appointmentRef: 'appt:v1:fixture:' + 'cd'.repeat(32),
      patientRef: 'patient:v1:fixture:' + 'cd'.repeat(32),
      recipientRef: 'recipient:v1:fixture:' + 'cd'.repeat(32),
      phoneRef: 'phone:v1:fixture:' + 'cd'.repeat(32),
      appointmentTime: '09:00',
      recipientState: 'ELIGIBLE',
      responseEventId: 'ef'.repeat(32),
      responseReceivedAt: '2026-11-10T12:00:00.000Z',
    };
    const event = {
      result: {
        ...p,
        kind: 'reply',
        responseStatus: 'confirmed',
        transportStatus: 'accepted',
        reason: null,
        occurredAt: p.responseReceivedAt,
      },
    };
    const prisma = {
      confirmationResponseEvent: {
        findUnique: jest.fn().mockResolvedValue(event),
      },
      confirmationApprovalSnapshot: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            campaignId: 1,
            snapshot: {
              date: p.campaignDate,
              responseDeadlineAt: p.responseDeadlineAt,
              items: [p],
            },
          }),
      },
    };
    const service = new ConfirmationExecutionService(
      prisma as never,
      {} as never,
    );
    jest.spyOn(service, 'check').mockResolvedValue({ ready: true } as never);
    const actor = {
      typ: 'service',
      scopes: ['CONFIRMATION_EXECUTION_READ'],
    } as never;
    return { p, event, prisma, service, actor };
  }
  it('requires persisted explicit confirmation and immutable links before writing', async () => {
    const f = fixture();
    expect(await f.service.authorizeAppointment(f.actor, f.p)).toEqual({
      ready: true,
    });
    f.event.result.reason = 'sender_mismatch' as never;
    expect(await f.service.authorizeAppointment(f.actor, f.p)).toEqual({
      ready: false,
    });
  });
  it('keeps historical read-only reconciliation available after reopening without authorizing a write', async () => {
    const f = fixture();
    jest
      .spyOn(f.service, 'check')
      .mockRejectedValue(new Error('approval_changed'));
    expect(await f.service.authorizeAppointment(f.actor, f.p)).toEqual({
      ready: false,
    });
    expect(await f.service.authorizeAppointment(f.actor, f.p, true)).toEqual({
      ready: true,
    });
  });
  it('rejects missing evidence, extra fields, mismatched references and wrong service scope', async () => {
    const f = fixture();
    expect(
      await f.service.authorizeAppointment(f.actor, {
        ...f.p,
        phone: 'fixture',
      }),
    ).toEqual({ ready: false });
    expect(
      await f.service.authorizeAppointment(
        f.actor,
        { ...f.p, patientRef: 'changed' },
        true,
      ),
    ).toEqual({ ready: false });
    f.prisma.confirmationResponseEvent.findUnique.mockResolvedValue(null);
    expect(await f.service.authorizeAppointment(f.actor, f.p, true)).toEqual({
      ready: false,
    });
    await expect(
      f.service.authorizeAppointment(
        { typ: 'service', scopes: ['CLINIC_REGISTRY_READ'] } as never,
        f.p,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
