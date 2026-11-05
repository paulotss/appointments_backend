import 'reflect-metadata';
/* eslint-disable @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CampaignAdminStatus,
  CampaignRecipientState,
  CampaignSourceKey,
  ContactOrigin,
  ContactSubjectRole,
  ContactVerificationProcedure,
  ContactVerificationStatus,
  UserRole,
} from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AppointmentSource,
  AppointmentSourceRegistry,
  HigiaAppointmentSource,
  SaudeVianetAppointmentSource,
  mapCampaignIdentity,
  mapPatientSearch,
  type CampaignContactClassifier,
  type CampaignIdentityClient,
} from './appointment-source';
import { ConfirmationAdminModule } from './confirmation-admin.module';
import { ConfirmationAdminService } from './confirmation-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { InformVerificationDto } from './dto/confirmation-admin.dto';

const APPT_A = `appt:v1:clinic:${'ab'.repeat(32)}`;
const APPT_B = `appt:v1:clinic:${'cd'.repeat(32)}`;
const PATIENT = `patient:v1:clinic:${'ab'.repeat(32)}`;
const RECIPIENT = `recipient:v1:clinic:${'cd'.repeat(32)}`;
const PHONE_A = `phone:v1:clinic:${'11'.repeat(32)}`;
const PHONE_B = `phone:v1:clinic:${'22'.repeat(32)}`;
const NOW = new Date('2026-11-03T15:00:00.000Z');

const receptionist = principal(7, UserRole.RECEPTIONIST);
const admin = principal(8, UserRole.ADMIN);
const staleAdmin = principal(9, UserRole.ADMIN);
const serviceToken = {
  typ: 'service' as const,
  sub: 1,
  scopes: ['CLINIC_REGISTRY_READ' as const],
  jti: 'service-jti',
};

function principal(sub: number, role: UserRole) {
  return {
    typ: 'user' as const,
    sub,
    usernameLogin: `user${sub}`,
    role,
    patientId: null,
    healthProfessionalId: null,
    jti: `jti-${sub}`,
  };
}

function memory() {
  const users = [
    { id: 7, role: UserRole.RECEPTIONIST, name: 'Recepcao' },
    { id: 8, role: UserRole.ADMIN, name: 'Admin' },
    { id: 9, role: UserRole.PROFESSIONAL, name: 'Profissional' },
  ];
  const patients = [{ id: 4 }];
  const verifications: Array<Record<string, unknown>> = [];
  const authorizations: Array<Record<string, unknown>> = [];
  const associations: Array<Record<string, unknown>> = [];
  const campaigns: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  let campaignSeq = 1;
  let itemSeq = 1;
  let eventSeq = 1;
  let auditSeq = 1;

  const actor = (id: unknown) => {
    const user = users.find((item) => item.id === id);
    return user ? { id: user.id, name: user.name } : null;
  };
  const match = (
    row: Record<string, unknown>,
    where?: Record<string, unknown>,
  ) => {
    if (!where) return true;
    return Object.entries(where).every(([key, expected]) => {
      if (expected instanceof Date) {
        return (
          row[key] instanceof Date && row[key].getTime() === expected.getTime()
        );
      }
      if (expected && typeof expected === 'object' && 'not' in expected) {
        return row[key] !== (expected as { not: unknown }).not;
      }
      return row[key] === expected;
    });
  };
  const sort = (rows: Array<Record<string, unknown>>, orderBy?: unknown) => {
    const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    return [...rows].sort((left, right) => {
      for (const order of orders) {
        const [key, direction] = Object.entries(
          order as Record<string, string>,
        )[0];
        if (left[key] === right[key]) continue;
        const compared =
          (left[key] as number | string | Date) >
          (right[key] as number | string | Date)
            ? 1
            : -1;
        return direction === 'desc' ? -compared : compared;
      }
      return 0;
    });
  };
  const decorateVerification = (
    row: Record<string, unknown>,
    include?: Record<string, unknown>,
  ) =>
    include
      ? {
          ...row,
          recordedBy: actor(row.recordedByUserId),
          verifiedBy: actor(row.verifiedByUserId),
          revokedBy: actor(row.revokedByUserId),
        }
      : row;
  const decorateAuthorization = (
    row: Record<string, unknown>,
    include?: Record<string, unknown>,
  ) =>
    include
      ? {
          ...row,
          recordedBy: actor(row.recordedByUserId),
          revokedBy: actor(row.revokedByUserId),
        }
      : row;
  const decorateCampaign = (row: Record<string, unknown>) => ({
    ...row,
    createdBy: actor(row.createdByUserId),
    approvedBy: actor(row.approvedByUserId),
    events: (row.events as Array<Record<string, unknown>>).map((event) => ({
      ...event,
      actor: actor(event.actorUserId),
    })),
  });

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: number } }) =>
        users.find((user) => user.id === where.id) ?? null,
    },
    patient: {
      findUnique: async ({ where }: { where: { id: number } }) =>
        patients.find((patient) => patient.id === where.id) ?? null,
    },
    contactVerification: {
      create: async ({
        data,
        include,
      }: {
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const row = {
          verifiedPhoneRef: null,
          procedure: null,
          verifiedAt: null,
          verifiedByUserId: null,
          revokedAt: null,
          revokedByUserId: null,
          ...data,
        };
        verifications.push(row);
        return decorateVerification(row, include);
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        verifications.find((row) => match(row, where)) ?? null,
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: Record<string, unknown>;
      }) => {
        const row = verifications.find((item) => item.id === where.id);
        return row ? decorateVerification(row, include) : null;
      },
      findMany: async ({
        where,
        include,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        include?: Record<string, unknown>;
        orderBy?: unknown;
      }) =>
        sort(
          verifications.filter((row) => match(row, where)),
          orderBy,
        ).map((row) => decorateVerification(row, include)),
      update: async ({
        where,
        data,
        include,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const row = verifications.find((item) => item.id === where.id);
        if (!row) throw new Error('missing verification');
        Object.assign(row, data);
        return decorateVerification(row, include);
      },
    },
    contactAuthorization: {
      create: async ({
        data,
        include,
      }: {
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const row = { revokedAt: null, revokedByUserId: null, ...data };
        authorizations.push(row);
        return decorateAuthorization(row, include);
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: Record<string, unknown>;
      }) => {
        const row = authorizations.find((item) => item.id === where.id);
        return row ? decorateAuthorization(row, include) : null;
      },
      findMany: async ({
        where,
        include,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        include?: Record<string, unknown>;
        orderBy?: unknown;
      }) =>
        sort(
          authorizations.filter((row) => match(row, where)),
          orderBy,
        ).map((row) => decorateAuthorization(row, include)),
      update: async ({
        where,
        data,
        include,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const row = authorizations.find((item) => item.id === where.id);
        if (!row) throw new Error('missing authorization');
        Object.assign(row, data);
        return decorateAuthorization(row, include);
      },
    },
    contactSubjectAssociation: {
      findUnique: async ({ where }: { where: { patientRef: string } }) =>
        associations.find((row) => row.patientRef === where.patientRef) ?? null,
      findMany: async ({
        where,
        include,
      }: {
        where: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) =>
        associations
          .filter((row) => match(row, where))
          .map((row) =>
            include
              ? { ...row, associatedBy: actor(row.associatedByUserId) }
              : row,
          ),
      create: async ({
        data,
        include,
      }: {
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const row = { ...data };
        associations.push(row);
        return include
          ? { ...row, associatedBy: actor(row.associatedByUserId) }
          : row;
      },
      update: async ({
        where,
        data,
        include,
      }: {
        where: { patientRef: string };
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const row = associations.find(
          (item) => item.patientRef === where.patientRef,
        );
        if (!row) throw new Error('missing association');
        Object.assign(row, data);
        return include
          ? { ...row, associatedBy: actor(row.associatedByUserId) }
          : row;
      },
    },
    confirmationAuditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: auditSeq++, ...data };
        audits.push(row);
        return row;
      },
      findMany: async ({
        where,
        include,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        include?: Record<string, unknown>;
        orderBy?: unknown;
      }) =>
        sort(
          audits.filter((row) => match(row, where)),
          orderBy,
        ).map((row) =>
          include ? { ...row, actor: actor(row.actorUserId) } : row,
        ),
    },
    confirmationCampaign: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        campaigns.find((row) => match(row, where)) ?? null,
      findMany: async ({
        include,
        orderBy,
      }: {
        include?: Record<string, unknown>;
        orderBy?: unknown;
      }) =>
        sort(campaigns, orderBy).map((row) =>
          include ? decorateCampaign(row) : row,
        ),
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: number };
        include?: unknown;
      }) => {
        const row = campaigns.find((item) => item.id === where.id);
        return row && include ? decorateCampaign(row) : (row ?? null);
      },
      findUniqueOrThrow: async ({
        where,
        include,
      }: {
        where: { id: number };
        include?: unknown;
      }) => {
        const row = campaigns.find((item) => item.id === where.id);
        if (!row) throw new Error('missing campaign');
        return include ? decorateCampaign(row) : row;
      },
      create: async ({
        data,
        include,
      }: {
        data: Record<string, unknown>;
        include?: unknown;
      }) => {
        const id = campaignSeq++;
        const nestedItems = (
          (
            data.items as
              | { create?: Array<Record<string, unknown>> }
              | undefined
          )?.create ?? []
        ).map((item) => ({ id: itemSeq++, campaignId: id, ...item }));
        const nestedEvent = (
          data.events as { create?: Record<string, unknown> } | undefined
        )?.create;
        const events = nestedEvent
          ? [{ id: eventSeq++, campaignId: id, ...nestedEvent }]
          : [];
        const row = {
          id,
          approvedByUserId: null,
          approvedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
          campaignDate: data.campaignDate,
          source: data.source,
          status: data.status,
          appointmentsAnalyzed: data.appointmentsAnalyzed,
          eligibleRecipients: data.eligibleRecipients,
          pendingVerifications: data.pendingVerifications,
          unavailableRecipients: data.unavailableRecipients,
          consultationState: data.consultationState ?? 'NOT_CONNECTED',
          consultationReason: data.consultationReason ?? null,
          createdByUserId: data.createdByUserId,
          items: nestedItems,
          events,
        };
        campaigns.push(row);
        return include ? decorateCampaign(row) : row;
      },
      update: async ({
        where,
        data,
        include,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
        include?: unknown;
      }) => {
        const row = campaigns.find((item) => item.id === where.id);
        if (!row) throw new Error('missing campaign');
        const nestedEvent = (
          data.events as { create?: Record<string, unknown> } | undefined
        )?.create;
        if (nestedEvent) {
          (row.events as Array<Record<string, unknown>>).push({
            id: eventSeq++,
            campaignId: row.id,
            ...nestedEvent,
          });
        }
        const nestedItems = (
          data.items as { create?: Array<Record<string, unknown>> } | undefined
        )?.create;
        if (nestedItems) {
          row.items = nestedItems.map((item) => ({
            id: itemSeq++,
            campaignId: row.id,
            ...item,
          }));
        }
        const rest = { ...data };
        delete rest.events;
        delete rest.items;
        Object.assign(row, rest, { updatedAt: NOW });
        return include ? decorateCampaign(row) : row;
      },
    },
    confirmationCampaignItem: {
      deleteMany: async ({ where }: { where: { campaignId: number } }) => {
        const row = campaigns.find((item) => item.id === where.campaignId);
        const count = ((row?.items as unknown[]) ?? []).length;
        if (row) row.items = [];
        return { count };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        for (const campaign of campaigns) {
          const item = (campaign.items as Array<Record<string, unknown>>).find(
            (entry) => entry.id === where.id,
          );
          if (item) {
            Object.assign(item, data);
            return item;
          }
        }
        throw new Error('missing item');
      },
    },
    $queryRaw: async () => [],
    confirmationApprovalSnapshot: { create: async () => ({}) },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
  };

  return { prisma, verifications, authorizations, audits, campaigns };
}

const offlineIdentity: CampaignIdentityClient = {
  async identify() {
    throw new Error('source_not_configured');
  },
  async searchPatients() {
    throw new Error('source_not_configured');
  },
};

function serviceFor(
  store: ReturnType<typeof memory>,
  sources?: AppointmentSource[],
  classifier?: CampaignContactClassifier,
  identity: CampaignIdentityClient = offlineIdentity,
) {
  return new ConfirmationAdminService(
    store.prisma as never,
    sources ? new AppointmentSourceRegistry(sources) : undefined,
    () => NOW,
    classifier,
    identity,
  );
}

function inform(
  service: ConfirmationAdminService,
  phone = PHONE_A,
  role: ContactSubjectRole = ContactSubjectRole.PATIENT,
) {
  return service.informVerification(receptionist, {
    patientRef: PATIENT,
    recipientRef: RECIPIENT,
    informedPhoneRef: phone,
    role,
    origin: ContactOrigin.IN_PERSON,
  });
}

describe('ConfirmationAdminService', () => {
  it('recusa escrita de token de serviço e de papel desatualizado no banco', async () => {
    const store = memory();
    const service = serviceFor(store);

    await expect(
      service.informVerification(serviceToken, {
        patientRef: PATIENT,
        recipientRef: RECIPIENT,
        informedPhoneRef: PHONE_A,
        role: ContactSubjectRole.PATIENT,
        origin: ContactOrigin.PHONE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.informVerification(staleAdmin, {
        patientRef: PATIENT,
        recipientRef: RECIPIENT,
        informedPhoneRef: PHONE_A,
        role: ContactSubjectRole.PATIENT,
        origin: ContactOrigin.WHATSAPP,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.verifications).toHaveLength(0);
  });

  it('não trata o contato informado como titularidade verificada', async () => {
    const store = memory();
    const service = serviceFor(store);
    const informed = await inform(service);

    expect(informed.status).toBe(ContactVerificationStatus.INFORMED);
    expect(informed.verifiedPhoneRef).toBeNull();
    expect(informed.ownershipProven).toBe(false);

    const resolver = await service.readForResolver(PATIENT);
    expect(resolver.ownership).toHaveLength(0);
  });

  it('exige novo registro quando a referência do telefone muda', async () => {
    const store = memory();
    const service = serviceFor(store);
    const informed = await inform(service, PHONE_A);
    await service.verifyContact(receptionist, informed.id, {
      procedure: ContactVerificationProcedure.DOCUMENT_PRESENTED,
      legalGuardianVerified: false,
    });
    await inform(service, PHONE_B);

    const resolver = await service.readForResolver(PATIENT);
    expect(resolver.ownership.map((item) => item.phoneRef)).toEqual([PHONE_A]);
    expect(
      store.verifications.find((row) => row.informedPhoneRef === PHONE_B)
        ?.status,
    ).toBe(ContactVerificationStatus.INFORMED);
  });

  it('não verifica responsável legal sem a checagem explícita', async () => {
    const service = serviceFor(memory());
    const informed = await inform(
      service,
      PHONE_A,
      ContactSubjectRole.GUARDIAN,
    );

    await expect(
      service.verifyContact(admin, informed.id, {
        procedure: ContactVerificationProcedure.GUARDIAN_PRESENT,
        legalGuardianVerified: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const resolver = await service.readForResolver(PATIENT);
    expect(resolver.ownership).toHaveLength(0);
  });

  it('revoga autorização sem apagar e sem mantê-la ativa para o resolvedor', async () => {
    const store = memory();
    const service = serviceFor(store);
    const grant = await service.recordAuthorization(receptionist, {
      patientRef: PATIENT,
      recipientRef: RECIPIENT,
      purpose: 'appointment_contact',
      channel: 'whatsapp',
      legalBasis: 'clinic.basis.example',
      validFrom: '2026-11-01T00:00:00Z',
      expiresAt: '2026-12-01T00:00:00Z',
    });
    expect(grant.grantsOwnership).toBe(false);

    const revoked = await service.revokeAuthorization(admin, grant.id);
    const again = await service.revokeAuthorization(receptionist, grant.id);

    expect(revoked.revokedAt).toBe('2026-11-03T15:00:00Z');
    expect(revoked.revokedBy).toEqual({ id: 8, name: 'Admin' });
    expect(again.revokedBy).toEqual({ id: 8, name: 'Admin' });
    const resolver = await service.readForResolver(PATIENT);
    expect(resolver.authorization[0]?.revokedAt).toBe('2026-11-03T15:00:00Z');
    expect(store.authorizations).toHaveLength(1);
  });

  it('associa a referência opaca sem copiar dados cadastrais do paciente', async () => {
    const store = memory();
    const service = serviceFor(store);
    const linked = await service.associateSubject(receptionist, {
      patientRef: PATIENT,
      higiaPatientId: 4,
    });

    expect(linked.higiaPatientId).toBe(4);
    expect(linked).not.toHaveProperty('phone');
    expect(JSON.stringify(linked)).not.toMatch(/cpf|telefone|password/i);
    await expect(
      service.associateSubject(receptionist, {
        patientRef: PATIENT,
        higiaPatientId: 99,
      }),
    ).rejects.toThrow('Paciente do Higia não encontrado.');
  });

  it('aprovação sem horários elegíveis não promove destinatário nem cria autorização', async () => {
    const store = memory();
    const service = serviceFor(store, [new HigiaAppointmentSource()]);
    const created = await service.createCampaign(receptionist, {
      campaignDate: '2026-11-04',
      source: CampaignSourceKey.HIGIA,
      items: [
        item('appointment:pending', CampaignRecipientState.PENDING),
        item('appointment:unavailable', CampaignRecipientState.UNAVAILABLE),
      ],
    });
    expect(created.dispatchEnabled).toBe(false);
    expect(created.pendingVerifications).toBe(1);
    expect(created.unavailableRecipients).toBe(1);

    const reviewed = await service.submitReview(receptionist, created.id);
    await expect(service.approve(admin, reviewed.id)).rejects.toBeInstanceOf(BadRequestException);
    const approved = await service.getCampaign(reviewed.id);

    expect(approved.status).toBe(CampaignAdminStatus.IN_REVIEW);
    expect(approved.items.map((entry) => entry.recipientState)).toEqual([
      CampaignRecipientState.PENDING,
      CampaignRecipientState.UNAVAILABLE,
    ]);
    expect(store.authorizations).toHaveLength(0);
    expect(approved.events.map((event) => event.action)).toEqual([
      'CAMPAIGN_CREATED',
      'CAMPAIGN_SUBMITTED',
    ]);
  });

  it('usa itens da origem quando ela estiver conectada e não dispara envio', async () => {
    const connected: AppointmentSource = {
      key: CampaignSourceKey.HIGIA,
      label: 'Higia futuro',
      load: async () => ({
        connected: true,
        availability: 'ready',
        reason: null,
        items: [
          item('appointment:from-source', CampaignRecipientState.ELIGIBLE),
        ],
      }),
    };
    const service = serviceFor(memory(), [connected]);
    const created = await service.createCampaign(admin, {
      campaignDate: '2026-11-05',
      source: CampaignSourceKey.HIGIA,
      items: [item('appointment:typed', CampaignRecipientState.PENDING)],
    });

    expect(created.items.map((entry) => entry.appointmentRef)).toEqual([
      'appointment:from-source',
    ]);
    expect(created.dispatchEnabled).toBe(false);
  });

  it('carrega a agenda do Saúde Vianet sem promover agendamento marcado', async () => {
    const store = memory();
    let consultations = 0;
    const source = new SaudeVianetAppointmentSource({
      load: async () => {
        consultations += 1;
        return {
          appointmentDate: '2099-04-02',
          state: 'ready',
          reason: null,
          items: [agendaItem(APPT_A, '09:30'), agendaItem(APPT_B, '11:00')],
        };
      },
      classify: async () => ({ items: [] }),
    });
    const classifier: CampaignContactClassifier = {
      classify: async () => [
        {
          appointmentRef: APPT_A,
          contactState: 'eligible',
          reasonCode: 'contact_ready',
        },
        {
          appointmentRef: APPT_B,
          contactState: 'eligible',
          reasonCode: 'contact_ready',
        },
      ],
    };
    const service = serviceFor(store, [source], classifier);
    const created = await service.createCampaign(admin, {
      campaignDate: '2099-04-02',
      source: CampaignSourceKey.SAUDEVIANET,
      items: [item('appointment:typed', CampaignRecipientState.ELIGIBLE)],
    });

    expect(consultations).toBe(1);
    expect(created.consultationState).toBe('READY');
    expect(created.eligibleRecipients).toBe(0);
    expect(created.pendingVerifications).toBe(2);
    expect(created.items.map((entry) => entry.recipientRef)).toEqual([
      RECIPIENT,
      RECIPIENT,
    ]);
    expect(created.items.map((entry) => entry.appointmentTime)).toEqual([
      '09:30',
      '11:00',
    ]);
    expect(created.dispatchEnabled).toBe(false);
    expect(JSON.stringify(created)).not.toMatch(/\+55|cpf|telefone/i);

    const withSeconds = serviceFor(memory(), [
      new SaudeVianetAppointmentSource({
        load: async () => ({
          appointmentDate: '2099-04-03',
          state: 'ready',
          reason: null,
          items: [agendaItem(APPT_A, '09:30:00')],
        }),
        classify: async () => ({ items: [] }),
      }),
    ]);
    const stored = await withSeconds.createCampaign(admin, {
      campaignDate: '2099-04-03',
      source: CampaignSourceKey.SAUDEVIANET,
    });
    expect(stored.items.map((entry) => entry.appointmentTime)).toEqual(['09:30']);

    const informed = await inform(service);
    await service.verifyContact(admin, informed.id, {
      procedure: ContactVerificationProcedure.DOCUMENT_PRESENTED,
      legalGuardianVerified: false,
    });
    const refreshed = await service.getCampaign(created.id);
    expect(refreshed.items.map((entry) => entry.recipientState)).toEqual([
      CampaignRecipientState.ELIGIBLE,
      CampaignRecipientState.ELIGIBLE,
    ]);

    classifier.classify = async () => [
      {
        appointmentRef: APPT_A,
        contactState: 'pending',
        reasonCode: 'ownership_revoked',
      },
      {
        appointmentRef: APPT_B,
        contactState: 'pending',
        reasonCode: 'ownership_revoked',
      },
    ];
    const verified = store.verifications.find(
      (row) => row.status === ContactVerificationStatus.VERIFIED,
    );
    await service.revokeVerification(admin, String(verified?.id));
    const revoked = await service.getCampaign(created.id);
    expect(revoked.eligibleRecipients).toBe(0);
    expect(revoked.items.map((entry) => entry.reasonCode)).toEqual([
      'ownership_revoked',
      'ownership_revoked',
    ]);
    expect(revoked.events.map((event) => event.action)).toContain(
      'ITEM_RECLASSIFIED',
    );
    expect(store.authorizations).toHaveLength(0);
  });

  it('distingue agenda vazia de falha e rejeita telefone na consulta', async () => {
    const empty = new SaudeVianetAppointmentSource({
      load: async () => ({
        appointmentDate: '2099-04-03',
        state: 'empty',
        reason: null,
        items: [],
      }),
      classify: async () => ({ items: [] }),
    });
    const failed = new SaudeVianetAppointmentSource({
      load: async () => ({
        appointmentDate: '2099-04-04',
        state: 'failed',
        reason: 'query_failed',
        items: [],
      }),
      classify: async () => ({ items: [] }),
    });
    const leaked = new SaudeVianetAppointmentSource({
      load: async () => ({
        appointmentDate: '2099-04-05',
        state: 'ready',
        reason: null,
        phone: '+5511900000001',
        items: [agendaItem(APPT_A, '09:30')],
      }),
      classify: async () => ({ items: [] }),
    });
    const emptyCampaign = await serviceFor(memory(), [empty]).createCampaign(
      admin,
      {
        campaignDate: '2099-04-03',
        source: CampaignSourceKey.SAUDEVIANET,
      },
    );
    const failedCampaign = await serviceFor(memory(), [failed]).createCampaign(
      admin,
      {
        campaignDate: '2099-04-04',
        source: CampaignSourceKey.SAUDEVIANET,
      },
    );
    const leakedCampaign = await serviceFor(memory(), [leaked]).createCampaign(
      admin,
      {
        campaignDate: '2099-04-05',
        source: CampaignSourceKey.SAUDEVIANET,
      },
    );

    expect(emptyCampaign.consultationState).toBe('EMPTY');
    expect(emptyCampaign.items).toHaveLength(0);
    expect(failedCampaign.consultationState).toBe('FAILED');
    expect(failedCampaign.consultationReason).toBe('query_failed');
    expect(failedCampaign.eligibleRecipients).toBe(0);
    expect(leakedCampaign.consultationState).toBe('FAILED');
    expect(leakedCampaign.items).toHaveLength(0);
    expect(leakedCampaign.eligibleRecipients).toBe(0);
  });

  it('rejeita telefone no corpo da verificação', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        {
          patientRef: PATIENT,
          recipientRef: RECIPIENT,
          informedPhoneRef: PHONE_A,
          role: ContactSubjectRole.PATIENT,
          origin: ContactOrigin.IN_PERSON,
          phone: '+5511900000000',
        },
        { type: 'body', metatype: InformVerificationDto },
      ),
    ).rejects.toThrow();
  });

  it('não contém chamada de envio no módulo administrativo', () => {
    const directory = join(__dirname);
    const files = [
      'confirmation-admin.service.ts',
      'confirmation-admin.controller.ts',
      'appointment-source.ts',
    ];
    const source = files
      .map((file) => readFileSync(join(directory, file), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /chatwoot|confirmations:dispatch|graph\.facebook|sendMessage|whatsapp\.com/i,
    );
    expect(source).toContain('dispatchEnabled: false');
  });

  it('impede repetir a verificação no mesmo registro para outro número', async () => {
    const service = serviceFor(memory());
    const informed = await inform(service);
    await service.verifyContact(receptionist, informed.id, {
      procedure: ContactVerificationProcedure.CALLBACK,
      legalGuardianVerified: false,
    });
    await expect(
      service.verifyContact(receptionist, informed.id, {
        procedure: ContactVerificationProcedure.CALLBACK,
        legalGuardianVerified: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sobe o módulo com a origem dos agendamentos registrada', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfirmationAdminModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(ConfirmationAdminService)).toBeInstanceOf(
      ConfirmationAdminService,
    );
    expect(
      moduleRef
        .get(AppointmentSourceRegistry)
        .get(CampaignSourceKey.SAUDEVIANET).key,
    ).toBe(CampaignSourceKey.SAUDEVIANET);
    await moduleRef.close();
  });

  it('mostra o nome e o telefone mascarado sem alterar a classificação', async () => {
    const store = memory();
    const source = new SaudeVianetAppointmentSource({
      load: async () => ({
        appointmentDate: '2099-04-02',
        state: 'ready',
        reason: null,
        items: [agendaItem(APPT_A, '09:30'), agendaItem(APPT_B, '11:00')],
      }),
      classify: async () => ({ items: [] }),
    });
    const identity: CampaignIdentityClient = {
      async identify() {
        return {
          state: 'ready',
          items: [APPT_A, APPT_B].map((appointmentRef) => ({
            appointmentRef,
            displayName: 'Ana Exemplo',
            maskedPhone: '(11) 9****-0001',
            phoneStatus: 'available',
            professionalName: 'Dra. Exemplo',
          })),
        };
      },
      async searchPatients() {
        throw new Error('não deve pesquisar ao abrir a campanha');
      },
    };
    const service = serviceFor(store, [source], undefined, identity);
    const created = await service.createCampaign(admin, {
      campaignDate: '2099-04-02',
      source: CampaignSourceKey.SAUDEVIANET,
    });
    const detail = await service.getCampaign(created.id);

    expect(detail.items.map((item) => item.displayName)).toEqual([
      'Ana Exemplo',
      'Ana Exemplo',
    ]);
    expect(detail.items.map((item) => item.maskedPhone)).toEqual([
      '(11) 9****-0001',
      '(11) 9****-0001',
    ]);
    expect(detail.items.map((item) => item.recipientState)).toEqual([
      CampaignRecipientState.PENDING,
      CampaignRecipientState.PENDING,
    ]);
    expect(detail.dispatchEnabled).toBe(false);
    expect(JSON.stringify(detail)).not.toMatch(/\+55/);
  });

  it('recusa telefone completo e não promove o destinatário', () => {
    expect(
      mapCampaignIdentity({
        state: 'ready',
        items: [
          {
            appointmentRef: APPT_A,
            displayName: 'Ana Exemplo',
            maskedPhone: '+5511900000001',
            phoneStatus: 'available',
          },
        ],
      }),
    ).toBeNull();
    expect(
      mapPatientSearch({
        state: 'ready',
        truncated: false,
        people: [
          {
            displayName: 'Ana Exemplo',
            maskedPhone: '(11) 9****-0001',
            phoneStatus: 'available',
            patientRef: PATIENT,
            recipientRef: RECIPIENT,
            phoneRef: '+5511900000001',
          },
        ],
      }),
    ).toBeNull();
  });

  it('lista homônimos sem escolher um e sem aceitar token de leitura', async () => {
    const store = memory();
    const source = new SaudeVianetAppointmentSource({
      load: async () => ({
        appointmentDate: '2099-04-02',
        state: 'empty',
        reason: null,
        items: [],
      }),
      classify: async () => ({ items: [] }),
    });
    const calls: string[] = [];
    const otherPatient = `patient:v1:clinic:${'ef'.repeat(32)}`;
    const otherRecipient = `recipient:v1:clinic:${'ef'.repeat(32)}`;
    const identity: CampaignIdentityClient = {
      async identify() {
        return { state: 'empty', items: [] };
      },
      async searchPatients(name) {
        calls.push(name);
        return {
          state: 'ready',
          truncated: false,
          people: [
            {
              displayName: 'Ana Exemplo',
              maskedPhone: '(11) 9****-0001',
              phoneStatus: 'available',
              patientRef: PATIENT,
              recipientRef: RECIPIENT,
              phoneRef: PHONE_A,
            },
            {
              displayName: 'Ana Exemplo',
              maskedPhone: '(11) 9****-0003',
              phoneStatus: 'available',
              patientRef: otherPatient,
              recipientRef: otherRecipient,
              phoneRef: PHONE_B,
            },
          ],
        };
      },
    };
    const service = serviceFor(store, [source], undefined, identity);
    await service.createCampaign(admin, {
      campaignDate: '2099-04-02',
      source: CampaignSourceKey.SAUDEVIANET,
    });

    const found = await service.searchPatients(receptionist, 'Ana');
    expect(calls).toEqual(['Ana']);
    expect(found.people).toHaveLength(2);
    expect(found.people.map((person) => person.patientRef)).toEqual([
      PATIENT,
      otherPatient,
    ]);
    expect(found.dispatchEnabled).toBe(false);
    await expect(service.searchPatients(serviceToken, 'Ana')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(calls).toEqual(['Ana']);
  });

  it('separa falha de agenda dos agendamentos e não a torna apta', async () => {
    const source = new SaudeVianetAppointmentSource({
      load: async () => ({
        appointmentDate: '2099-04-04',
        state: 'partial',
        reason: 'partial_consultation',
        registry: 'unavailable',
        items: [agendaItem(APPT_A, '09:30')],
        failures: [
          {
            appointmentRef: `fail:v1:validation:${'a'.repeat(64)}`,
            professionalRef: 'prof.ana',
            appointmentTime: null,
            agendaRef: 'agenda.falha',
            patientRef: null,
            recipientRef: null,
            phoneRef: null,
            isMinor: null,
            resolution: 'ambiguous',
            contactState: 'unavailable',
            reasonCode: 'unexpected_response',
          },
        ],
      }),
      classify: async () => ({ items: [] }),
    });
    const created = await serviceFor(memory(), [source]).createCampaign(admin, {
      campaignDate: '2099-04-04',
      source: CampaignSourceKey.SAUDEVIANET,
    });

    expect(created.consultationState).toBe('PARTIAL');
    expect(created.consultationReason).toBe('partial_consultation');
    expect(created.appointmentsAnalyzed).toBe(1);
    expect(created.technicalFailures).toBe(1);
    expect(created.items).toHaveLength(2);
    expect(created.eligibleRecipients).toBe(0);
    expect(created.unavailableRecipients).toBe(0);
    expect(created.pendingVerifications).toBe(1);
    expect(created.dispatchEnabled).toBe(false);
  });
});

function agendaItem(appointmentRef: string, appointmentTime: string) {
  return {
    appointmentRef,
    professionalRef: 'prof.ana',
    appointmentTime,
    agendaRef: 'agenda.exemplo',
    patientRef: PATIENT,
    recipientRef: RECIPIENT,
    phoneRef: PHONE_A,
    isMinor: false,
    resolution: 'candidate',
    contactState: 'pending',
    reasonCode: 'verification_missing',
  };
}

function item(appointmentRef: string, recipientState: CampaignRecipientState) {
  return {
    appointmentRef,
    patientRef: PATIENT,
    recipientRef: RECIPIENT,
    informedPhoneRef: PHONE_A,
    recipientState,
    reasonCode: 'verification_missing',
  };
}
