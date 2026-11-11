import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CampaignAdminStatus,
  CampaignConsultationState,
  CampaignRecipientState,
  CampaignSourceKey,
  ConfirmationAuditAction,
  ContactAuthorization,
  ContactSubjectRole,
  ContactVerification,
  ContactVerificationStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import {
  AuthPrincipal,
  isServicePrincipal,
} from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  AppointmentSourceLoad,
  AppointmentSourceRegistry,
  CAMPAIGN_IDENTITY,
  CampaignContactClassifier,
  defaultAppointmentSources,
  httpCampaignIdentityClient,
  mapCampaignIdentity,
  mapPatientSearch,
} from './appointment-source';
import type { CampaignIdentityClient } from './appointment-source';
import {
  AssociateSubjectDto,
  CreateCampaignDto,
  InformVerificationDto,
  RecordAuthorizationDto,
  ReplaceCampaignItemsDto,
  VerifyVerificationDto,
} from './dto/confirmation-admin.dto';
import {
  APPOINTMENT_CONTACT_PURPOSE,
  UNATTACHED_EVIDENCE,
  WHATSAPP_CHANNEL,
  assertAppointmentRef,
  assertCampaignDate,
  assertInstant,
  assertOpaque,
  assertOptionalOpaque,
  assertOptionalPhoneRef,
  assertPatientRef,
  assertPhoneRef,
  assertRecipientRef,
  associationRecordId,
  authorizationRecordId,
  campaignDateValue,
  formatInstant,
  ownershipRecordId,
} from './refs';

import { campaignRevision } from './campaign-approval';
import { assertResponseDeadline, isUtcInstant } from './response-deadline';

const STAFF_ROLES = new Set<UserRole>([UserRole.RECEPTIONIST, UserRole.ADMIN]);

const actorSelect = { id: true, name: true } as const;

const verificationInclude = {
  recordedBy: { select: actorSelect },
  verifiedBy: { select: actorSelect },
  revokedBy: { select: actorSelect },
} as const;

const authorizationInclude = {
  recordedBy: { select: actorSelect },
  revokedBy: { select: actorSelect },
} as const;

const campaignInclude = {
  createdBy: { select: actorSelect },
  approvedBy: { select: actorSelect },
  items: { orderBy: { id: 'asc' as const } },
  events: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    include: { actor: { select: actorSelect } },
  },
} satisfies Prisma.ConfirmationCampaignInclude;

type StaffActor = { id: number; role: UserRole; name: string };

type ItemDraft = {
  appointmentRef: string;
  patientRef?: string | null;
  recipientRef?: string | null;
  informedPhoneRef?: string | null;
  recipientState: CampaignRecipientState;
  reasonCode?: string | null;
  professionalRef?: string | null;
  appointmentTime?: string | null;
  agendaRef?: string | null;
  sourceResolution?: string | null;
  isMinor?: boolean | null;
};

