import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalAppointmentProcedureOrigin,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  Prisma,
  ScheduleExceptionKind,
  TissGuideType,
  UserRole,
} from '@prisma/client';
import {
  addCalendarDaysYmd,
  saoPauloClock,
  startOfDaySaoPaulo,
  todayYmdSaoPaulo,
  weekdayFromYmd,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { resolveEffectiveBlocks } from '../health-professionals/schedule-intervals';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../uploads/file-storage.service';
import { UploadedFile } from '../uploads/uploaded-file';
import { CreateInsuranceGuideDto } from './dto/create-insurance-guide.dto';
import { guideDocumentFileName } from './guide-document-name';
import { InsuranceGuideProcedureInputDto } from './dto/insurance-guide-procedure-input.dto';
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  groupGuideSessions,
  nextFreeMinute,
} from './guide-session-schedule';
import { ListInsuranceGuidesQueryDto } from './dto/list-insurance-guides-query.dto';
import { UpdateInsuranceGuideDto } from './dto/update-insurance-guide.dto';

const guideInclude = {
  healthPlan: true,
  patient: true,
  healthProfessional: true,
  procedures: {
    include: {
      procedure: { include: { specialty: true, healthPlanPrices: true } },
    },
  },
  billingBatchGuide: { select: { billingBatchId: true } },
  documents: { orderBy: { id: 'asc' as const } },
} as const;

type GuideDb = Prisma.TransactionClient | PrismaService;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

