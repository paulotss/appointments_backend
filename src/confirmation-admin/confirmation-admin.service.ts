import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CampaignAdminStatus,
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
  AppointmentSourceRegistry,
  defaultAppointmentSources,
} from './appointment-source';
import {
  AssociateSubjectDto,
  CampaignItemDto,
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

@Injectable()
export class ConfirmationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly sources: AppointmentSourceRegistry = defaultAppointmentSources(),
    @Optional()
    private readonly clock: () => Date = () => new Date(),
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
    const drafts = loaded.connected ? loaded.items : (dto.items ?? []);
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
    return this.presentCampaign(await this.findCampaign(id));
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

  async approve(principal: AuthPrincipal, id: number) {
    const actor = await this.requireStaff(principal);
    const current = await this.findCampaign(id);
    if (current.status !== CampaignAdminStatus.IN_REVIEW) {
      throw new BadRequestException(
        'A aprovação administrativa sai da revisão, não do rascunho.',
      );
    }
    const saved = await this.prisma.confirmationCampaign.update({
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

  private normalizeItems(items: readonly CampaignItemDto[]) {
    const seen = new Set<string>();
    return items.map((item) => {
      const appointmentRef = assertAppointmentRef(item.appointmentRef);
      if (seen.has(appointmentRef)) {
        throw new BadRequestException('Há agendamento repetido na campanha.');
      }
      seen.add(appointmentRef);
      return {
        appointmentRef,
        patientRef: item.patientRef ? assertPatientRef(item.patientRef) : null,
        recipientRef: item.recipientRef
          ? assertRecipientRef(item.recipientRef)
          : null,
        informedPhoneRef: assertOptionalPhoneRef(item.informedPhoneRef),
        recipientState: item.recipientState,
        reasonCode: assertOptionalOpaque(item.reasonCode, 'Pendência'),
      };
    });
  }

  private counts(items: readonly { recipientState: CampaignRecipientState }[]) {
    return {
      appointmentsAnalyzed: items.length,
      eligibleRecipients: items.filter(
        (item) => item.recipientState === CampaignRecipientState.ELIGIBLE,
      ).length,
      pendingVerifications: items.filter(
        (item) => item.recipientState === CampaignRecipientState.PENDING,
      ).length,
      unavailableRecipients: items.filter(
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
    approvedAt: Date | null;
    createdAt: Date;
    createdBy: { id: number; name: string };
    approvedBy: { id: number; name: string } | null;
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
      approvedAt: row.approvedAt ? formatInstant(row.approvedAt) : null,
      createdAt: formatInstant(row.createdAt),
      createdBy: row.createdBy,
      approvedBy: row.approvedBy,
      dispatchEnabled: false,
    };
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
