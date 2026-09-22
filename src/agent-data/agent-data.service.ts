import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ClinicalAppointmentStatus,
  FinancialEntryStatus,
  InsuranceGuideStatus,
  PayableStatus,
  Prisma,
} from '@prisma/client';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
  todayYmdSaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { decimalToNumber } from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  AgentCatalogType,
  ListBillingBatchesAgentQueryDto,
  ListCallCenterAppointmentsAgentQueryDto,
  ListCallsAgentQueryDto,
  ListClinicalAppointmentsAgentQueryDto,
  ListFinancialEntriesAgentQueryDto,
  ListFinancialExitsAgentQueryDto,
  ListInsuranceGuidesAgentQueryDto,
  ListMessagesAgentQueryDto,
  ListPayablesAgentQueryDto,
  ListProceduresAgentQueryDto,
  ListProductsAgentQueryDto,
  ListStockBatchesAgentQueryDto,
  ListStockExitsAgentQueryDto,
  SearchQueryDto,
} from './dto/agent-data-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function paginate(page?: number, limit?: number) {
  const resolvedPage = page ?? DEFAULT_PAGE;
  const resolvedLimit = limit ?? DEFAULT_LIMIT;
  return {
    page: resolvedPage,
    limit: resolvedLimit,
    skip: (resolvedPage - 1) * resolvedLimit,
  };
}

function addDaysYmd(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateRange(
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }
  return {
    ...(from !== undefined && { gte: startOfDaySaoPaulo(from.slice(0, 10)) }),
    ...(to !== undefined && { lte: endOfDaySaoPaulo(to.slice(0, 10)) }),
  };
}

