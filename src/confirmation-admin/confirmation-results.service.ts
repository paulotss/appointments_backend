import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceTokenScope } from '@prisma/client';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { isServicePrincipal } from '../auth/interfaces/jwt-payload.interface';
import { STAFF_ROLES } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import { executionKey } from './confirmation-execution.service';

export const RESPONSE_REASONS = [
  'interpretation_required',
  'change_requested',
  'ambiguous_context',
  'sender_mismatch',
  'late_response',
  'approval_changed',
  'revalidation_failed',
  'human_attendance',
  'conflicting_response',
  'no_response',
  'transport_unknown',
  'transport_blocked',
  'transport_rejected',
  'delivery_failed',
  'channel_unavailable',
] as const;
export const RESOLUTIONS = [
  'CONTACT_HANDLED',
  'CHANGE_REVIEWED',
  'NO_ACTION_REQUIRED',
  'TECHNICAL_REVIEWED',
] as const;
export type ResponseResult = {
  eventId: string;
  executionKey: string;
  campaignId: number;
  itemId: number;
  revision: string;
  appointmentRef: string;
  sequence: number;
  accountId: number;
  inboxId: number;
  conversationId: number | null;
  transportStatus: string;
  deliveryStatus: string | null;
  responseStatus: string;
  reason: string | null;
  responseDeadlineAt: string;
  occurredAt: string;
  kind: string;
};
const keys = [
  'eventId',
  'executionKey',
  'campaignId',
  'itemId',
  'revision',
  'appointmentRef',
  'sequence',
  'accountId',
  'inboxId',
  'conversationId',
  'transportStatus',
  'deliveryStatus',
  'responseStatus',
  'reason',
  'responseDeadlineAt',
  'occurredAt',
  'kind',
];
function stable(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, JSON.parse(stable(v))]),
      ),
    );
  return JSON.stringify(value);
}
export function validateResult(body: unknown): ResponseResult {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).sort().join() !== [...keys].sort().join()
  )
    throw new BadRequestException('Resultado inválido.');
  const p = body as ResponseResult;
  if (
    ![p.eventId, p.executionKey, p.revision].every(
      (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v),
    ) ||
    ![p.campaignId, p.itemId, p.sequence, p.accountId, p.inboxId].every(
      (v) => Number.isSafeInteger(v) && v > 0,
    ) ||
    (p.conversationId !== null &&
      (!Number.isSafeInteger(p.conversationId) || p.conversationId <= 0)) ||
    !/^appt:v1:[a-z][a-z0-9_-]{0,31}:[a-f0-9]{64}$/.test(p.appointmentRef) ||
    ![
      'reserved',
      'contact_creating',
      'conversation_creating',
      'message_sending',
      'accepted',
      'rejected',
      'delivery_unknown',
      'blocked',
    ].includes(p.transportStatus) ||
    (p.deliveryStatus !== null &&
      !['delivered', 'read', 'failed'].includes(p.deliveryStatus)) ||
    ![
      'waiting',
      'confirmed',
      'change_requested',
      'needs_review',
      'expired',
      'human',
    ].includes(p.responseStatus) ||
    (p.reason !== null && !RESPONSE_REASONS.includes(p.reason as never)) ||
    !['transport', 'reply', 'delivery', 'expiration'].includes(p.kind) ||
    ![p.responseDeadlineAt, p.occurredAt].every(
      (v) =>
        typeof v === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) &&
        Number.isFinite(Date.parse(v)),
    ) ||
    p.executionKey !== executionKey(p.campaignId, p.revision, p.itemId)
  )
    throw new BadRequestException('Resultado inválido.');
  return p;
}
@Injectable()
export class ConfirmationResultsService {
  constructor(private readonly prisma: PrismaService) {}
  async ingest(actor: AuthPrincipal, body: unknown) {
    if (
      !isServicePrincipal(actor) ||
      !actor.scopes.includes(ServiceTokenScope.CONFIRMATION_RESULTS_WRITE)
    )
      throw new ForbiddenException();
    const p = validateResult(body);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${p.campaignId}::bigint)`;
      const previous = await tx.confirmationResponseEvent.findUnique({
        where: { eventId: p.eventId },
      });
      if (previous) {
        if (stable(previous.result) !== stable(p))
          throw new ConflictException('Evento incompatível.');
        return { received: true, duplicate: true };
      }
      const approval = await tx.confirmationApprovalSnapshot.findUnique({
        where: { revision: p.revision },
      });
      const snapshot = approval?.snapshot as
        | {
            responseDeadlineAt?: string;
            items?: Array<{
              itemId: number;
              appointmentRef: string;
              appointmentTime: string;
            }>;
          }
        | undefined;
      const item = snapshot?.items?.find(
        (item) =>
          item.itemId === p.itemId && item.appointmentRef === p.appointmentRef,
      );
      if (
        !approval ||
        approval.campaignId !== p.campaignId ||
        !item ||
        snapshot?.responseDeadlineAt !== p.responseDeadlineAt
      )
        throw new ConflictException('Vínculo da aprovação inválido.');
      const current = await tx.confirmationResponse.findUnique({
        where: { executionKey: p.executionKey },
      });
      if (p.sequence !== (current?.sequence ?? 0) + 1)
        throw new ConflictException('Sequência de resultado inválida.');
      if (
        current &&
        (current.accountId !== p.accountId ||
          current.inboxId !== p.inboxId ||
          (current.conversationId !== null &&
            current.conversationId !== p.conversationId))
      )
        throw new ConflictException('Canal incompatível.');
      const rank = { failed: 1, delivered: 2, read: 3 };
      if (
        current?.deliveryStatus &&
        (rank[p.deliveryStatus as keyof typeof rank] ?? 0) <
          (rank[current.deliveryStatus as keyof typeof rank] ?? 0)
      )
        throw new ConflictException('Entrega não pode regredir.');
      if (
        current?.transportStatus === 'accepted' &&
        p.transportStatus !== 'accepted'
      )
        throw new ConflictException('Transporte não pode regredir.');
      const data = {
        campaignId: p.campaignId,
        itemId: p.itemId,
        revision: p.revision,
        appointmentRef: p.appointmentRef,
        appointmentTime: item.appointmentTime,
        responseDeadlineAt: new Date(p.responseDeadlineAt),
        accountId: p.accountId,
        inboxId: p.inboxId,
        conversationId: p.conversationId,
        transportStatus: p.transportStatus,
        deliveryStatus: p.deliveryStatus,
        responseStatus: p.responseStatus,
        sequence: p.sequence,
        updatedAt: new Date(p.occurredAt),
      };
      await tx.confirmationResponse.upsert({
        where: { executionKey: p.executionKey },
        create: { executionKey: p.executionKey, ...data },
        update: data,
      });
      await tx.confirmationResponseEvent.create({
        data: {
          eventId: p.eventId,
          executionKey: p.executionKey,
          sequence: p.sequence,
          result: p as unknown as Prisma.InputJsonValue,
        },
      });
      if (p.reason) {
        const open = await tx.confirmationResponsePending.findFirst({
          where: {
            executionKey: p.executionKey,
            reason: p.reason,
            status: { in: ['OPEN', 'ASSIGNED'] },
          },
        });
        if (open)
          await tx.confirmationResponsePending.update({
            where: { id: open.id },
            data: { version: { increment: 1 } },
          });
        if (!open)
          await tx.confirmationResponsePending.create({
            data: {
              campaignId: p.campaignId,
              executionKey: p.executionKey,
              reason: p.reason,
            },
          });
      }
      return { received: true, duplicate: false };
    });
  }
  private async staff(actor: AuthPrincipal) {
    if (isServicePrincipal(actor)) throw new ForbiddenException();
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { id: true, role: true, name: true },
    });
    if (!user || !STAFF_ROLES.includes(user.role as never))
      throw new ForbiddenException();
    return user;
  }
  async list(actor: AuthPrincipal, campaignId: number) {
    await this.staff(actor);
    const [responses, pending] = await Promise.all([
      this.prisma.confirmationResponse.findMany({
        where: { campaignId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.confirmationResponsePending.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const events = await this.prisma.confirmationResponseEvent.findMany({
      where: { executionKey: { in: responses.map((r) => r.executionKey) } },
      orderBy: { sequence: 'asc' },
    });
    const actions = await this.prisma.confirmationResponseAction.findMany({
      where: { pendingId: { in: pending.map((p) => p.id) } },
      orderBy: { id: 'asc' },
    });
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: [
            ...new Set([
              ...actions.map((a) => a.actorUserId),
              ...pending.flatMap((p) =>
                p.assignedUserId ? [p.assignedUserId] : [],
              ),
            ]),
          ],
        },
      },
      select: { id: true, name: true },
    });
    const base = process.env.CONFIRMATION_CHATWOOT_UI_URL;
    let origin: string | null = null;
    if (base) {
      try {
        const url = new URL(base);
        if (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/'
        )
          origin = url.origin;
      } catch {}
    }
    return {
      dispatchEnabled: false,
      responses: responses.map((r) => ({
        ...r,
        conversationUrl:
          origin && r.conversationId
            ? `${origin}/app/accounts/${r.accountId}/conversations/${r.conversationId}`
            : null,
      })),
      pending,
      events,
      actions,
      users,
    };
  }
  async act(
    actor: AuthPrincipal,
    campaignId: number,
    id: string,
    body: unknown,
    action: 'ASSIGN' | 'COMPLETE',
  ) {
    const user = await this.staff(actor);
    const value = body as { version: number; resolution?: string };
    const expected =
      action === 'ASSIGN' ? ['version'] : ['version', 'resolution'];
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).sort().join() !== expected.sort().join() ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0 ||
      (action === 'COMPLETE' &&
        !RESOLUTIONS.includes(value.resolution as never))
    )
      throw new BadRequestException('Ação inválida.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${campaignId}::bigint)`;
      const current = await tx.confirmationResponsePending.findUnique({
        where: { id },
      });
      if (!current || current.campaignId !== campaignId)
        throw new NotFoundException();
      if (
        current.status === 'COMPLETED' ||
        (action === 'ASSIGN' && current.status !== 'OPEN') ||
        (action === 'COMPLETE' &&
          (current.status !== 'ASSIGNED' || current.assignedUserId !== user.id))
      )
        throw new ConflictException('Atualize a pendência antes de agir.');
      const changed = await tx.confirmationResponsePending.updateMany({
        where: { id, version: value.version, status: current.status },
        data: {
          version: { increment: 1 },
          status: action === 'ASSIGN' ? 'ASSIGNED' : 'COMPLETED',
          assignedUserId: user.id,
          ...(action === 'COMPLETE' ? { resolution: value.resolution } : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'A pendência foi atualizada por outra pessoa.',
        );
      await tx.confirmationResponseAction.create({
        data: {
          pendingId: id,
          actorUserId: user.id,
          action,
          resolution: action === 'COMPLETE' ? value.resolution : null,
        },
      });
      return { updated: true };
    });
  }
}
