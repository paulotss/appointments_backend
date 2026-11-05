import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { isServicePrincipal } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentSourceRegistry } from './appointment-source';
import {
  approvalInclude,
  campaignRevision,
  type ApprovalCampaign,
} from './campaign-approval';

export function executionKey(
  campaignId: number,
  revision: string,
  itemId: number,
) {
  return createHash('sha256')
    .update(`confirmation:operational:v1:${campaignId}:${revision}:${itemId}`)
    .digest('hex');
}

@Injectable()
export class ConfirmationExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: AppointmentSourceRegistry,
  ) {}
  private actor(actor: AuthPrincipal) {
    if (
      !isServicePrincipal(actor) ||
      !actor.scopes.includes(ServiceTokenScope.CONFIRMATION_EXECUTION_READ)
    )
      throw new ForbiddenException(
        'Escopo operacional de leitura obrigatório.',
      );
  }
  private async campaign(id: number) {
    const row = await this.prisma.confirmationCampaign.findUnique({
      where: { id },
      include: approvalInclude,
    });
    if (!row) throw new NotFoundException('Campanha não encontrada.');
    if (
      row.status !== 'APPROVED' ||
      !row.approvedAt ||
      row.consultationState !== 'READY'
    )
      throw new ConflictException('approval_unavailable');
    return row;
  }
  private item(
    campaign: ApprovalCampaign,
    revision: string,
    item: ApprovalCampaign['items'][number],
  ) {
    return {
      itemId: item.id,
      executionKey: executionKey(campaign.id, revision, item.id),
      appointmentRef: item.appointmentRef,
      patientRef: item.patientRef,
      recipientRef: item.recipientRef,
      phoneRef: item.informedPhoneRef,
      appointmentTime: item.appointmentTime,
      recipientState: item.recipientState,
    };
  }
  async snapshot(actor: AuthPrincipal, id: number) {
    this.actor(actor);
    const campaign = await this.campaign(id);
    const revision = campaignRevision(campaign);
    return {
      mode: 'operational' as const,
      dispatchEnabled: false as const,
      campaignId: id,
      revision,
      campaignDate: campaign.campaignDate.toISOString().slice(0, 10),
      source: campaign.source,
      items: campaign.items
        .filter((item) => !item.appointmentRef.startsWith('fail:'))
        .map((item) => this.item(campaign, revision, item)),
    };
  }
  async check(
    actor: AuthPrincipal,
    id: number,
    itemId: number,
    revision: string,
  ) {
    this.actor(actor);
    const campaign = await this.campaign(id);
    if (campaignRevision(campaign) !== revision)
      throw new ConflictException('approval_changed');
    const item = campaign.items.find(
      (item) => item.id === itemId && !item.appointmentRef.startsWith('fail:'),
    );
    if (!item) throw new NotFoundException('Item não encontrado.');
    const refused = {
      mode: 'operational',
      dispatchEnabled: false,
      ready: false,
      reason: 'revalidation_failed',
    };
    if (item.recipientState !== 'ELIGIBLE') return refused;
    if (
      campaign.items.filter(
        (entry) =>
          entry.recipientState === 'ELIGIBLE' &&
          entry.informedPhoneRef === item.informedPhoneRef,
      ).length !== 1
    )
      return { ...refused, reason: 'shared_phone' };
    let loaded;
    try {
      loaded = await this.sources
        .get(campaign.source)
        .load(campaign.campaignDate.toISOString().slice(0, 10));
    } catch {
      return refused;
    }
    const current = await this.campaign(id);
    if (campaignRevision(current) !== revision)
      throw new ConflictException('approval_changed');
    if (!loaded.connected || loaded.availability !== 'ready') return refused;
    if (
      loaded.items.filter(
        (entry) => entry.informedPhoneRef === item.informedPhoneRef,
      ).length !== 1
    )
      return { ...refused, reason: 'shared_phone' };
    const matches = loaded.items.filter(
      (entry) => entry.appointmentRef === item.appointmentRef,
    );
    if (matches.length !== 1) return refused;
    const live = matches[0];
    if (
      live.recipientState !== 'ELIGIBLE' ||
      live.reasonCode !== 'contact_ready' ||
      ![
        'patientRef',
        'recipientRef',
        'informedPhoneRef',
        'appointmentTime',
        'agendaRef',
        'isMinor',
      ].every(
        (key) =>
          live[key as keyof typeof live] === item[key as keyof typeof item],
      )
    )
      return refused;
    return {
      mode: 'operational',
      dispatchEnabled: false,
      ready: true,
      campaignId: id,
      revision,
      campaignDate: campaign.campaignDate.toISOString().slice(0, 10),
      source: campaign.source,
      item: this.item(campaign, revision, item),
    };
  }
}
