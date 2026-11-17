import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfirmationSendReleaseService } from './confirmation-send-release.service';
import { campaignRevision } from './campaign-approval';

function fixture() {
  const campaign = {
    id: 7,
    source: 'SAUDEVIANET',
    status: 'APPROVED',
    consultationState: 'READY',
    approvedAt: new Date(),
    campaignDate: new Date('2099-11-18'),
    responseDeadlineAt: new Date('2099-11-17T15:00:00Z'),
    events: [{ id: 1, action: 'CAMPAIGN_APPROVED' }],
    items: [
      { id: 1, recipientState: 'ELIGIBLE' },
      { id: 2, recipientState: 'PENDING' },
    ],
  };
  let release: any = null;
  const events: any[] = [];
  const db: any = {
    user: {
      findUnique: jest.fn(async () => ({ id: 3, role: 'RECEPTIONIST' })),
    },
    confirmationCampaign: {
      findUnique: jest.fn(async () => structuredClone(campaign)),
    },
    confirmationSendRelease: {
      findUnique: jest.fn(async () => structuredClone(release)),
      findMany: jest.fn(async () =>
        release && !release.paused ? [structuredClone(release)] : [],
      ),
      upsert: jest.fn(async ({ create, update }) => {
        release = {
          ...(release ? { ...release, ...update } : create),
          updatedAt: new Date(),
        };
      }),
    },
    confirmationSendReleaseEvent: {
      create: jest.fn(async ({ data }) => {
        events.push(data);
      }),
    },
    $queryRaw: jest.fn(),
  };
  db.$transaction = async (fn) => fn(db);
  const staff = { typ: 'user', sub: 3 } as any;
  const service = {
    typ: 'service',
    scopes: ['CONFIRMATION_EXECUTION_READ'],
  } as any;
  const sut = new ConfirmationSendReleaseService(db);
  return {
    sut,
    db,
    staff,
    service,
    campaign,
    events,
    body: () => ({
      revision: campaignRevision(campaign as never),
      version: release?.version ?? 0,
      itemIds: [1],
    }),
  };
}

describe('explicit operational send release', () => {
  it('approval alone never queues or permits a send', async () => {
    const f = fixture();
    expect((await f.sut.state(f.staff, 7)).active).toBe(false);
    expect(await f.sut.queue(f.service)).toEqual({ campaigns: [] });
    expect(await f.sut.permit(f.service, 7, 1, f.body().revision)).toEqual({
      ready: false,
    });
  });
  it('freezes exact eligible selection, audits release/pause, and preserves approval revision', async () => {
    const f = fixture();
    const revision = f.body().revision;
    await f.sut.change(f.staff, 7, f.body());
    expect(await f.sut.permit(f.service, 7, 1, revision)).toEqual({
      ready: true,
    });
    expect(await f.sut.permit(f.service, 7, 2, revision)).toEqual({
      ready: false,
    });
    f.campaign.items.push({ id: 3, recipientState: 'ELIGIBLE' });
    expect(await f.sut.permit(f.service, 7, 3, revision)).toEqual({
      ready: false,
    });
    f.campaign.items.pop();
    const { itemIds, ...pause } = f.body();
    await f.sut.change(f.staff, 7, pause, true);
    expect(await f.sut.permit(f.service, 7, 1, revision)).toEqual({
      ready: false,
    });
    expect(await f.sut.queue(f.service)).toEqual({ campaigns: [] });
    expect(f.events.map((e) => e.action)).toEqual(['RELEASED', 'PAUSED']);
    expect(campaignRevision(f.campaign as never)).toBe(revision);
    expect(f.db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('rejects duplicate, empty, ineligible, extra-field and invalid selections', async () => {
    for (const change of [
      { itemIds: [] },
      { itemIds: [1, 1] },
      { itemIds: [2] },
      { itemIds: [99] },
      { itemIds: ['1'] },
      { extra: true },
      { version: -1 },
    ]) {
      const f = fixture();
      await expect(
        f.sut.change(f.staff, 7, { ...f.body(), ...change }),
      ).rejects.toBeInstanceOf(
        change.itemIds?.[0] === 2 || change.itemIds?.[0] === 99
          ? ConflictException
          : BadRequestException,
      );
      expect(f.events).toHaveLength(0);
    }
  });
  it('requires refreshed version after another operator changes a release', async () => {
    const f = fixture();
    const old = f.body();
    await f.sut.change(f.staff, 7, old);
    await expect(f.sut.change(f.staff, 7, old)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(f.events).toHaveLength(1);
  });
  it.each(['reopened', 'expired', 'changed', 'unavailable'])(
    'invalidates %s campaigns',
    async (reason) => {
      const f = fixture();
      await f.sut.change(f.staff, 7, f.body());
      const revision = f.body().revision;
      if (reason === 'reopened') f.campaign.status = 'IN_REVIEW';
      if (reason === 'expired')
        f.campaign.responseDeadlineAt = new Date('2000-01-01');
      if (reason === 'changed')
        f.campaign.events.push({ id: 2, action: 'CAMPAIGN_APPROVED' });
      if (reason === 'unavailable') f.campaign.consultationState = 'PARTIAL';
      expect(await f.sut.permit(f.service, 7, 1, revision)).toEqual({
        ready: false,
      });
      expect(await f.sut.queue(f.service)).toEqual({ campaigns: [] });
    },
  );
  it('read service cannot release, staff cannot consume service queue, wrong scope is denied', async () => {
    const f = fixture();
    await expect(f.sut.change(f.service, 7, f.body())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(f.sut.queue(f.staff)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      f.sut.permit(
        { ...f.service, scopes: ['CLINIC_REGISTRY_READ'] },
        7,
        1,
        f.body().revision,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    f.db.user.findUnique.mockResolvedValue({ id: 3, role: 'PATIENT' });
    await expect(f.sut.change(f.staff, 7, f.body())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
