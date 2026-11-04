import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, ServiceTokenScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthPrincipal,
  isServicePrincipal,
} from '../auth/interfaces/jwt-payload.interface';
import {
  AppointmentSourceRegistry,
  type AppointmentSourceLoad,
} from './appointment-source';

const include = { items: true, events: { orderBy: { id: 'asc' as const } } };
type Campaign = Prisma.ConfirmationCampaignGetPayload<{
  include: typeof include;
}>;
type Run = Prisma.ConfirmationSimulationGetPayload<object>;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const lease = () => new Date(Date.now() + 15 * 60 * 1000);
export const SIMULATION_RESULTS = [
  'simulated',
  'rejected',
  'unknown',
  'held',
  'absent',
  'not_pending',
  'recipient_not_authorized',
  'recipient_ambiguous',
  'recipient_shared',
  'appointment_time_changed',
  'appointment_status_changed',
  'appointment_ambiguous',
] as const;
const BLOCKS = [
  'campaign_missing',
  'campaign_incomplete',
  'weekend',
  'holiday',
  'before_hours',
  'after_hours',
  'campaign_weekend',
  'campaign_holiday',
  'campaign_stale',
  'campaign_too_far',
];
export type SimulationReport = {
  mode: 'simulation';
  dispatchEnabled: false;
  blocked: string | null;
  items: Array<{ itemId: number; result: (typeof SIMULATION_RESULTS)[number] }>;
};

export function campaignRevision(campaign: Campaign): string {
  return hash(
    JSON.stringify({
      id: campaign.id,
      date: campaign.campaignDate,
      source: campaign.source,
      status: campaign.status,
      approvedAt: campaign.approvedAt,
      approvedBy: campaign.approvedByUserId,
      consultation: campaign.consultationState,
      // Lifecycle event IDs distinguish reopening/reapproval even under an identical clock.
      events: campaign.events.map((event) => [event.id, event.action]),
      items: [...campaign.items]
        .sort((a, b) => a.id - b.id)
        .map((item) => [
          item.id,
          item.appointmentRef,
          item.patientRef,
          item.recipientRef,
          item.informedPhoneRef,
          item.professionalRef,
          item.appointmentTime,
          item.agendaRef,
          item.sourceResolution,
          item.isMinor,
          item.recipientState,
          item.reasonCode,
        ]),
    }),
  );
}

