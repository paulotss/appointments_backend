import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { isServicePrincipal } from '../auth/interfaces/jwt-payload.interface';
import { STAFF_ROLES } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import {
  approvalInclude,
  campaignRevision,
  type ApprovalCampaign,
} from './campaign-approval';

@Injectable()
export class ConfirmationSendReleaseService {
  constructor(private readonly prisma: PrismaService) {}
  private async staff(actor: AuthPrincipal) {
    if (isServicePrincipal(actor)) throw new ForbiddenException();
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { id: true, role: true },
    });
    if (!user || !STAFF_ROLES.includes(user.role as never))
      throw new ForbiddenException();
    return user;
  }
  private service(actor: AuthPrincipal) {
    if (
      !isServicePrincipal(actor) ||
      !actor.scopes.includes(ServiceTokenScope.CONFIRMATION_EXECUTION_READ)
    )
      throw new ForbiddenException();
  }
  private approved(campaign: ApprovalCampaign) {
    return (
      campaign.status === 'APPROVED' &&
      campaign.consultationState === 'READY' &&
      campaign.approvedAt !== null &&
      campaign.responseDeadlineAt !== null &&
      campaign.responseDeadlineAt.getTime() > Date.now() &&
      campaign.source === 'SAUDEVIANET'
    );
  }
  async state(actor: AuthPrincipal, id: number) {
    await this.staff(actor);
    const campaign = await this.prisma.confirmationCampaign.findUnique({
      where: { id },
      include: approvalInclude,
    });
    if (!campaign) throw new NotFoundException();
    const release = await this.prisma.confirmationSendRelease.findUnique({
      where: { campaignId: id },
    });
    const revision = campaignRevision(campaign);
    return {
      revision,
      eligibleItemIds: this.approved(campaign)
        ? campaign.items
            .filter((i) => i.recipientState === 'ELIGIBLE')
            .map((i) => i.id)
        : [],
      active:
        !!release &&
        !release.paused &&
        release.revision === revision &&
        this.approved(campaign),
      version: release?.version ?? 0,
      itemIds: release?.revision === revision ? release.itemIds : [],
      updatedAt: release?.updatedAt ?? null,
    };
  }
  async change(actor: AuthPrincipal, id: number, body: unknown, pause = false) {
    const user = await this.staff(actor);
    const p = body as { revision: string; version: number; itemIds: number[] };
    const fields = pause
      ? ['revision', 'version']
      : ['itemIds', 'revision', 'version'];
    if (
      !p ||
      typeof p !== 'object' ||
      Array.isArray(p) ||
      Object.keys(p).sort().join() !== fields.sort().join() ||
      typeof p.revision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(p.revision) ||
      !Number.isSafeInteger(p.version) ||
      p.version < 0 ||
      (!pause &&
        (!Array.isArray(p.itemIds) ||
          !p.itemIds.length ||
          p.itemIds.length > 10000 ||
          p.itemIds.some((i) => !Number.isSafeInteger(i) || i <= 0) ||
          new Set(p.itemIds).size !== p.itemIds.length))
    )
      throw new BadRequestException('Seleção inválida. Atualize a campanha.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM confirmation_campaigns WHERE id=${id} FOR UPDATE`;
      const campaign = await tx.confirmationCampaign.findUnique({
        where: { id },
        include: approvalInclude,
      });
      if (!campaign) throw new NotFoundException();
      const current = await tx.confirmationSendRelease.findUnique({
        where: { campaignId: id },
      });
      if (
        (current?.version ?? 0) !== p.version ||
        campaignRevision(campaign) !== p.revision
      )
        throw new ConflictException(
          'A campanha ou a liberação mudou. Atualize antes de continuar.',
        );
      if (pause && !current)
        throw new ConflictException('Nenhum envio foi liberado.');
      if (
        !pause &&
        (!this.approved(campaign) ||
          p.itemIds.some(
            (id) =>
              !campaign.items.some(
                (i) => i.id === id && i.recipientState === 'ELIGIBLE',
              ),
          ))
      )
        throw new ConflictException(
          'A campanha precisa estar aprovada, com prazo vigente e itens aptos.',
        );
      const data = {
        revision: p.revision,
        itemIds: pause
          ? current!.itemIds
          : [...p.itemIds].sort((a, b) => a - b),
        paused: pause,
        version: p.version + 1,
        actorUserId: user.id,
      };
      await tx.confirmationSendRelease.upsert({
        where: { campaignId: id },
        create: { campaignId: id, ...data },
        update: data,
      });
      await tx.confirmationSendReleaseEvent.create({
        data: {
          campaignId: id,
          revision: data.revision,
          itemIds: data.itemIds,
          version: data.version,
          actorUserId: user.id,
          action: pause ? 'PAUSED' : 'RELEASED',
        },
      });
    });
    return this.state(actor, id);
  }
  /** Read-only capability check, repeated immediately before send; never authorizes a clinical write. */
  async permit(
    actor: AuthPrincipal,
    id: number,
    itemId: number,
    revision: string,
  ) {
    this.service(actor);
    if (!/^[a-f0-9]{64}$/.test(revision)) return { ready: false };
    const campaign = await this.prisma.confirmationCampaign.findUnique({
      where: { id },
      include: approvalInclude,
    });
    const release = await this.prisma.confirmationSendRelease.findUnique({
      where: { campaignId: id },
    });
    return {
      ready:
        !!campaign &&
        this.approved(campaign) &&
        campaignRevision(campaign) === revision &&
        !!release &&
        !release.paused &&
        release.revision === revision &&
        release.itemIds.includes(itemId) &&
        campaign.items.some(
          (i) => i.id === itemId && i.recipientState === 'ELIGIBLE',
        ),
    };
  }
  async queue(actor: AuthPrincipal) {
    this.service(actor);
    // Bound work per tick; completed transport reservations remain idempotent in the bridge.
    const releases = await this.prisma.confirmationSendRelease.findMany({
      where: { paused: false },
      orderBy: { campaignId: 'asc' },
    });
    const campaigns: Array<{
      campaignId: number;
      revision: string;
      itemIds: number[];
    }> = [];
    for (const release of releases) {
      const campaign = await this.prisma.confirmationCampaign.findUnique({
        where: { id: release.campaignId },
        include: approvalInclude,
      });
      if (
        campaign &&
        this.approved(campaign) &&
        campaignRevision(campaign) === release.revision
      )
        campaigns.push({
          campaignId: release.campaignId,
          revision: release.revision,
          itemIds: release.itemIds,
        });
    }
    return { campaigns };
  }
}