@Injectable()
export class InsuranceGuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async create(
    createInsuranceGuideDto: CreateInsuranceGuideDto,
    tx?: Prisma.TransactionClient,
    currentUser?: { role: UserRole },
  ) {
    const hasSessions = this.hasSessionDates(createInsuranceGuideDto.procedures);
    if (tx) {
      return this.persistCreate(createInsuranceGuideDto, tx, currentUser, hasSessions);
    }
    if (hasSessions) {
      return this.prisma.$transaction((inner) =>
        this.persistCreate(createInsuranceGuideDto, inner, currentUser, true),
      );
    }
    return this.persistCreate(
      createInsuranceGuideDto,
      this.prisma,
      currentUser,
      false,
    );
  }

  private async persistCreate(
    createInsuranceGuideDto: CreateInsuranceGuideDto,
    db: GuideDb,
    currentUser: { role: UserRole } | undefined,
    hasSessions: boolean,
  ) {
    if (!hasSessions) {
      this.assertManualUsedQuantity(
        createInsuranceGuideDto.procedures,
        currentUser,
      );
    }
    const authorizationDate =
      createInsuranceGuideDto.authorizationDate !== undefined
        ? new Date(createInsuranceGuideDto.authorizationDate)
        : this.startOfUtcDay();
    if (hasSessions) {
      this.assertSessionDates(
        createInsuranceGuideDto.procedures,
        authorizationDate.toISOString().slice(0, 10),
        todayYmdSaoPaulo(),
        currentUser,
      );
    }
    const healthPlan = await this.ensureHealthPlanExists(
      createInsuranceGuideDto.healthPlanId,
      db,
    );
    await this.ensurePatientExists(createInsuranceGuideDto.patientId, db);
    await this.ensureHealthProfessionalExists(
      createInsuranceGuideDto.healthProfessionalId,
      db,
    );
    const { values: procedureValues, tissGuideType } =
      await this.ensureGuideProceduresValid(
        {
          healthPlanId: createInsuranceGuideDto.healthPlanId,
          healthProfessionalId: createInsuranceGuideDto.healthProfessionalId,
          procedures: createInsuranceGuideDto.procedures,
        },
        db,
      );

    const expirationDate =
      createInsuranceGuideDto.expirationDate !== undefined
        ? new Date(createInsuranceGuideDto.expirationDate)
        : this.addUtcDays(authorizationDate, healthPlan.submissionDeadlineDays);

    try {
      const created = await db.insuranceGuide.create({
        data: {
          healthPlanId: createInsuranceGuideDto.healthPlanId,
          patientId: createInsuranceGuideDto.patientId,
          healthProfessionalId: createInsuranceGuideDto.healthProfessionalId,
          authorizationDate,
          expirationDate,
          authorizationPassword: this.normalizeAuthorizationPassword(
            createInsuranceGuideDto.authorizationPassword,
          ),
          tissGuideType,
          ...(createInsuranceGuideDto.guideNumber !== undefined && {
            guideNumber: this.normalizeGuideNumber(
              createInsuranceGuideDto.guideNumber,
            ),
          }),
          ...(createInsuranceGuideDto.status !== undefined && {
            status: createInsuranceGuideDto.status,
          }),
          procedures: {
            create: createInsuranceGuideDto.procedures.map((item) => ({
              procedureId: item.procedureId,
              authorizedQuantity: item.authorizedQuantity,
              usedQuantity: hasSessions ? 0 : (item.usedQuantity ?? 0),
              value: item.value ?? procedureValues.get(item.procedureId)!,
            })),
          },
        },
        include: guideInclude,
      });
      if (!hasSessions) return created;
      await this.createFinishedSessions(db, {
        insuranceGuideId: created.id,
        patientId: createInsuranceGuideDto.patientId,
        healthProfessionalId: createInsuranceGuideDto.healthProfessionalId,
        procedures: createInsuranceGuideDto.procedures,
      });
      return db.insuranceGuide.findUniqueOrThrow({
        where: { id: created.id },
        include: guideInclude,
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  async findAll(
    query: ListInsuranceGuidesQueryDto,
  ): Promise<
    ListEnvelope<
      Prisma.InsuranceGuideGetPayload<{ include: typeof guideInclude }>
    >
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.InsuranceGuideWhereInput = {
      ...(query.isBilled !== undefined && { isBilled: query.isBilled }),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.patientId !== undefined && { patientId: query.patientId }),
      ...(query.healthProfessionalId !== undefined && {
        healthProfessionalId: query.healthProfessionalId,
      }),
      ...(query.healthPlanId !== undefined && {
        healthPlanId: query.healthPlanId,
      }),
      ...(query.availableForBilling === true && {
        isBilled: false,
        billingBatchGuide: { is: null },
        procedures: { some: { usedQuantity: { gt: 0 } } },
      }),
      ...(query.withoutAppointment === true && {
        clinicalAppointmentGuides: { none: {} },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.insuranceGuide.findMany({
        where,
        orderBy: { id: 'asc' },
        include: guideInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.insuranceGuide.count({ where }),
    ]);

    return {
      data,
      meta: buildListMeta(page, limit, total),
    };
  }

  async findOne(id: number) {
    const guide = await this.prisma.insuranceGuide.findUnique({
      where: { id },
      include: guideInclude,
    });

    if (!guide) {
      throw new NotFoundException(`Insurance guide ${id} not found`);
    }

    return guide;
  }

  async update(id: number, updateInsuranceGuideDto: UpdateInsuranceGuideDto) {
    const existing = await this.findOne(id);

    if (updateInsuranceGuideDto.healthPlanId !== undefined) {
      await this.ensureHealthPlanExists(updateInsuranceGuideDto.healthPlanId);
    }

    if (updateInsuranceGuideDto.patientId !== undefined) {
      await this.ensurePatientExists(updateInsuranceGuideDto.patientId);
    }

    if (updateInsuranceGuideDto.healthProfessionalId !== undefined) {
      await this.ensureHealthProfessionalExists(
        updateInsuranceGuideDto.healthProfessionalId,
      );
    }

    const healthPlanId =
      updateInsuranceGuideDto.healthPlanId ?? existing.healthPlanId;
    const healthProfessionalId =
      updateInsuranceGuideDto.healthProfessionalId ??
      existing.healthProfessionalId;
    const procedures =
      updateInsuranceGuideDto.procedures ??
      existing.procedures.map((item) => ({
        procedureId: item.procedureId,
        authorizedQuantity: item.authorizedQuantity,
      }));

    const shouldRevalidateProcedures =
      updateInsuranceGuideDto.procedures !== undefined ||
      updateInsuranceGuideDto.healthPlanId !== undefined ||
      updateInsuranceGuideDto.healthProfessionalId !== undefined;

    let procedureValues = new Map<number, Prisma.Decimal>();
    let tissGuideType = existing.tissGuideType;
    if (shouldRevalidateProcedures) {
      const validated = await this.ensureGuideProceduresValid({
        healthPlanId,
        healthProfessionalId,
        procedures,
      });
      procedureValues = validated.values;
      tissGuideType = validated.tissGuideType;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (updateInsuranceGuideDto.procedures !== undefined) {
          await this.syncGuideProcedures(
            tx,
            id,
            existing.procedures,
            updateInsuranceGuideDto.procedures,
            procedureValues,
          );
        }

        if (
          updateInsuranceGuideDto.healthPlanId !== undefined &&
          updateInsuranceGuideDto.healthPlanId !== existing.healthPlanId
        ) {
          await this.refreshGuideProcedureValues(
            tx,
            id,
            procedures.map((item) => item.procedureId),
            procedureValues,
          );
        }

        return tx.insuranceGuide.update({
          where: { id },
          data: {
            ...(updateInsuranceGuideDto.healthPlanId !== undefined && {
              healthPlanId: updateInsuranceGuideDto.healthPlanId,
            }),
            ...(updateInsuranceGuideDto.patientId !== undefined && {
              patientId: updateInsuranceGuideDto.patientId,
            }),
            ...(updateInsuranceGuideDto.healthProfessionalId !== undefined && {
              healthProfessionalId:
                updateInsuranceGuideDto.healthProfessionalId,
            }),
            ...(updateInsuranceGuideDto.authorizationDate !== undefined && {
              authorizationDate: new Date(
                updateInsuranceGuideDto.authorizationDate,
              ),
            }),
            ...(updateInsuranceGuideDto.expirationDate !== undefined && {
              expirationDate: new Date(updateInsuranceGuideDto.expirationDate),
            }),
            ...(updateInsuranceGuideDto.guideNumber !== undefined && {
              guideNumber: this.normalizeGuideNumber(
                updateInsuranceGuideDto.guideNumber,
              ),
            }),
            ...(updateInsuranceGuideDto.authorizationPassword !== undefined && {
              authorizationPassword: this.normalizeAuthorizationPassword(
                updateInsuranceGuideDto.authorizationPassword,
              ),
            }),
            ...(updateInsuranceGuideDto.status !== undefined && {
              status: updateInsuranceGuideDto.status,
            }),
            ...(shouldRevalidateProcedures && { tissGuideType }),
          },
          include: guideInclude,
        });
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  async remove(id: number) {
    const guide = await this.findOne(id);
    for (const document of guide.documents) {
      await this.fileStorage.remove(document.storageKey);
    }

    try {
      return await this.prisma.insuranceGuide.delete({
        where: { id },
        include: guideInclude,
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  async addDocument(id: number, file: UploadedFile | undefined) {
    const guide = await this.findOne(id);
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const mimeType = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        'Only PDF, JPEG and PNG documents are allowed',
      );
    }

    const originalName = guideDocumentFileName({
      guideNumber: guide.guideNumber,
      guideId: guide.id,
      originalName: file.originalname,
      mimeType,
      existingNames: guide.documents.map((item) => item.originalName),
    });
    const storageKey = await this.fileStorage.saveGuideFile(id, {
      ...file,
      originalname: originalName,
      mimetype: mimeType,
    });
    return this.prisma.insuranceGuideDocument.create({
      data: {
        insuranceGuideId: id,
        originalName,
        storageKey,
        mimeType,
        sizeBytes: file.size,
      },
    });
  }

  async openDocument(guideId: number, documentId: number) {
    await this.findOne(guideId);
    const document = await this.prisma.insuranceGuideDocument.findFirst({
      where: { id: documentId, insuranceGuideId: guideId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return {
      document,
      stream: await this.fileStorage.getStream(document.storageKey),
    };
  }

  async removeDocument(guideId: number, documentId: number) {
    const guide = await this.findOne(guideId);
    const document = guide.documents.find((item) => item.id === documentId);
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    await this.fileStorage.remove(document.storageKey);
    return this.prisma.insuranceGuideDocument.delete({
      where: { id: documentId },
    });
  }

  private hasSessionDates(procedures: InsuranceGuideProcedureInputDto[]): boolean {
    return procedures.some((item) => (item.sessionDates?.length ?? 0) > 0);
  }

  private assertSessionDates(
    procedures: InsuranceGuideProcedureInputDto[],
    authorizationYmd: string,
    todayYmd: string,
    currentUser?: { role: UserRole },
  ) {
    if (
      currentUser?.role !== UserRole.ADMIN &&
      currentUser?.role !== UserRole.RECEPTIONIST
    ) {
      throw new ForbiddenException(
        'Only admins and receptionists can register realized sessions',
      );
    }

    for (const item of procedures) {
      const dates = item.sessionDates ?? [];
      if (dates.length > item.authorizedQuantity) {
        throw new BadRequestException(
          `sessionDates for procedure ${item.procedureId} cannot exceed authorizedQuantity ${item.authorizedQuantity}`,
        );
      }
      for (const date of dates) {
        if (date < authorizationYmd || date > todayYmd) {
          throw new BadRequestException(
            `Session date ${date} for procedure ${item.procedureId} must be between the authorization date and today`,
          );
        }
      }
    }
  }

  private normalizeAuthorizationPassword(
    value: string | null | undefined,
  ): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private async createFinishedSessions(
    db: GuideDb,
    params: {
      insuranceGuideId: number;
      patientId: number;
      healthProfessionalId: number;
      procedures: InsuranceGuideProcedureInputDto[];
    },
  ) {
    const slots = groupGuideSessions(params.procedures);
    if (slots.length === 0) return;

    const procedureIds = [
      ...new Set(slots.flatMap((slot) => slot.procedureIds)),
    ];
    const dates = [...new Set(slots.map((slot) => slot.date))].sort();
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    const [rules, weekly, exceptions, existing] = await Promise.all([
      db.professionalScheduleRule.findMany({
        where: {
          healthProfessionalId: params.healthProfessionalId,
          procedureId: { in: procedureIds },
        },
        select: { procedureId: true, durationMinutes: true },
      }),
      db.professionalWeeklyBlock.findMany({
        where: { healthProfessionalId: params.healthProfessionalId },
      }),
      db.professionalDayException.findMany({
        where: {
          healthProfessionalId: params.healthProfessionalId,
          date: {
            gte: new Date(`${first}T00:00:00.000Z`),
            lte: new Date(`${last}T00:00:00.000Z`),
          },
        },
      }),
      db.clinicalAppointment.findMany({
        where: {
          healthProfessionalId: params.healthProfessionalId,
          status: { not: ClinicalAppointmentStatus.absent },
          scheduledAt: { lt: startOfDaySaoPaulo(addCalendarDaysYmd(last, 1)) },
          endsAt: { gt: startOfDaySaoPaulo(first) },
        },
        select: { scheduledAt: true, endsAt: true },
      }),
    ]);

    const durationByProcedure = new Map(
      rules.map((rule) => [rule.procedureId, rule.durationMinutes]),
    );
    const occupied = new Map<string, Array<{ start: number; end: number }>>();
    for (const appointment of existing) {
      this.addOccupiedInterval(
        occupied,
        appointment.scheduledAt,
        appointment.endsAt,
      );
    }

    for (const slot of slots) {
      const duration = Math.max(
        ...slot.procedureIds.map(
          (procedureId) =>
            durationByProcedure.get(procedureId) ??
            DEFAULT_SESSION_DURATION_MINUTES,
        ),
      );
      const minute = nextFreeMinute({
        durationMinutes: duration,
        occupiedMinutes: occupied.get(slot.date) ?? [],
        blockedMinutes: this.blocksForDate(slot.date, weekly, exceptions),
      });
      if (minute == null) {
        throw new BadRequestException(
          `No free time on ${slot.date} to register the guide session`,
        );
      }
      const scheduledAt = new Date(
        startOfDaySaoPaulo(slot.date).getTime() + minute * 60_000,
      );
      const endsAt = new Date(scheduledAt.getTime() + duration * 60_000);
      this.addOccupiedInterval(occupied, scheduledAt, endsAt);

      await db.clinicalAppointment.create({
        data: {
          patientId: params.patientId,
          healthProfessionalId: params.healthProfessionalId,
          scheduledAt,
          endsAt,
          status: ClinicalAppointmentStatus.finished,
          type: ClinicalAppointmentType.health_plan,
          notes: 'Sessão registrada a partir da guia',
          insuranceGuides: {
            create: [{ insuranceGuideId: params.insuranceGuideId }],
          },
          procedures: {
            create: slot.procedureIds.map((procedureId) => ({
              procedureId,
              origin: ClinicalAppointmentProcedureOrigin.health_plan,
              insuranceGuideId: params.insuranceGuideId,
            })),
          },
        },
      });

      for (const procedureId of slot.procedureIds) {
        const rows = await db.$executeRaw`
          UPDATE "insurance_guide_procedures"
          SET "used_quantity" = "used_quantity" + 1
          WHERE "insurance_guide_id" = ${params.insuranceGuideId}
            AND "procedure_id" = ${procedureId}
            AND "used_quantity" < "authorized_quantity"
        `;
        if (rows === 0) {
          throw new BadRequestException(
            `Procedure ${procedureId} has no remaining quantity on insurance guide ${params.insuranceGuideId}`,
          );
        }
      }
    }
  }

  private blocksForDate(
    date: string,
    weekly: Array<{ weekday: number; startMinute: number; endMinute: number }>,
    exceptions: Array<{
      date: Date;
      kind: ScheduleExceptionKind;
      startMinute: number;
      endMinute: number;
    }>,
  ) {
    const weekday = weekdayFromYmd(date);
    const ofDay = exceptions.filter(
      (item) => item.date.toISOString().slice(0, 10) === date,
    );
    return resolveEffectiveBlocks({
      weekly: weekly
        .filter((item) => item.weekday === weekday)
        .map((item) => ({
          startMinute: item.startMinute,
          endMinute: item.endMinute,
        })),
      releases: ofDay
        .filter((item) => item.kind === ScheduleExceptionKind.release)
        .map((item) => ({
          startMinute: item.startMinute,
          endMinute: item.endMinute,
        })),
      blocks: ofDay
        .filter((item) => item.kind === ScheduleExceptionKind.block)
        .map((item) => ({
          startMinute: item.startMinute,
          endMinute: item.endMinute,
        })),
    });
  }

  private addOccupiedInterval(
    occupied: Map<string, Array<{ start: number; end: number }>>,
    scheduledAt: Date,
    endsAt: Date,
  ) {
    const start = saoPauloClock(scheduledAt);
    const end = saoPauloClock(endsAt);
    const endMinute = end.ymd === start.ymd ? end.minutes : 24 * 60;
    const intervals = occupied.get(start.ymd) ?? [];
    intervals.push({ start: start.minutes, end: endMinute });
    occupied.set(start.ymd, intervals);
    if (end.ymd !== start.ymd && end.minutes > 0) {
      const next = occupied.get(end.ymd) ?? [];
      next.push({ start: 0, end: end.minutes });
      occupied.set(end.ymd, next);
    }
  }

  private assertManualUsedQuantity(
    procedures: InsuranceGuideProcedureInputDto[],
    currentUser?: { role: UserRole },
  ) {
    const usesQuantity = procedures.some((item) => (item.usedQuantity ?? 0) > 0);
    if (usesQuantity && currentUser?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only admins can set used quantity without an appointment',
      );
    }

    for (const item of procedures) {
      const usedQuantity = item.usedQuantity ?? 0;
      if (usedQuantity > item.authorizedQuantity) {
        throw new BadRequestException(
          `usedQuantity for procedure ${item.procedureId} cannot exceed authorizedQuantity ${item.authorizedQuantity}`,
        );
      }
    }
  }

  private async syncGuideProcedures(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    existing: Array<{
      procedureId: number;
      authorizedQuantity: number;
      usedQuantity: number;
    }>,
    incoming: InsuranceGuideProcedureInputDto[],
    procedureValues: Map<number, Prisma.Decimal>,
  ) {
    const existingByProcedureId = new Map(
      existing.map((item) => [item.procedureId, item]),
    );
    const incomingIds = new Set(incoming.map((item) => item.procedureId));

    for (const current of existing) {
      if (!incomingIds.has(current.procedureId)) {
        if (current.usedQuantity > 0) {
          throw new BadRequestException(
            `Cannot remove procedure ${current.procedureId} from insurance guide because usedQuantity is ${current.usedQuantity}`,
          );
        }

        await tx.insuranceGuideProcedure.delete({
          where: {
            insuranceGuideId_procedureId: {
              insuranceGuideId,
              procedureId: current.procedureId,
            },
          },
        });
      }
    }

    for (const item of incoming) {
      const current = existingByProcedureId.get(item.procedureId);
      if (!current) {
        await tx.insuranceGuideProcedure.create({
          data: {
            insuranceGuideId,
            procedureId: item.procedureId,
            authorizedQuantity: item.authorizedQuantity,
            value: item.value ?? procedureValues.get(item.procedureId)!,
          },
        });
        continue;
      }

      if (item.authorizedQuantity < current.usedQuantity) {
        throw new BadRequestException(
          `authorizedQuantity for procedure ${item.procedureId} cannot be less than usedQuantity ${current.usedQuantity}`,
        );
      }

      const data: {
        authorizedQuantity?: number;
        value?: number;
      } = {};

      if (item.authorizedQuantity !== current.authorizedQuantity) {
        data.authorizedQuantity = item.authorizedQuantity;
      }

      if (item.value !== undefined) {
        data.value = item.value;
      }

      if (Object.keys(data).length > 0) {
        await tx.insuranceGuideProcedure.update({
          where: {
            insuranceGuideId_procedureId: {
              insuranceGuideId,
              procedureId: item.procedureId,
            },
          },
          data,
        });
      }
    }
  }

  private async refreshGuideProcedureValues(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    procedureIds: number[],
    procedureValues: Map<number, Prisma.Decimal>,
  ) {
    for (const procedureId of procedureIds) {
      const value = procedureValues.get(procedureId);
      if (value === undefined) {
        continue;
      }

      await tx.insuranceGuideProcedure.update({
        where: {
          insuranceGuideId_procedureId: {
            insuranceGuideId,
            procedureId,
          },
        },
        data: { value },
      });
    }
  }

  private async ensureGuideProceduresValid(
    params: {
      healthPlanId: number;
      healthProfessionalId: number;
      procedures: InsuranceGuideProcedureInputDto[];
    },
    db: GuideDb = this.prisma,
  ): Promise<{
    values: Map<number, Prisma.Decimal>;
    tissGuideType: TissGuideType;
  }> {
    const procedureIds = params.procedures.map((item) => item.procedureId);
    const uniqueIds = new Set(procedureIds);
    if (uniqueIds.size !== procedureIds.length) {
      throw new BadRequestException(
        'procedures cannot contain duplicate procedureId',
      );
    }

    const dbProcedures = await db.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true, specialtyId: true, tissGuideType: true },
    });

    if (dbProcedures.length !== uniqueIds.size) {
      const found = new Set(dbProcedures.map((item) => item.id));
      const missing = procedureIds.find((id) => !found.has(id));
      throw new NotFoundException(`Procedure ${missing} not found`);
    }

    const types = new Set(dbProcedures.map((item) => item.tissGuideType));
    if (types.size !== 1) {
      throw new BadRequestException(
        'procedures cannot mix consulta and sp_sadt tissGuideType',
      );
    }
    const tissGuideType = dbProcedures[0]!.tissGuideType;
    if (tissGuideType === 'consulta' && params.procedures.length !== 1) {
      throw new BadRequestException(
        'consulta guides must contain exactly one procedure',
      );
    }

    const professionalSpecialties =
      await db.healthProfessionalSpecialty.findMany({
        where: { healthProfessionalId: params.healthProfessionalId },
        select: { specialtyId: true },
      });
    const allowedSpecialtyIds = new Set(
      professionalSpecialties.map((item) => item.specialtyId),
    );

    for (const procedure of dbProcedures) {
      if (!allowedSpecialtyIds.has(procedure.specialtyId)) {
        throw new NotFoundException(
          `Health professional ${params.healthProfessionalId} does not have specialty ${procedure.specialtyId} required by procedure ${procedure.id}`,
        );
      }
    }

    const priced = await db.healthPlanProcedure.findMany({
      where: {
        healthPlanId: params.healthPlanId,
        procedureId: { in: procedureIds },
      },
      select: { procedureId: true, value: true },
    });
    const pricedIds = new Set(priced.map((item) => item.procedureId));
    const withoutPrice = procedureIds.find((id) => !pricedIds.has(id));
    if (withoutPrice !== undefined) {
      throw new BadRequestException(
        `Procedure ${withoutPrice} has no price for health plan ${params.healthPlanId}`,
      );
    }

    return {
      values: new Map(priced.map((item) => [item.procedureId, item.value])),
      tissGuideType,
    };
  }

  private startOfUtcDay(date = new Date()): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  private addUtcDays(date: Date, days: number): Date {
    const result = this.startOfUtcDay(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private async ensureHealthPlanExists(
    healthPlanId: number,
    db: GuideDb = this.prisma,
  ) {
    const healthPlan = await db.healthPlan.findUnique({
      where: { id: healthPlanId },
    });

    if (!healthPlan) {
      throw new NotFoundException(`Health plan ${healthPlanId} not found`);
    }

    return healthPlan;
  }

  private async ensurePatientExists(
    patientId: number,
    db: GuideDb = this.prisma,
  ) {
    const patient = await db.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
  }

  private async ensureHealthProfessionalExists(
    healthProfessionalId: number,
    db: GuideDb = this.prisma,
  ) {
    const professional = await db.healthProfessional.findUnique({
      where: { id: healthProfessionalId },
    });

    if (!professional) {
      throw new NotFoundException(
        `Health professional ${healthProfessionalId} not found`,
      );
    }
  }

  private normalizeGuideNumber(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private rethrowKnownPrismaError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Já existe uma guia com este número.');
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(
        'Insurance guide cannot be removed because it is in use',
      );
    }
  }
}