@Injectable()
export class ConfirmationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly sources: AppointmentSourceRegistry = defaultAppointmentSources(),
    @Optional()
    private readonly clock: () => Date = () => new Date(),
    @Optional()
    private readonly classifier?: CampaignContactClassifier,
    @Optional()
    @Inject(CAMPAIGN_IDENTITY)
    private readonly identity: CampaignIdentityClient = httpCampaignIdentityClient(),
  ) {}

  async informVerification(
    principal: AuthPrincipal,
    dto: InformVerificationDto,
  ) {
    const actor = await this.requireStaff(principal);
    const patientRef = assertPatientRef(dto.patientRef);
    const recipientRef = assertRecipientRef(dto.recipientRef);
    const informedPhoneRef = assertPhoneRef(dto.informedPhoneRef);
    const evidenceRef = assertOptionalOpaque(dto.evidenceRef, 'Evidência');
    const existing = await this.prisma.contactVerification.findFirst({
      where: {
        patientRef,
        recipientRef,
        informedPhoneRef,
        role: dto.role,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe registro ativo para esta referência. Um número diferente exige outro registro.',
      );
    }
    const created = await this.prisma.contactVerification.create({
      data: {
        id: ownershipRecordId(),
        patientRef,
        recipientRef,
        informedPhoneRef,
        role: dto.role,
        legalGuardianVerified: false,
        origin: dto.origin,
        status: ContactVerificationStatus.INFORMED,
        evidenceRef,
        recordedByUserId: actor.id,
        recordedAt: this.clock(),
      },
      include: verificationInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CONTACT_INFORMED,
      'verification',
      created.id,
      patientRef,
    );
    return this.presentVerification(created);
  }

  async verifyContact(
    principal: AuthPrincipal,
    id: string,
    dto: VerifyVerificationDto,
  ) {
    const actor = await this.requireStaff(principal);
    const current = await this.findVerification(id);
    if (current.revokedAt) {
      throw new ConflictException(
        'Registro revogado não recebe nova verificação.',
      );
    }
    if (current.status === ContactVerificationStatus.VERIFIED) {
      throw new ConflictException(
        'Este registro já foi verificado. Um número diferente exige outro registro.',
      );
    }
    if (
      current.role === ContactSubjectRole.GUARDIAN &&
      dto.legalGuardianVerified !== true
    ) {
      throw new BadRequestException(
        'Responsável legal só fica verificado quando a checagem de responsabilidade é confirmada.',
      );
    }
    const verified = await this.prisma.contactVerification.update({
      where: { id: current.id },
      data: {
        status: ContactVerificationStatus.VERIFIED,
        procedure: dto.procedure,
        verifiedPhoneRef: current.informedPhoneRef,
        legalGuardianVerified:
          current.role === ContactSubjectRole.GUARDIAN &&
          dto.legalGuardianVerified === true,
        verifiedByUserId: actor.id,
        verifiedAt: this.clock(),
      },
      include: verificationInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CONTACT_VERIFIED,
      'verification',
      verified.id,
      verified.patientRef,
    );
    await this.reclassifyPatient(actor, verified.patientRef);
    return this.presentVerification(verified);
  }

  async revokeVerification(principal: AuthPrincipal, id: string) {
    const actor = await this.requireStaff(principal);
    const current = await this.findVerification(id);
    if (current.revokedAt) {
      return this.presentVerification(current);
    }
    const revoked = await this.prisma.contactVerification.update({
      where: { id: current.id },
      data: { revokedAt: this.clock(), revokedByUserId: actor.id },
      include: verificationInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CONTACT_REVOKED,
      'verification',
      revoked.id,
      revoked.patientRef,
    );
    await this.reclassifyPatient(actor, revoked.patientRef);
    return this.presentVerification(revoked);
  }

  listVerifications(patientRef: string) {
    const ref = assertPatientRef(patientRef);
    return this.prisma.contactVerification
      .findMany({
        where: { patientRef: ref },
        include: verificationInclude,
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      })
      .then((rows) => rows.map((row) => this.presentVerification(row)));
  }

  async recordAuthorization(
    principal: AuthPrincipal,
    dto: RecordAuthorizationDto,
  ) {
    const actor = await this.requireStaff(principal);
    const patientRef = assertPatientRef(dto.patientRef);
    const recipientRef = assertRecipientRef(dto.recipientRef);
    const legalBasis = assertOpaque(dto.legalBasis, 'Base legal');
    const evidenceRef = assertOptionalOpaque(dto.evidenceRef, 'Evidência');
    const validFrom = assertInstant(dto.validFrom, 'Início da vigência');
    const expiresAt = assertInstant(dto.expiresAt, 'Fim da vigência');
    if (expiresAt <= validFrom) {
      throw new BadRequestException(
        'A vigência precisa terminar depois do início.',
      );
    }
    if (
      dto.purpose !== APPOINTMENT_CONTACT_PURPOSE ||
      dto.channel !== WHATSAPP_CHANNEL
    ) {
      throw new BadRequestException(
        'A autorização desta etapa é só para contato de agenda por WhatsApp.',
      );
    }
    const created = await this.prisma.contactAuthorization.create({
      data: {
        id: authorizationRecordId(),
        patientRef,
        recipientRef,
        purpose: APPOINTMENT_CONTACT_PURPOSE,
        channel: WHATSAPP_CHANNEL,
        legalBasis,
        evidenceRef,
        validFrom,
        expiresAt,
        recordedByUserId: actor.id,
        recordedAt: this.clock(),
      },
      include: authorizationInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.AUTHORIZATION_RECORDED,
      'authorization',
      created.id,
      patientRef,
    );
    await this.reclassifyPatient(actor, patientRef);
    return this.presentAuthorization(created);
  }

  async revokeAuthorization(principal: AuthPrincipal, id: string) {
    const actor = await this.requireStaff(principal);
    const current = await this.findAuthorization(id);
    if (current.revokedAt) {
      return this.presentAuthorization(current);
    }
    const revoked = await this.prisma.contactAuthorization.update({
      where: { id: current.id },
      data: { revokedAt: this.clock(), revokedByUserId: actor.id },
      include: authorizationInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.AUTHORIZATION_REVOKED,
      'authorization',
      revoked.id,
      revoked.patientRef,
    );
    await this.reclassifyPatient(actor, revoked.patientRef);
    return this.presentAuthorization(revoked);
  }

  listAuthorizations(patientRef: string) {
    const ref = assertPatientRef(patientRef);
    return this.prisma.contactAuthorization
      .findMany({
        where: { patientRef: ref },
        include: authorizationInclude,
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      })
      .then((rows) => rows.map((row) => this.presentAuthorization(row)));
  }

  async associateSubject(principal: AuthPrincipal, dto: AssociateSubjectDto) {
    const actor = await this.requireStaff(principal);
    const patientRef = assertPatientRef(dto.patientRef);
    if (dto.higiaPatientId !== undefined) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: dto.higiaPatientId },
        select: { id: true },
      });
      if (!patient) {
        throw new NotFoundException('Paciente do Higia não encontrado.');
      }
    }
    const existing = await this.prisma.contactSubjectAssociation.findUnique({
      where: { patientRef },
    });
    const saved = existing
      ? await this.prisma.contactSubjectAssociation.update({
          where: { patientRef },
          data: {
            higiaPatientId: dto.higiaPatientId ?? null,
            associatedByUserId: actor.id,
            associatedAt: this.clock(),
          },
          include: { associatedBy: { select: actorSelect } },
        })
      : await this.prisma.contactSubjectAssociation.create({
          data: {
            id: associationRecordId(),
            patientRef,
            higiaPatientId: dto.higiaPatientId ?? null,
            associatedByUserId: actor.id,
            associatedAt: this.clock(),
          },
          include: { associatedBy: { select: actorSelect } },
        });
    await this.audit(
      actor,
      ConfirmationAuditAction.ASSOCIATION_RECORDED,
      'association',
      saved.id,
      patientRef,
    );
    return {
      id: saved.id,
      patientRef: saved.patientRef,
      higiaPatientId: saved.higiaPatientId,
      associatedAt: formatInstant(saved.associatedAt),
      associatedBy: saved.associatedBy,
    };
  }

  listAssociations(patientRef: string) {
    const ref = assertPatientRef(patientRef);
    return this.prisma.contactSubjectAssociation
      .findMany({
        where: { patientRef: ref },
        include: { associatedBy: { select: actorSelect } },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          patientRef: row.patientRef,
          higiaPatientId: row.higiaPatientId,
          associatedAt: formatInstant(row.associatedAt),
          associatedBy: row.associatedBy,
        })),
      );
  }

  listAudit(patientRef: string) {
    const ref = assertPatientRef(patientRef);
    return this.prisma.confirmationAuditEvent
      .findMany({
        where: { patientRef: ref },
        include: { actor: { select: actorSelect } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          action: row.action,
          subjectType: row.subjectType,
          subjectId: row.subjectId,
          patientRef: row.patientRef,
          createdAt: formatInstant(row.createdAt),
          actor: row.actor,
        })),
      );
  }

  async readForResolver(patientRef: string) {
    const ref = assertPatientRef(patientRef);
    const [verifications, authorizations] = await Promise.all([
      this.prisma.contactVerification.findMany({
        where: {
          patientRef: ref,
          status: ContactVerificationStatus.VERIFIED,
          verifiedPhoneRef: { not: null },
        },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.contactAuthorization.findMany({
        where: { patientRef: ref },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      ownership: verifications
        .filter((row) => row.verifiedPhoneRef !== null)
        .map((row) => this.resolverOwnership(row)),
      authorization: authorizations.map((row) =>
        this.resolverAuthorization(row),
      ),
    };
  }

  async createCampaign(principal: AuthPrincipal, dto: CreateCampaignDto) {
    const actor = await this.requireStaff(principal);
    const campaignDate = assertCampaignDate(dto.campaignDate);
    const source = this.sources.get(dto.source);
    const loaded = await source.load(campaignDate);
    const consultation = this.consultationOf(loaded);
    const drafts = loaded.connected
      ? [...loaded.items, ...(loaded.failures ?? [])]
      : (dto.items ?? []);
    const items = this.normalizeItems(drafts);
    const existing = await this.prisma.confirmationCampaign.findFirst({
      where: {
        campaignDate: campaignDateValue(campaignDate),
        source: dto.source,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe campanha nesta data para esta origem.',
      );
    }
    const created = await this.prisma.confirmationCampaign.create({
      data: {
        campaignDate: campaignDateValue(campaignDate),
        source: dto.source,
        status: CampaignAdminStatus.DRAFT,
        consultationState: consultation.consultationState,
        consultationReason: consultation.consultationReason,
        ...this.counts(items),
        createdByUserId: actor.id,
        items: { create: items },
        events: {
          create: {
            action: ConfirmationAuditAction.CAMPAIGN_CREATED,
            actorUserId: actor.id,
            toStatus: CampaignAdminStatus.DRAFT,
            createdAt: this.clock(),
          },
        },
      },
      include: campaignInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CAMPAIGN_CREATED,
      'campaign',
      String(created.id),
      null,
    );
    return this.presentCampaign(created);
  }

  listCampaigns() {
    return this.prisma.confirmationCampaign
      .findMany({
        orderBy: [{ campaignDate: 'desc' }, { id: 'desc' }],
        include: {
          createdBy: { select: actorSelect },
          approvedBy: { select: actorSelect },
        },
      })
      .then((rows) => rows.map((row) => this.presentCampaignSummary(row)));
  }

  async getCampaign(id: number) {
    const row = await this.findCampaign(id);
    return this.withIdentity(this.presentCampaign(row), row);
  }

  async resolveCampaignPending(principal: AuthPrincipal, id: number, itemId?: number) {
    const actor = await this.requireStaff(principal);
    const current = await this.findCampaign(id);
    this.assertEditable(current.status);
    const targets = current.items.filter(item =>
      !item.appointmentRef.startsWith('fail:') && (itemId === undefined || item.id === itemId),
    );
    if (itemId !== undefined && !targets.length) {
      throw new NotFoundException('Agendamento não encontrado nesta campanha.');
    }
    const summary = { evaluated: targets.length, updated: 0, resolved: 0,
      remaining: 0, referencesRecovered: 0, dispatchEnabled: false as const };
    const retryInitialCollection = itemId === undefined && current.items.length === 0 &&
      current.consultationState === CampaignConsultationState.FAILED;
    if (!targets.length && !retryInitialCollection) return { campaign: await this.getCampaign(id), summary };
    const revision = campaignRevision(current);
    let loaded: AppointmentSourceLoad;
    try {
      loaded = await this.sources.get(current.source).load(current.campaignDate.toISOString().slice(0, 10));
    } catch {
      throw new ServiceUnavailableException('Não foi possível atualizar a agenda. Nenhuma alteração foi aplicada.');
    }
    if (!loaded.connected || !['ready', 'empty'].includes(loaded.availability) ||
        loaded.registry !== 'ready' || (loaded.failures?.length ?? 0) > 0) {
      throw new ServiceUnavailableException('A agenda ou o registro de contatos está indisponível ou incompleto. Nenhuma alteração foi aplicada.');
    }
    const normalized = this.normalizeItems(loaded.items);
    for (const item of normalized) {
      if (item.recipientState === CampaignRecipientState.ELIGIBLE &&
          (item.reasonCode !== 'contact_ready' || !item.patientRef || !item.recipientRef ||
           !item.informedPhoneRef || item.isMinor === null ||
           !['candidate', 'guardian_unavailable'].includes(item.sourceResolution ?? '') ||
           (item.isMinor === true && item.sourceResolution !== 'guardian_unavailable') ||
           (item.isMinor === false && item.sourceResolution !== 'candidate'))) {
        item.recipientState = CampaignRecipientState.UNAVAILABLE;
        item.reasonCode = 'reclassification_unavailable';
      }
    }
    if (retryInitialCollection) {
      const saved = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM confirmation_campaigns WHERE id=${id} FOR UPDATE`;
        const locked = await tx.confirmationCampaign.findUniqueOrThrow({ where: { id }, include: campaignInclude });
        this.assertEditable(locked.status);
        if (campaignRevision(locked) !== revision || locked.items.length ||
            locked.consultationState !== CampaignConsultationState.FAILED) {
          throw new ConflictException('A campanha mudou durante a consulta. Recarregue antes de tentar novamente.');
        }
        const result = await tx.confirmationCampaign.update({ where: { id }, data: {
          ...this.consultationOf(loaded), ...this.counts(normalized), items: { create: normalized },
          events: { create: { action: ConfirmationAuditAction.CAMPAIGN_UPDATED, actorUserId: actor.id,
            fromStatus: locked.status, toStatus: locked.status, createdAt: this.clock() } },
        }, include: campaignInclude });
        await tx.confirmationAuditEvent.create({ data: {
          action: ConfirmationAuditAction.CAMPAIGN_UPDATED, subjectType: 'campaign', subjectId: String(id),
          patientRef: null, actorUserId: actor.id, createdAt: this.clock(),
        } });
        return result;
      });
      summary.evaluated = normalized.length;
      summary.updated = normalized.length;
      summary.resolved = normalized.filter(item => item.recipientState === CampaignRecipientState.ELIGIBLE).length;
      summary.remaining = normalized.length - summary.resolved;
      return { campaign: await this.withIdentity(this.presentCampaign(saved), saved), summary };
    }
    const fresh = new Map(normalized.map(item => [item.appointmentRef, item]));
    const changes = targets.map(item => {
      const found = fresh.get(item.appointmentRef);
      if (!found) return { item, data: { recipientState: CampaignRecipientState.UNAVAILABLE,
        reasonCode: 'appointment_not_available' }, recovered: false };
      if ((item.patientRef && found.patientRef !== item.patientRef) ||
          (item.recipientRef && found.recipientRef !== item.recipientRef)) {
        return { item, data: { recipientState: CampaignRecipientState.UNAVAILABLE,
          reasonCode: 'appointment_identity_changed' }, recovered: false };
      }
      const { appointmentRef: _reference, ...data } = found;
      return { item, data, recovered: !item.informedPhoneRef && Boolean(data.informedPhoneRef) };
    });
    const saved = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM confirmation_campaigns WHERE id=${id} FOR UPDATE`;
      const locked = await tx.confirmationCampaign.findUniqueOrThrow({ where: { id }, include: campaignInclude });
      this.assertEditable(locked.status);
      if (campaignRevision(locked) !== revision) {
        throw new ConflictException('A campanha mudou durante a atualização. Recarregue e tente novamente.');
      }
      for (const { item, data, recovered } of changes) {
        if (item.recipientState !== CampaignRecipientState.ELIGIBLE && data.recipientState === CampaignRecipientState.ELIGIBLE)
          summary.resolved++;
        if (data.recipientState !== CampaignRecipientState.ELIGIBLE) summary.remaining++;
        if (recovered) summary.referencesRecovered++;
        if (Object.entries(data).every(([key, value]) => (item as unknown as Record<string, unknown>)[key] === value)) continue;
        await tx.confirmationCampaignItem.update({ where: { id: item.id }, data });
        await tx.confirmationAuditEvent.create({ data: {
          action: ConfirmationAuditAction.ITEM_RECLASSIFIED, subjectType: 'campaign_item',
          subjectId: String(item.id), patientRef: item.patientRef, actorUserId: actor.id, createdAt: this.clock(),
        } });
        summary.updated++;
      }
      if (!summary.updated) return locked;
      const updated = await tx.confirmationCampaign.findUniqueOrThrow({ where: { id }, include: campaignInclude });
      return tx.confirmationCampaign.update({ where: { id }, data: {
        ...this.counts(updated.items),
        events: { create: { action: ConfirmationAuditAction.ITEM_RECLASSIFIED, actorUserId: actor.id,
          fromStatus: locked.status, toStatus: locked.status, createdAt: this.clock() } },
      }, include: campaignInclude });
    });
    return { campaign: await this.withIdentity(this.presentCampaign(saved), saved), summary };
  }

  async reclassifyContact(principal: AuthPrincipal, patientRef: string) {
    const actor = await this.requireStaff(principal);
    const ref = assertPatientRef(patientRef);
    if (!this.classifier) {
      throw new ServiceUnavailableException('Reavaliação de contato indisponível.');
    }
    await this.reclassifyPatient(actor, ref);
    return { reclassified: true as const, dispatchEnabled: false as const };
  }

  async searchPatients(principal: AuthPrincipal, name: string) {
    await this.requireStaff(principal);
    const rows = await this.prisma.confirmationCampaign.findMany({
      where: { source: CampaignSourceKey.SAUDEVIANET },
      orderBy: [{ campaignDate: 'desc' }, { id: 'desc' }],
    });
    const dates: string[] = [];
    for (const row of rows) {
      if (row.source !== CampaignSourceKey.SAUDEVIANET) {
        continue;
      }
      const day = row.campaignDate.toISOString().slice(0, 10);
      if (!dates.includes(day)) {
        dates.push(day);
      }
      if (dates.length === 14) {
        break;
      }
    }
    if (dates.length === 0) {
      return {
        state: 'empty',
        truncated: false,
        people: [],
        dispatchEnabled: false as const,
      };
    }
    try {
      const mapped = mapPatientSearch(
        await this.identity.searchPatients(name.trim(), dates),
      );
      if (!mapped) {
        return {
          state: 'unavailable',
          truncated: false,
          people: [],
          dispatchEnabled: false as const,
        };
      }
      return { ...mapped, dispatchEnabled: false as const };
    } catch {
      return {
        state: 'unavailable',
        truncated: false,
        people: [],
        dispatchEnabled: false as const,
      };
    }
  }

  async replaceItems(
    principal: AuthPrincipal,
    id: number,
    dto: ReplaceCampaignItemsDto,
  ) {
    const actor = await this.requireStaff(principal);
    const current = await this.findCampaign(id);
    this.assertEditable(current.status);
    const items = this.normalizeItems(dto.items);
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.confirmationCampaignItem.deleteMany({
        where: { campaignId: id },
      });
      await tx.confirmationCampaign.update({
        where: { id },
        data: {
          ...this.counts(items),
          items: { create: items },
          events: {
            create: {
              action: ConfirmationAuditAction.CAMPAIGN_UPDATED,
              actorUserId: actor.id,
              fromStatus: current.status,
              toStatus: current.status,
              createdAt: this.clock(),
            },
          },
        },
      });
      return tx.confirmationCampaign.findUniqueOrThrow({
        where: { id },
        include: campaignInclude,
      });
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CAMPAIGN_UPDATED,
      'campaign',
      String(id),
      null,
    );
    return this.presentCampaign(saved);
  }

  async submitReview(principal: AuthPrincipal, id: number) {
    return this.transition(
      principal,
      id,
      CampaignAdminStatus.DRAFT,
      CampaignAdminStatus.IN_REVIEW,
      ConfirmationAuditAction.CAMPAIGN_SUBMITTED,
    );
  }

  async setResponseDeadline(
    principal: AuthPrincipal,
    id: number,
    value: string,
  ) {
    const actor = await this.requireStaff(principal);
    if (!isUtcInstant(value))
      throw new BadRequestException('Prazo UTC inválido.');
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM confirmation_campaigns WHERE id=${id} FOR UPDATE`;
      const current = await tx.confirmationCampaign.findUniqueOrThrow({
        where: { id },
        include: campaignInclude,
      });
      this.assertEditable(current.status);
      return tx.confirmationCampaign.update({
        where: { id },
        data: {
          responseDeadlineAt: new Date(value),
          events: {
            create: {
              action: ConfirmationAuditAction.CAMPAIGN_UPDATED,
              actorUserId: actor.id,
              fromStatus: current.status,
              toStatus: current.status,
              createdAt: this.clock(),
            },
          },
        },
        include: campaignInclude,
      });
    });
    return this.presentCampaign(saved);
  }

  async approve(principal: AuthPrincipal, id: number) {
    const actor = await this.requireStaff(principal);
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM confirmation_campaigns WHERE id=${id} FOR UPDATE`;
      const current = await tx.confirmationCampaign.findUniqueOrThrow({
        where: { id },
        include: campaignInclude,
      });
      if (current.status !== CampaignAdminStatus.IN_REVIEW)
        throw new BadRequestException(
          'A aprovação administrativa sai da revisão, não do rascunho.',
        );
      assertResponseDeadline(current, this.clock());
      const approved = await tx.confirmationCampaign.update({
        where: { id },
        data: {
          status: CampaignAdminStatus.APPROVED,
          approvedByUserId: actor.id,
          approvedAt: this.clock(),
          events: {
            create: {
              action: ConfirmationAuditAction.CAMPAIGN_APPROVED,
              actorUserId: actor.id,
              fromStatus: current.status,
              toStatus: CampaignAdminStatus.APPROVED,
              createdAt: this.clock(),
            },
          },
        },
        include: campaignInclude,
      });
      await tx.confirmationApprovalSnapshot.create({
        data: {
          revision: campaignRevision(approved),
          campaignId: id,
          snapshot: JSON.parse(
            JSON.stringify({
              date: approved.campaignDate.toISOString().slice(0, 10),
              responseDeadlineAt: approved.responseDeadlineAt,
              items: approved.items
                .filter((item) => item.recipientState === 'ELIGIBLE')
                .map((item) => ({
                  itemId: item.id,
                  appointmentRef: item.appointmentRef,
                  patientRef: item.patientRef,
                  recipientRef: item.recipientRef,
                  phoneRef: item.informedPhoneRef,
                  appointmentTime: item.appointmentTime,
                })),
            }),
          ),
        },
      });
      return approved;
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CAMPAIGN_APPROVED,
      'campaign',
      String(id),
      null,
    );
    return this.presentCampaign(saved);
  }

  async reopen(principal: AuthPrincipal, id: number) {
    const actor = await this.requireStaff(principal);
    const current = await this.findCampaign(id);
    if (current.status !== CampaignAdminStatus.APPROVED) {
      throw new BadRequestException(
        'Só uma campanha aprovada volta para revisão.',
      );
    }
    const saved = await this.prisma.confirmationCampaign.update({
      where: { id },
      data: {
        status: CampaignAdminStatus.IN_REVIEW,
        approvedByUserId: null,
        approvedAt: null,
        events: {
          create: {
            action: ConfirmationAuditAction.CAMPAIGN_REOPENED,
            actorUserId: actor.id,
            fromStatus: CampaignAdminStatus.APPROVED,
            toStatus: CampaignAdminStatus.IN_REVIEW,
            createdAt: this.clock(),
          },
        },
      },
      include: campaignInclude,
    });
    await this.audit(
      actor,
      ConfirmationAuditAction.CAMPAIGN_REOPENED,
      'campaign',
      String(id),
      null,
    );
    return this.presentCampaign(saved);
  }

  private async transition(
    principal: AuthPrincipal,
    id: number,
    from: CampaignAdminStatus,
    to: CampaignAdminStatus,
    action: ConfirmationAuditAction,
  ) {
    const actor = await this.requireStaff(principal);
    const current = await this.findCampaign(id);
    if (current.status !== from) {
      throw new BadRequestException(
        'A campanha não está no estado esperado para esta operação.',
      );
    }
    const saved = await this.prisma.confirmationCampaign.update({
      where: { id },
      data: {
        status: to,
        events: {
          create: {
            action,
            actorUserId: actor.id,
            fromStatus: from,
            toStatus: to,
            createdAt: this.clock(),
          },
        },
      },
      include: campaignInclude,
    });
    await this.audit(actor, action, 'campaign', String(id), null);
    return this.presentCampaign(saved);
  }

  private async requireStaff(principal: AuthPrincipal): Promise<StaffActor> {
    if (isServicePrincipal(principal)) {
      throw new ForbiddenException(
        'Token de serviço não grava contatos nem campanhas.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: principal.sub },
      select: { id: true, role: true, name: true },
    });
    if (!user || !STAFF_ROLES.has(user.role)) {
      throw new ForbiddenException(
        'O papel atual no cadastro não permite esta operação.',
      );
    }
    return user;
  }

  private async findVerification(id: string) {
    const row = await this.prisma.contactVerification.findUnique({
      where: { id },
      include: verificationInclude,
    });
    if (!row) {
      throw new NotFoundException('Verificação não encontrada.');
    }
    return row;
  }

  private async findAuthorization(id: string) {
    const row = await this.prisma.contactAuthorization.findUnique({
      where: { id },
      include: authorizationInclude,
    });
    if (!row) {
      throw new NotFoundException('Autorização não encontrada.');
    }
    return row;
  }

  private async findCampaign(id: number) {
    const row = await this.prisma.confirmationCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!row) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    return row;
  }

  private assertEditable(status: CampaignAdminStatus) {
    if (status === CampaignAdminStatus.APPROVED) {
      throw new BadRequestException(
        'Reabra a revisão antes de alterar os itens de uma campanha aprovada.',
      );
    }
  }

  private consultationOf(loaded: AppointmentSourceLoad): {
    consultationState: CampaignConsultationState;
    consultationReason: string | null;
  } {
    if (!loaded.connected) {
      return {
        consultationState: CampaignConsultationState.NOT_CONNECTED,
        consultationReason: null,
      };
    }
    const consultationState = {
      ready: CampaignConsultationState.READY,
      empty: CampaignConsultationState.EMPTY,
      partial: CampaignConsultationState.PARTIAL,
      failed: CampaignConsultationState.FAILED,
    }[loaded.availability];
    const reason = loaded.reason;
    return {
      consultationState,
      consultationReason:
        reason && /^[a-z0-9][a-z0-9_.:-]{0,63}$/.test(reason) ? reason : null,
    };
  }

  private async reclassifyPatient(actor: StaffActor, patientRef: string) {
    const rows = await this.prisma.confirmationCampaign.findMany({
      include: campaignInclude,
    });
    for (const campaign of rows) {
      const targets = campaign.items.filter(
        (item) => item.patientRef === patientRef && item.sourceResolution,
      );
      if (targets.length === 0) {
        continue;
      }
      let classified: Awaited<
        ReturnType<CampaignContactClassifier['classify']>
      > | null = null;
      if (this.classifier) {
        try {
          classified = await this.classifier.classify(
            targets.map((item) => ({
              appointmentRef: item.appointmentRef,
              patientRef: item.patientRef,
              recipientRef: item.recipientRef,
              phoneRef: item.informedPhoneRef,
              isMinor: item.isMinor,
              resolution: item.sourceResolution,
            })),
          );
        } catch {
          classified = null;
        }
      }
      let changed = false;
      for (const item of targets) {
        const next = classified?.find(
          (entry) => entry.appointmentRef === item.appointmentRef,
        );
        const recipientState = next
          ? this.recipientStateOf(next.contactState, next.reasonCode)
          : item.recipientState === CampaignRecipientState.ELIGIBLE
            ? CampaignRecipientState.UNAVAILABLE
            : item.recipientState;
        const reasonCode = next
          ? assertOptionalOpaque(next.reasonCode, 'Pendência')
          : item.recipientState === CampaignRecipientState.ELIGIBLE
            ? 'reclassification_unavailable'
            : item.reasonCode;
        if (
          recipientState === item.recipientState &&
          reasonCode === item.reasonCode
        ) {
          continue;
        }
        changed = true;
        await this.prisma.confirmationCampaignItem.update({
          where: { id: item.id },
          data: { recipientState, reasonCode },
        });
        await this.audit(
          actor,
          ConfirmationAuditAction.ITEM_RECLASSIFIED,
          'campaign_item',
          String(item.id),
          patientRef,
        );
      }
      if (!changed) {
        continue;
      }
      const fresh = await this.findCampaign(campaign.id);
      await this.prisma.confirmationCampaign.update({
        where: { id: campaign.id },
        data: {
          ...this.counts(fresh.items),
          events: {
            create: {
              action: ConfirmationAuditAction.ITEM_RECLASSIFIED,
              actorUserId: actor.id,
              fromStatus: campaign.status,
              toStatus: campaign.status,
              createdAt: this.clock(),
            },
          },
        },
      });
    }
  }

  private recipientStateOf(
    contactState: 'eligible' | 'pending' | 'unavailable',
    reasonCode: string,
  ): CampaignRecipientState {
    if (contactState === 'eligible' && reasonCode === 'contact_ready') {
      return CampaignRecipientState.ELIGIBLE;
    }
    if (contactState === 'unavailable') {
      return CampaignRecipientState.UNAVAILABLE;
    }
    return CampaignRecipientState.PENDING;
  }

  private normalizeAppointmentTime(value: string | null | undefined): string | null {
    if (value == null || value === '') {
      return null;
    }
    const matched = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
    if (!matched) {
      throw new BadRequestException('Horário do agendamento inválido.');
    }
    return `${matched[1]}:${matched[2]}`;
  }

  private normalizeItems(items: readonly ItemDraft[]) {
    const seen = new Set<string>();
    return items.map((item) => {
      const appointmentRef = assertAppointmentRef(item.appointmentRef);
      if (seen.has(appointmentRef)) {
        throw new BadRequestException('Há agendamento repetido na campanha.');
      }
      seen.add(appointmentRef);
      const appointmentTime = this.normalizeAppointmentTime(item.appointmentTime);
      return {
        appointmentRef,
        patientRef: item.patientRef ? assertPatientRef(item.patientRef) : null,
        recipientRef: item.recipientRef
          ? assertRecipientRef(item.recipientRef)
          : null,
        informedPhoneRef: assertOptionalPhoneRef(item.informedPhoneRef),
        professionalRef: assertOptionalOpaque(
          item.professionalRef,
          'Profissional',
        ),
        appointmentTime,
        agendaRef: assertOptionalOpaque(item.agendaRef, 'Agenda'),
        sourceResolution: assertOptionalOpaque(
          item.sourceResolution,
          'Situação da agenda',
        ),
        isMinor:
          item.isMinor === true ? true : item.isMinor === false ? false : null,
        recipientState: item.recipientState,
        reasonCode: assertOptionalOpaque(item.reasonCode, 'Pendência'),
      };
    });
  }

  private counts(
    items: readonly {
      appointmentRef?: string;
      recipientState: CampaignRecipientState;
    }[],
  ) {
    const appointments = items.filter(
      (item) => !item.appointmentRef?.startsWith('fail:'),
    );
    return {
      appointmentsAnalyzed: appointments.length,
      eligibleRecipients: appointments.filter(
        (item) => item.recipientState === CampaignRecipientState.ELIGIBLE,
      ).length,
      pendingVerifications: appointments.filter(
        (item) => item.recipientState === CampaignRecipientState.PENDING,
      ).length,
      unavailableRecipients: appointments.filter(
        (item) => item.recipientState === CampaignRecipientState.UNAVAILABLE,
      ).length,
    };
  }

  private async audit(
    actor: StaffActor,
    action: ConfirmationAuditAction,
    subjectType: string,
    subjectId: string,
    patientRef: string | null,
  ) {
    await this.prisma.confirmationAuditEvent.create({
      data: {
        action,
        subjectType,
        subjectId,
        patientRef,
        actorUserId: actor.id,
        createdAt: this.clock(),
      },
    });
  }

  private presentVerification(
    row: ContactVerification & {
      recordedBy: { id: number; name: string };
      verifiedBy: { id: number; name: string } | null;
      revokedBy: { id: number; name: string } | null;
    },
  ) {
    return {
      id: row.id,
      patientRef: row.patientRef,
      recipientRef: row.recipientRef,
      informedPhoneRef: row.informedPhoneRef,
      verifiedPhoneRef: row.verifiedPhoneRef,
      role: row.role,
      legalGuardianVerified: row.legalGuardianVerified,
      origin: row.origin,
      procedure: row.procedure,
      status: row.status,
      evidenceRef: row.evidenceRef,
      ownershipProven: false,
      recordedAt: formatInstant(row.recordedAt),
      verifiedAt: row.verifiedAt ? formatInstant(row.verifiedAt) : null,
      revokedAt: row.revokedAt ? formatInstant(row.revokedAt) : null,
      recordedBy: row.recordedBy,
      verifiedBy: row.verifiedBy,
      revokedBy: row.revokedBy,
    };
  }

  private presentAuthorization(
    row: ContactAuthorization & {
      recordedBy: { id: number; name: string };
      revokedBy: { id: number; name: string } | null;
    },
  ) {
    return {
      id: row.id,
      patientRef: row.patientRef,
      recipientRef: row.recipientRef,
      purpose: row.purpose,
      channel: row.channel,
      legalBasis: row.legalBasis,
      evidenceRef: row.evidenceRef,
      validFrom: formatInstant(row.validFrom),
      expiresAt: formatInstant(row.expiresAt),
      recordedAt: formatInstant(row.recordedAt),
      revokedAt: row.revokedAt ? formatInstant(row.revokedAt) : null,
      recordedBy: row.recordedBy,
      revokedBy: row.revokedBy,
      grantsOwnership: false,
    };
  }

  private resolverOwnership(row: ContactVerification) {
    return {
      id: row.id,
      patientRef: row.patientRef,
      recipientRef: row.recipientRef,
      phoneRef: row.verifiedPhoneRef,
      role: row.role === ContactSubjectRole.GUARDIAN ? 'guardian' : 'patient',
      legalGuardianVerified: row.legalGuardianVerified,
      evidenceRef: row.evidenceRef ?? UNATTACHED_EVIDENCE,
      originRef: `procedure:${(row.procedure ?? 'recorded_procedure').toLowerCase()}`,
      recordedBy: `user:${row.recordedByUserId}`,
      recordedAt: formatInstant(row.recordedAt),
      revokedAt: row.revokedAt ? formatInstant(row.revokedAt) : null,
      revokedBy: row.revokedByUserId ? `user:${row.revokedByUserId}` : null,
    };
  }

  private resolverAuthorization(row: ContactAuthorization) {
    return {
      id: row.id,
      patientRef: row.patientRef,
      recipientRef: row.recipientRef,
      purpose: row.purpose,
      channel: row.channel,
      legalBasis: row.legalBasis,
      originRef: row.evidenceRef ?? UNATTACHED_EVIDENCE,
      recordedBy: `user:${row.recordedByUserId}`,
      recordedAt: formatInstant(row.recordedAt),
      validFrom: formatInstant(row.validFrom),
      expiresAt: formatInstant(row.expiresAt),
      revokedAt: row.revokedAt ? formatInstant(row.revokedAt) : null,
      revokedBy: row.revokedByUserId ? `user:${row.revokedByUserId}` : null,
    };
  }

  private presentCampaignSummary(row: {
    id: number;
    campaignDate: Date;
    source: CampaignSourceKey;
    status: CampaignAdminStatus;
    appointmentsAnalyzed: number;
    eligibleRecipients: number;
    pendingVerifications: number;
    unavailableRecipients: number;
    consultationState: CampaignConsultationState;
    consultationReason: string | null;
    approvedAt: Date | null;
    responseDeadlineAt?: Date | null;
    createdAt: Date;
    createdBy: { id: number; name: string };
    approvedBy: { id: number; name: string } | null;
    items?: { appointmentRef: string }[];
  }) {
    return {
      id: row.id,
      campaignDate: row.campaignDate.toISOString().slice(0, 10),
      source: row.source,
      sourceLabel: this.sources.get(row.source).label,
      status: row.status,
      appointmentsAnalyzed: row.appointmentsAnalyzed,
      eligibleRecipients: row.eligibleRecipients,
      pendingVerifications: row.pendingVerifications,
      unavailableRecipients: row.unavailableRecipients,
      consultationState: row.consultationState,
      consultationReason: row.consultationReason,
      responseDeadlineAt: row.responseDeadlineAt?.toISOString() ?? null,
      approvedAt: row.approvedAt ? formatInstant(row.approvedAt) : null,
      createdAt: formatInstant(row.createdAt),
      createdBy: row.createdBy,
      approvedBy: row.approvedBy,
      dispatchEnabled: false,
      technicalFailures:
        row.items?.filter((item) => item.appointmentRef.startsWith('fail:'))
          .length ?? 0,
    };
  }

  private async withIdentity(
    campaign: ReturnType<ConfirmationAdminService['presentCampaign']>,
    row: { source: CampaignSourceKey; campaignDate: Date },
  ) {
    const blank = campaign.items.map((item) => ({
      ...item,
      displayName: null,
      maskedPhone: null,
      professionalName: null,
      phoneStatus: 'missing' as const,
      identityStatus: 'unavailable' as const,
    }));
    if (row.source !== CampaignSourceKey.SAUDEVIANET) {
      return {
        ...campaign,
        identityStatus: 'unavailable' as const,
        items: blank,
      };
    }
    try {
      const mapped = mapCampaignIdentity(
        await this.identity.identify(campaign.campaignDate),
      );
      if (!mapped || mapped.state === 'unavailable') {
        return {
          ...campaign,
          identityStatus: 'unavailable' as const,
          items: blank,
        };
      }
      const byAppointment = new Map(
        mapped.items.map((item) => [item.appointmentRef, item]),
      );
      return {
        ...campaign,
        identityStatus: mapped.state,
        items: campaign.items.map((item) => {
          const visual = byAppointment.get(item.appointmentRef);
          if (!visual) {
            return {
              ...item,
              displayName: null,
              maskedPhone: null,
              professionalName: null,
              phoneStatus: 'missing' as const,
              identityStatus: 'unavailable' as const,
            };
          }
          return {
            ...item,
            displayName: visual.displayName,
            maskedPhone: visual.maskedPhone,
            professionalName: visual.professionalName,
            phoneStatus: visual.phoneStatus,
            identityStatus: visual.displayName
              ? ('ready' as const)
              : ('partial' as const),
          };
        }),
      };
    } catch {
      return {
        ...campaign,
        identityStatus: 'unavailable' as const,
        items: blank,
      };
    }
  }

  private presentCampaign(
    row: Prisma.ConfirmationCampaignGetPayload<{
      include: typeof campaignInclude;
    }>,
  ) {
    return {
      ...this.presentCampaignSummary(row),
      items: row.items.map((item) => ({
        id: item.id,
        appointmentRef: item.appointmentRef,
        patientRef: item.patientRef,
        recipientRef: item.recipientRef,
        informedPhoneRef: item.informedPhoneRef,
        professionalRef: item.professionalRef,
        appointmentTime: item.appointmentTime,
        agendaRef: item.agendaRef,
        sourceResolution: item.sourceResolution,
        isMinor: item.isMinor,
        recipientState: item.recipientState,
        reasonCode: item.reasonCode,
      })),
      events: row.events.map((event) => ({
        id: event.id,
        action: event.action,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        createdAt: formatInstant(event.createdAt),
        actor: event.actor,
      })),
    };
  }
}