@Injectable()
export class ConfirmationSimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: AppointmentSourceRegistry,
  ) {}

  private actor(principal: AuthPrincipal) {
    if (
      !isServicePrincipal(principal) ||
      !principal.scopes.includes(ServiceTokenScope.CONFIRMATION_SIMULATE)
    ) {
      throw new ForbiddenException(
        'Escopo exclusivo de simulação obrigatório.',
      );
    }
    return principal;
  }

  private async campaign(id: number) {
    const campaign = await this.prisma.confirmationCampaign.findUnique({
      where: { id },
      include,
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }

  private approved(campaign: Campaign) {
    if (campaign.status !== 'APPROVED' || campaign.approvedAt === null)
      throw new ConflictException('campaign_not_approved');
    if (campaign.consultationState !== 'READY')
      throw new ConflictException('campaign_incomplete');
  }

  async begin(principal: AuthPrincipal, campaignId: number) {
    const actor = this.actor(principal);
    const campaign = await this.campaign(campaignId);
    this.approved(campaign);
    const revision = campaignRevision(campaign);
    const claimToken = randomUUID();
    let claimed = false;
    let run: Run;
    try {
      run = await this.prisma.confirmationSimulation.create({
        data: {
          campaignId,
          revision,
          claimHash: hash(claimToken),
          leaseUntil: lease(),
          serviceTokenId: actor.sub,
        },
      });
      claimed = true;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      run = await this.prisma.confirmationSimulation.findUniqueOrThrow({
        where: { campaignId_revision: { campaignId, revision } },
      });
      if (
        run.serviceTokenId === actor.sub &&
        run.status === 'RUNNING' &&
        run.leaseUntil <= new Date()
      ) {
        const updated = await this.prisma.confirmationSimulation.updateMany({
          where: {
            id: run.id,
            status: 'RUNNING',
            claimHash: run.claimHash,
            leaseUntil: { lte: new Date() },
          },
          data: { claimHash: hash(claimToken), leaseUntil: lease() },
        });
        claimed = updated.count === 1;
      }
    }
    return {
      ...this.present(run),
      claimed,
      ...(claimed ? { claimToken } : {}),
      campaignDate: campaign.campaignDate.toISOString().slice(0, 10),
      source: campaign.source,
      items: campaign.items
        .filter((item) => !item.appointmentRef.startsWith('fail:'))
        .map((item) => ({
          itemId: item.id,
          appointmentRef: item.appointmentRef,
          recipientRef: item.recipientRef,
          phoneRef: item.informedPhoneRef,
          appointmentTime: item.appointmentTime,
          recipientState: item.recipientState,
        })),
    };
  }

  private async claim(
    principal: AuthPrincipal,
    id: string,
    claimToken: string,
  ) {
    const actor = this.actor(principal);
    const run = await this.prisma.confirmationSimulation.findUnique({
      where: { id },
    });
    if (!run) throw new NotFoundException('Simulação não encontrada.');
    if (
      typeof claimToken !== 'string' ||
      run.claimHash !== hash(claimToken) ||
      run.serviceTokenId !== actor.sub
    )
      throw new ForbiddenException('Reserva de simulação inválida.');
    return run;
  }

  async check(
    principal: AuthPrincipal,
    id: string,
    itemId: number,
    claimToken: string,
  ) {
    const run = await this.claim(principal, id, claimToken);
    if (run.status !== 'RUNNING' || run.leaseUntil <= new Date())
      throw new ConflictException('simulation_not_running');
    const campaign = await this.campaign(run.campaignId);
    this.approved(campaign);
    if (campaignRevision(campaign) !== run.revision)
      throw new ConflictException('campaign_changed');
    const item = campaign.items.find(
      (entry) =>
        entry.id === itemId && !entry.appointmentRef.startsWith('fail:'),
    );
    if (!item) throw new NotFoundException('Item não encontrado.');
    // A fresh source load performs independent agenda and registry validation.
    let live: AppointmentSourceLoad;
    try {
      live = await this.sources
        .get(campaign.source)
        .load(campaign.campaignDate.toISOString().slice(0, 10));
    } catch {
      live = { connected: false };
    }
    const fresh = await this.campaign(run.campaignId);
    if (fresh.status !== 'APPROVED' || campaignRevision(fresh) !== run.revision)
      throw new ConflictException('campaign_changed');
    const renewed = await this.prisma.confirmationSimulation.updateMany({
      where: {
        id,
        status: 'RUNNING',
        claimHash: run.claimHash,
        leaseUntil: { gt: new Date() },
      },
      data: { leaseUntil: lease() },
    });
    if (!renewed.count) throw new ConflictException('simulation_lease_expired');
    const unavailable = {
      appointment: 'unavailable',
      recipientReady: false,
      appointmentTime: null,
      recipientRef: null,
    };
    if (!live.connected || live.availability !== 'ready') return unavailable;
    const matches = live.items.filter(
      (entry) => entry.appointmentRef === item.appointmentRef,
    );
    if (!matches.length) return { ...unavailable, appointment: 'absent' };
    if (matches.length !== 1)
      return { ...unavailable, appointment: 'ambiguous' };
    const current = matches[0];
    if (
      current.recipientState === 'UNAVAILABLE' ||
      item.recipientState === 'UNAVAILABLE'
    )
      return unavailable;
    const same = [
      'patientRef',
      'recipientRef',
      'informedPhoneRef',
      'agendaRef',
      'isMinor',
    ].every(
      (key) =>
        current[key as keyof typeof current] === item[key as keyof typeof item],
    );
    return {
      appointment:
        current.appointmentTime === item.appointmentTime
          ? 'current'
          : 'changed',
      appointmentTime: current.appointmentTime ?? null,
      recipientReady:
        same &&
        item.recipientState === 'ELIGIBLE' &&
        current.recipientState === 'ELIGIBLE' &&
        current.reasonCode === 'contact_ready',
      recipientRef: same ? item.recipientRef : null,
    };
  }

  async complete(
    principal: AuthPrincipal,
    id: string,
    claimToken: string,
    body: unknown,
  ) {
    const run = await this.claim(principal, id, claimToken);
    const report = parseReport(body);
    return this.prisma.$transaction(async (tx) => {
      // Serialize completion with administrative campaign updates and lease reclamation.
      await tx.$queryRaw`SELECT id FROM confirmation_campaigns WHERE id = ${run.campaignId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM confirmation_simulations WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.confirmationSimulation.findUniqueOrThrow({
        where: { id },
      });
      if (current.claimHash !== run.claimHash)
        throw new ConflictException('simulation_claim_changed');
      if (current.status !== 'RUNNING') {
        if (
          JSON.stringify(parseReport(current.report)) !== JSON.stringify(report)
        )
          throw new ConflictException('simulation_already_finished');
        return this.present(current);
      }
      if (current.leaseUntil <= new Date())
        throw new ConflictException('simulation_lease_expired');
      const campaign = await tx.confirmationCampaign.findUniqueOrThrow({
        where: { id: run.campaignId },
        include,
      });
      const valid =
        campaign.status === 'APPROVED' &&
        campaignRevision(campaign) === run.revision;
      const expected = campaign.items
        .filter((item) => !item.appointmentRef.startsWith('fail:'))
        .map((item) => item.id)
        .sort((a, b) => a - b);
      const actual = report.items
        .map((item) => item.itemId)
        .sort((a, b) => a - b);
      if (
        valid &&
        ((report.blocked === null &&
          JSON.stringify(actual) !== JSON.stringify(expected)) ||
          (report.blocked !== null && actual.length !== 0))
      )
        throw new BadRequestException('Itens divergentes da simulação.');
      if (
        valid &&
        report.items.some(
          (entry) =>
            entry.result === 'simulated' &&
            campaign.items.find((item) => item.id === entry.itemId)
              ?.recipientState !== 'ELIGIBLE',
        )
      )
        throw new BadRequestException(
          'Destinatário pendente não pode constar como simulado.',
        );
      const saved = await tx.confirmationSimulation.update({
        where: { id },
        data: {
          status: valid ? 'COMPLETED' : 'INVALIDATED',
          report: report as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return this.present(saved);
    });
  }

  async list(campaignId: number) {
    const campaign = await this.campaign(campaignId);
    const rows = await this.prisma.confirmationSimulation.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...this.present(row),
      currentApproval:
        campaign.status === 'APPROVED' &&
        row.revision === campaignRevision(campaign),
      leaseExpired: row.status === 'RUNNING' && row.leaseUntil <= new Date(),
    }));
  }

  private present(run: Run) {
    return {
      mode: 'simulation' as const,
      dispatchEnabled: false as const,
      runId: run.id,
      campaignId: run.campaignId,
      revision: run.revision,
      status: run.status,
      report: run.report,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    };
  }
}

function parseReport(value: unknown): SimulationReport {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Relatório inválido.');
  const report = value as SimulationReport;
  if (
    Object.keys(report).sort().join(',') !==
      'blocked,dispatchEnabled,items,mode' ||
    report.mode !== 'simulation' ||
    report.dispatchEnabled !== false ||
    (report.blocked !== null && !BLOCKS.includes(report.blocked)) ||
    !Array.isArray(report.items) ||
    report.items.length > 10000
  )
    throw new BadRequestException('Relatório inválido.');
  const seen = new Set<number>();
  for (const item of report.items) {
    if (
      !item ||
      Object.keys(item).sort().join(',') !== 'itemId,result' ||
      !Number.isInteger(item.itemId) ||
      item.itemId <= 0 ||
      seen.has(item.itemId) ||
      !SIMULATION_RESULTS.includes(item.result)
    )
      throw new BadRequestException('Resultado inválido.');
    seen.add(item.itemId);
  }
  return {
    mode: 'simulation',
    dispatchEnabled: false,
    blocked: report.blocked,
    items: [...report.items].sort((a, b) => a.itemId - b.itemId),
  };
}