@Injectable()
export class AgentDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const today = todayYmdSaoPaulo();
    const in7Days = addDaysYmd(today, 7);
    const todayStart = startOfDaySaoPaulo(today);
    const todayEnd = endOfDaySaoPaulo(today);
    const expiringEnd = endOfDaySaoPaulo(in7Days);

    const [
      clinic,
      patientsTotal,
      todayAppointments,
      callCenterToday,
      guideGroups,
      expiringIn7Days,
      unbilled,
      pendingEntries,
      pendingPayables,
      overduePayablesCount,
      products,
      expiredBatches,
    ] = await Promise.all([
      this.prisma.clinicProfile.findUnique({
        where: { id: 1 },
        select: { legalName: true, cnpj: true },
      }),
      this.prisma.patient.count(),
      this.prisma.clinicalAppointment.groupBy({
        by: ['status'],
        where: { scheduledAt: { gte: todayStart, lte: todayEnd } },
        _count: { _all: true },
      }),
      this.prisma.appointment.count({
        where: { date: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.insuranceGuide.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.insuranceGuide.count({
        where: {
          expirationDate: { gte: todayStart, lte: expiringEnd },
          isBilled: false,
        },
      }),
      this.prisma.insuranceGuide.count({ where: { isBilled: false } }),
      this.prisma.financialEntry.aggregate({
        where: { status: FinancialEntryStatus.pending },
        _sum: { amount: true },
      }),
      this.prisma.payable.aggregate({
        where: { status: PayableStatus.pending },
        _sum: { amount: true },
      }),
      this.prisma.payable.count({
        where: {
          status: PayableStatus.pending,
          dueDate: { lt: todayStart },
        },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          minimumStock: true,
          stockBatches: {
            where: { isClosed: false },
            select: { currentQuantity: true },
          },
        },
      }),
      this.prisma.stockBatch.count({
        where: {
          isClosed: false,
          currentQuantity: { gt: 0 },
          expirationDate: { lt: todayStart },
        },
      }),
    ]);

    const clinicalAppointmentsByStatus = {
      [ClinicalAppointmentStatus.marked]: 0,
      [ClinicalAppointmentStatus.confirmed]: 0,
      [ClinicalAppointmentStatus.waiting]: 0,
      [ClinicalAppointmentStatus.attended]: 0,
      [ClinicalAppointmentStatus.finished]: 0,
      [ClinicalAppointmentStatus.absent]: 0,
    };
    for (const row of todayAppointments) {
      clinicalAppointmentsByStatus[row.status] = row._count._all;
    }

    const guidesByStatus = {
      [InsuranceGuideStatus.pending]: 0,
      [InsuranceGuideStatus.under_analysis]: 0,
      [InsuranceGuideStatus.authorized]: 0,
    };
    for (const row of guideGroups) {
      guidesByStatus[row.status] = row._count._all;
    }

    const productsBelowMinimum = products.filter((product) => {
      const total = product.stockBatches.reduce(
        (sum, batch) => sum + batch.currentQuantity,
        0,
      );
      return total < product.minimumStock;
    }).length;

    return {
      clinic: {
        legalName: clinic?.legalName ?? null,
        cnpj: clinic?.cnpj ?? null,
      },
      today: {
        date: today,
        clinicalAppointmentsByStatus,
        callCenterAppointments: callCenterToday,
      },
      patients: { total: patientsTotal },
      guides: {
        pending: guidesByStatus.pending,
        under_analysis: guidesByStatus.under_analysis,
        authorized: guidesByStatus.authorized,
        expiringIn7Days,
        unbilled,
      },
      finance: {
        pendingEntriesAmount: decimalToNumber(pendingEntries._sum.amount ?? 0),
        pendingPayablesAmount: decimalToNumber(
          pendingPayables._sum.amount ?? 0,
        ),
        overduePayablesCount,
      },
      stock: {
        productsBelowMinimum,
        expiredBatches,
      },
    };
  }

  async searchPatients(query: SearchQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where = this.patientSearchWhere(query.q);
    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          cpf: true,
          phone: true,
          email: true,
          birthDate: true,
        },
      }),
      this.prisma.patient.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async getPatient(id: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        birthDate: true,
        insuranceCards: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            cardNumber: true,
            expirationDate: true,
            healthPlan: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${id} not found`);
    }
    return patient;
  }

  async searchProfessionals(query: SearchQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.HealthProfessionalWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { cpf: { contains: digitsOnly(query.q) } },
            { councilNumber: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.healthProfessional.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          cpf: true,
          councilType: true,
          councilNumber: true,
          isActive: true,
          specialties: {
            select: { specialty: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.healthProfessional.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        id: item.id,
        name: item.name,
        cpf: item.cpf,
        councilType: item.councilType,
        councilNumber: item.councilNumber,
        isActive: item.isActive,
        specialties: item.specialties.map((row) => row.specialty),
      })),
      page,
      limit,
      total,
    );
  }

  async getProfessional(id: number) {
    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        councilType: true,
        councilNumber: true,
        councilUf: true,
        cbosCode: true,
        isActive: true,
        specialties: {
          select: { specialty: { select: { id: true, name: true } } },
        },
      },
    });
    if (!professional) {
      throw new NotFoundException(`Health professional ${id} not found`);
    }
    return {
      ...professional,
      specialties: professional.specialties.map((row) => row.specialty),
    };
  }

  async listClinicalAppointments(query: ListClinicalAppointmentsAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.ClinicalAppointmentWhereInput = {
      scheduledAt: dateRange(query.from, query.to),
      ...(query.patientId !== undefined && { patientId: query.patientId }),
      ...(query.healthProfessionalId !== undefined && {
        healthProfessionalId: query.healthProfessionalId,
      }),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.type !== undefined && { type: query.type }),
      ...(query.insuranceGuideId !== undefined && {
        insuranceGuides: {
          some: { insuranceGuideId: query.insuranceGuideId },
        },
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.clinicalAppointment.findMany({
        where,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          scheduledAt: true,
          endsAt: true,
          status: true,
          type: true,
          patient: { select: { id: true, name: true } },
          healthProfessional: { select: { id: true, name: true } },
        },
      }),
      this.prisma.clinicalAppointment.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async getClinicalAppointment(id: number) {
    const appointment = await this.prisma.clinicalAppointment.findUnique({
      where: { id },
      select: {
        id: true,
        scheduledAt: true,
        endsAt: true,
        status: true,
        type: true,
        notes: true,
        patient: { select: { id: true, name: true, phone: true } },
        healthProfessional: { select: { id: true, name: true } },
        procedures: {
          select: { procedure: { select: { id: true, name: true } } },
        },
        insuranceGuides: {
          select: {
            insuranceGuide: {
              select: {
                id: true,
                guideNumber: true,
                status: true,
                isBilled: true,
              },
            },
          },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Clinical appointment ${id} not found`);
    }
    return {
      ...appointment,
      procedures: appointment.procedures.map((row) => row.procedure),
      insuranceGuides: appointment.insuranceGuides.map(
        (row) => row.insuranceGuide,
      ),
    };
  }

  async searchInsuranceGuides(query: ListInsuranceGuidesAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const search = query.q?.trim() || query.guideNumber?.trim();
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
      ...(search
        ? {
            OR: [
              { guideNumber: { contains: search, mode: 'insensitive' } },
              {
                patient: { name: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.insuranceGuide.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          guideNumber: true,
          status: true,
          isBilled: true,
          authorizationDate: true,
          expirationDate: true,
          tissGuideType: true,
          patient: { select: { id: true, name: true } },
          healthPlan: { select: { id: true, name: true } },
          healthProfessional: { select: { id: true, name: true } },
        },
      }),
      this.prisma.insuranceGuide.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async getInsuranceGuide(id: number) {
    const guide = await this.prisma.insuranceGuide.findUnique({
      where: { id },
      select: {
        id: true,
        guideNumber: true,
        status: true,
        isBilled: true,
        authorizationDate: true,
        expirationDate: true,
        tissGuideType: true,
        patient: { select: { id: true, name: true } },
        healthPlan: { select: { id: true, name: true } },
        healthProfessional: { select: { id: true, name: true } },
        billingBatchGuide: { select: { billingBatchId: true } },
        procedures: {
          select: {
            authorizedQuantity: true,
            usedQuantity: true,
            value: true,
            procedure: { select: { id: true, name: true } },
          },
        },
        _count: { select: { documents: true } },
      },
    });
    if (!guide) {
      throw new NotFoundException(`Insurance guide ${id} not found`);
    }
    return {
      id: guide.id,
      guideNumber: guide.guideNumber,
      status: guide.status,
      isBilled: guide.isBilled,
      authorizationDate: guide.authorizationDate,
      expirationDate: guide.expirationDate,
      tissGuideType: guide.tissGuideType,
      patient: guide.patient,
      healthPlan: guide.healthPlan,
      healthProfessional: guide.healthProfessional,
      billingBatchId: guide.billingBatchGuide?.billingBatchId ?? null,
      documentCount: guide._count.documents,
      procedures: guide.procedures.map((item) => ({
        id: item.procedure.id,
        name: item.procedure.name,
        authorizedQuantity: item.authorizedQuantity,
        usedQuantity: item.usedQuantity,
        value: decimalToNumber(item.value),
      })),
    };
  }

  async listCallCenterAppointments(
    query: ListCallCenterAppointmentsAgentQueryDto,
  ) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.AppointmentWhereInput = {
      date: dateRange(query.from, query.to),
      ...(query.attendantId !== undefined && {
        attendantId: query.attendantId,
      }),
      ...(query.contactMethod !== undefined && {
        contactMethod: query.contactMethod,
      }),
      ...(query.firstTime !== undefined && { firstTime: query.firstTime }),
      ...(query.scheduled !== undefined && { scheduled: query.scheduled }),
      ...(query.specialtyId !== undefined && {
        specialtyId: query.specialtyId,
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          clientName: true,
          phone: true,
          date: true,
          scheduled: true,
          firstTime: true,
          contactMethod: true,
          reason: true,
          specialty: { select: { id: true, name: true } },
          attendant: { select: { id: true, name: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async listCalls(query: ListCallsAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.CallWhereInput = {
      receivedAt: dateRange(query.from, query.to),
      ...(query.recordStatus !== undefined && {
        recordStatus: query.recordStatus,
      }),
      ...(query.userId !== undefined && { userId: query.userId }),
      ...(query.status !== undefined && { status: query.status }),
    };
    const [data, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          origin: true,
          destination: true,
          extension: true,
          receivedAt: true,
          status: true,
          recordStatus: true,
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.call.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async listMessages(query: ListMessagesAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.MessageWhereInput = {
      finishAt: dateRange(query.from, query.to),
      ...(query.recordStatus !== undefined && {
        recordStatus: query.recordStatus,
      }),
      ...(query.userId !== undefined && { userId: query.userId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: [{ finishAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          recipient: true,
          finishAt: true,
          recordStatus: true,
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.message.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async getMessage(id: number) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        recipient: true,
        finishAt: true,
        recordStatus: true,
        note: true,
        content: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!message) {
      throw new NotFoundException(`Message ${id} not found`);
    }
    return message;
  }

  async listFinancialEntries(query: ListFinancialEntriesAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.FinancialEntryWhereInput = {
      ...(query.type !== undefined && { type: query.type }),
      ...(query.status !== undefined && { status: query.status }),
      ...(dateRange(query.from, query.to)
        ? { createdAt: dateRange(query.from, query.to) }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          receivedAmount: true,
          paymentMethod: true,
          paidAt: true,
          createdAt: true,
          clinicalAppointmentId: true,
          billingBatchId: true,
        },
      }),
      this.prisma.financialEntry.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        ...item,
        amount: decimalToNumber(item.amount),
        receivedAmount: decimalToNumber(item.receivedAmount),
      })),
      page,
      limit,
      total,
    );
  }

  async listPayables(query: ListPayablesAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const dueDate = dateRange(query.from, query.to);
    const where: Prisma.PayableWhereInput = {
      ...(query.status !== undefined && { status: query.status }),
      ...(query.supplierId !== undefined && { supplierId: query.supplierId }),
      ...(dueDate !== undefined && { dueDate }),
    };
    const [data, total] = await Promise.all([
      this.prisma.payable.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          description: true,
          invoiceNumber: true,
          amount: true,
          dueDate: true,
          status: true,
          kind: true,
          paidAt: true,
          supplier: { select: { id: true, tradeName: true, legalName: true } },
        },
      }),
      this.prisma.payable.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        ...item,
        amount: decimalToNumber(item.amount),
      })),
      page,
      limit,
      total,
    );
  }

  async listFinancialExits(query: ListFinancialExitsAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.FinancialExitWhereInput = {
      ...(query.paymentMethod !== undefined && {
        paymentMethod: query.paymentMethod,
      }),
      ...(dateRange(query.from, query.to)
        ? { paidAt: dateRange(query.from, query.to) }
        : {}),
      ...(query.supplierId !== undefined && {
        payable: { supplierId: query.supplierId },
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.financialExit.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          paidAt: true,
          paymentMethod: true,
          payable: {
            select: {
              id: true,
              description: true,
              supplier: { select: { id: true, tradeName: true } },
            },
          },
        },
      }),
      this.prisma.financialExit.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        ...item,
        amount: decimalToNumber(item.amount),
      })),
      page,
      limit,
      total,
    );
  }

  async listBillingBatches(query: ListBillingBatchesAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.BillingBatchWhereInput = {
      ...(query.healthPlanId !== undefined && {
        healthPlanId: query.healthPlanId,
      }),
      ...(query.status !== undefined && { status: query.status }),
    };
    const [data, total] = await Promise.all([
      this.prisma.billingBatch.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          batchNumber: true,
          protocolNumber: true,
          status: true,
          billedAmount: true,
          receivedAmount: true,
          billedAt: true,
          settledAt: true,
          createdAt: true,
          healthPlan: { select: { id: true, name: true } },
          _count: { select: { guides: true } },
        },
      }),
      this.prisma.billingBatch.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        id: item.id,
        batchNumber: item.batchNumber,
        protocolNumber: item.protocolNumber,
        status: item.status,
        billedAmount: decimalToNumber(item.billedAmount),
        receivedAmount: decimalToNumber(item.receivedAmount),
        billedAt: item.billedAt,
        settledAt: item.settledAt,
        createdAt: item.createdAt,
        healthPlan: item.healthPlan,
        guideCount: item._count.guides,
      })),
      page,
      limit,
      total,
    );
  }

  async getBillingBatch(id: number) {
    const batch = await this.prisma.billingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        batchNumber: true,
        protocolNumber: true,
        status: true,
        billedAmount: true,
        receivedAmount: true,
        billedAt: true,
        settledAt: true,
        createdAt: true,
        healthPlan: { select: { id: true, name: true } },
        guides: {
          select: {
            billedAmount: true,
            insuranceGuide: {
              select: {
                id: true,
                guideNumber: true,
                patient: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!batch) {
      throw new NotFoundException(`Billing batch ${id} not found`);
    }
    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      protocolNumber: batch.protocolNumber,
      status: batch.status,
      billedAmount: decimalToNumber(batch.billedAmount),
      receivedAmount: decimalToNumber(batch.receivedAmount),
      billedAt: batch.billedAt,
      settledAt: batch.settledAt,
      createdAt: batch.createdAt,
      healthPlan: batch.healthPlan,
      guides: batch.guides.map((item) => ({
        id: item.insuranceGuide.id,
        guideNumber: item.insuranceGuide.guideNumber,
        patient: item.insuranceGuide.patient,
        billedAmount: decimalToNumber(item.billedAmount),
      })),
    };
  }

  async searchProducts(query: ListProductsAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          minimumStock: true,
          baseUnit: true,
          category: { select: { id: true, name: true } },
          stockBatches: {
            where: { isClosed: false },
            select: { currentQuantity: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    let data = rows.map((product) => {
      const totalQuantity = product.stockBatches.reduce(
        (sum, batch) => sum + batch.currentQuantity,
        0,
      );
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        minimumStock: product.minimumStock,
        baseUnit: product.baseUnit,
        category: product.category,
        totalQuantity,
        belowMinimum: totalQuantity < product.minimumStock,
      };
    });
    if (query.belowMinimum) {
      data = data.filter((item) => item.belowMinimum);
      return this.envelope(data, page, limit, data.length);
    }
    return this.envelope(data, page, limit, total);
  }

  async getStockSummary(query: ListProductsAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const today = startOfDaySaoPaulo(todayYmdSaoPaulo());
    const in30Days = startOfDaySaoPaulo(addDaysYmd(todayYmdSaoPaulo(), 30));
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          minimumStock: true,
          baseUnit: true,
          stockBatches: {
            where: { isClosed: false },
            select: {
              currentQuantity: true,
              unitCost: true,
              expirationDate: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const data = rows.map((product) => {
      const withStock = product.stockBatches.filter(
        (batch) => batch.currentQuantity > 0,
      );
      const totalQuantity = product.stockBatches.reduce(
        (sum, batch) => sum + batch.currentQuantity,
        0,
      );
      let residualValue = 0;
      let residualQty = 0;
      for (const batch of product.stockBatches) {
        if (batch.unitCost == null) {
          continue;
        }
        residualValue +=
          batch.currentQuantity * decimalToNumber(batch.unitCost);
        residualQty += batch.currentQuantity;
      }
      let expiringBatchesCount = 0;
      let expiredBatchesCount = 0;
      for (const batch of withStock) {
        if (!batch.expirationDate) {
          continue;
        }
        if (batch.expirationDate < today) {
          expiredBatchesCount += 1;
        } else if (batch.expirationDate <= in30Days) {
          expiringBatchesCount += 1;
        }
      }
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        totalQuantity,
        totalValue: residualQty > 0 ? residualValue : null,
        averagePrice: residualQty > 0 ? residualValue / residualQty : null,
        minimumStock: product.minimumStock,
        baseUnit: product.baseUnit,
        belowMinimum: totalQuantity < product.minimumStock,
        expiringBatchesCount,
        expiredBatchesCount,
      };
    });
    return this.envelope(data, page, limit, total);
  }

  async listStockBatches(query: ListStockBatchesAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const status = query.status ?? 'open';
    const where: Prisma.StockBatchWhereInput = {
      ...(query.productId !== undefined && { productId: query.productId }),
      ...(status === 'open' && { isClosed: false }),
      ...(status === 'closed' && { isClosed: true }),
    };
    const [data, total] = await Promise.all([
      this.prisma.stockBatch.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          currentQuantity: true,
          initialQuantity: true,
          isClosed: true,
          movementDate: true,
          expirationDate: true,
          unitCost: true,
          product: { select: { id: true, name: true, sku: true } },
          sector: { select: { id: true, name: true } },
          supplier: { select: { id: true, tradeName: true } },
        },
      }),
      this.prisma.stockBatch.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        ...item,
        unitCost: item.unitCost == null ? null : decimalToNumber(item.unitCost),
      })),
      page,
      limit,
      total,
    );
  }

  async listStockExits(query: ListStockExitsAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.StockExitWhereInput = {
      ...(query.productId !== undefined && {
        batch: { productId: query.productId },
      }),
      ...(dateRange(query.from, query.to)
        ? { exitDate: dateRange(query.from, query.to) }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.stockExit.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          quantity: true,
          exitDate: true,
          batch: {
            select: {
              id: true,
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          user: { select: { id: true, name: true } },
          healthProfessional: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockExit.count({ where }),
    ]);
    return this.envelope(data, page, limit, total);
  }

  async searchProcedures(query: ListProceduresAgentQueryDto) {
    const { page, limit, skip } = paginate(query.page, query.limit);
    const where: Prisma.ProcedureWhereInput = {
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
      ...(query.specialtyId !== undefined && {
        specialtyId: query.specialtyId,
      }),
      ...(query.healthPlanId !== undefined && {
        healthPlanPrices: { some: { healthPlanId: query.healthPlanId } },
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          value: true,
          tissGuideType: true,
          specialty: { select: { id: true, name: true } },
        },
      }),
      this.prisma.procedure.count({ where }),
    ]);
    return this.envelope(
      data.map((item) => ({
        ...item,
        value: decimalToNumber(item.value),
      })),
      page,
      limit,
      total,
    );
  }

  async listCatalog(type: AgentCatalogType) {
    switch (type) {
      case AgentCatalogType.specialties:
        return this.prisma.specialty.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
      case AgentCatalogType.health_plans:
        return this.prisma.healthPlan.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, registroAns: true },
        });
      case AgentCatalogType.categories:
        return this.prisma.category.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
      case AgentCatalogType.sectors:
        return this.prisma.sector.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, isActive: true },
        });
      case AgentCatalogType.storage_locations:
        return this.prisma.storageLocation.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
    }
  }

  patientSearchWhere(q?: string): Prisma.PatientWhereInput {
    if (!q?.trim()) {
      return {};
    }
    const term = q.trim();
    const digits = digitsOnly(term);
    return {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        ...(digits.length > 0 ? [{ cpf: { contains: digits } }] : []),
      ],
    };
  }

  private envelope<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): ListEnvelope<T> {
    return { data, meta: buildListMeta(page, limit, total) };
  }
}
