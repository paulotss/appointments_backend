import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CallRecordStatus,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  ContactMethod,
  CouncilType,
  InsuranceGuideStatus,
  PrismaClient,
  TissGuideType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

type SlotTemplate = {
  hour: number;
  minute: number;
  durationMinutes: number;
  professional: 'ana' | 'carlos';
};

const WEEKDAY_CLINICAL_SLOTS: SlotTemplate[] = [
  { hour: 8, minute: 0, durationMinutes: 30, professional: 'ana' },
  { hour: 8, minute: 30, durationMinutes: 30, professional: 'ana' },
  { hour: 9, minute: 10, durationMinutes: 30, professional: 'ana' },
  { hour: 10, minute: 0, durationMinutes: 30, professional: 'ana' },
  { hour: 10, minute: 45, durationMinutes: 30, professional: 'ana' },
  { hour: 11, minute: 30, durationMinutes: 30, professional: 'ana' },
  { hour: 14, minute: 0, durationMinutes: 30, professional: 'ana' },
  { hour: 14, minute: 40, durationMinutes: 30, professional: 'ana' },
  { hour: 15, minute: 30, durationMinutes: 30, professional: 'ana' },
  { hour: 16, minute: 15, durationMinutes: 30, professional: 'ana' },
  { hour: 17, minute: 0, durationMinutes: 30, professional: 'ana' },
  { hour: 8, minute: 0, durationMinutes: 40, professional: 'carlos' },
  { hour: 8, minute: 50, durationMinutes: 40, professional: 'carlos' },
  { hour: 10, minute: 0, durationMinutes: 40, professional: 'carlos' },
  { hour: 11, minute: 10, durationMinutes: 40, professional: 'carlos' },
  { hour: 14, minute: 0, durationMinutes: 40, professional: 'carlos' },
  { hour: 15, minute: 0, durationMinutes: 40, professional: 'carlos' },
  { hour: 16, minute: 20, durationMinutes: 40, professional: 'carlos' },
];

const SATURDAY_CLINICAL_SLOTS: SlotTemplate[] = [
  { hour: 8, minute: 0, durationMinutes: 30, professional: 'ana' },
  { hour: 8, minute: 30, durationMinutes: 30, professional: 'ana' },
  { hour: 9, minute: 15, durationMinutes: 30, professional: 'ana' },
  { hour: 10, minute: 0, durationMinutes: 30, professional: 'ana' },
  { hour: 8, minute: 10, durationMinutes: 40, professional: 'carlos' },
  { hour: 9, minute: 10, durationMinutes: 40, professional: 'carlos' },
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function partsInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  let hour = get('hour');
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

function weekdayInSaoPaulo(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

function addDaysYmd(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function dateOnlyUtc(year: number, month: number, day: number): Date {
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T00:00:00.000Z`);
}

/** Converte data/hora de parede em America/Sao_Paulo para Date UTC. */
function saoPauloWallTimeToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const desiredUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  function offsetMs(instant: number): number {
    const parts = partsInSaoPaulo(new Date(instant));
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    return asUtc - instant;
  }

  let utc = desiredUtcMs - offsetMs(desiredUtcMs);
  utc = desiredUtcMs - offsetMs(utc);
  return new Date(utc);
}

function currentWeekMondayToSaturday(now: Date) {
  const today = partsInSaoPaulo(now);
  const weekday = weekdayInSaoPaulo(now);
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = addDaysYmd(
    today.year,
    today.month,
    today.day,
    -daysFromMonday,
  );

  return Array.from({ length: 6 }, (_, offset) => {
    const date = addDaysYmd(monday.year, monday.month, monday.day, offset);
    return { ...date, weekday: offset + 1 };
  });
}

function resolveClinicalStatus(
  scheduledAt: Date,
  endsAt: Date,
  now: Date,
  index: number,
): ClinicalAppointmentStatus {
  if (now >= scheduledAt && now < endsAt) {
    return ClinicalAppointmentStatus.waiting;
  }

  if (now >= endsAt) {
    const bucket = index % 10;
    if (bucket === 0) {
      return ClinicalAppointmentStatus.absent;
    }
    if (bucket === 1) {
      return ClinicalAppointmentStatus.attended;
    }
    return ClinicalAppointmentStatus.finished;
  }

  return index % 3 === 0
    ? ClinicalAppointmentStatus.marked
    : ClinicalAppointmentStatus.confirmed;
}

async function seedClinicalAppointmentsForCurrentWeek(
  prisma: PrismaClient,
  params: {
    generalPractitionerId: number;
    cardiologistId: number;
    healthPlanId: number;
    consultaProcedureId: number;
    consultaTissGuideType: TissGuideType;
    consultaPlanValue: number;
    ecgProcedureId: number;
    ecgTissGuideType: TissGuideType;
    ecgPlanValue: number;
  },
) {
  const now = new Date();
  const weekDays = currentWeekMondayToSaturday(now);

  const patients = await prisma.patient.createManyAndReturn({
    data: [
      {
        name: 'Fernanda Alves',
        phone: '11988001001',
        email: 'fernanda.alves@email.com',
        birthDate: dateOnlyUtc(1988, 3, 12),
        cpf: '20000000001',
      },
      {
        name: 'Ricardo Souza',
        phone: '11988001002',
        email: 'ricardo.souza@email.com',
        birthDate: dateOnlyUtc(1979, 7, 4),
        cpf: '20000000002',
      },
      {
        name: 'Juliana Martins',
        phone: '11988001003',
        email: 'juliana.martins@email.com',
        birthDate: dateOnlyUtc(1992, 11, 21),
        cpf: '20000000003',
      },
      {
        name: 'Bruno Oliveira',
        phone: '11988001004',
        birthDate: dateOnlyUtc(1985, 1, 30),
        cpf: '20000000004',
      },
      {
        name: 'Camila Rocha',
        phone: '11988001005',
        email: 'camila.rocha@email.com',
        birthDate: dateOnlyUtc(1996, 5, 18),
        cpf: '20000000005',
      },
      {
        name: 'Pedro Henrique Lima',
        phone: '11988001006',
        email: 'pedro.lima@email.com',
        birthDate: dateOnlyUtc(1983, 9, 9),
        cpf: '20000000006',
      },
      {
        name: 'Larissa Mendes',
        phone: '11988001007',
        birthDate: dateOnlyUtc(1990, 2, 14),
        cpf: '20000000007',
      },
      {
        name: 'Thiago Barbosa',
        phone: '11988001008',
        email: 'thiago.barbosa@email.com',
        birthDate: dateOnlyUtc(1976, 12, 2),
        cpf: '20000000008',
      },
      {
        name: 'Beatriz Nunes',
        phone: '11988001009',
        email: 'beatriz.nunes@email.com',
        birthDate: dateOnlyUtc(2001, 8, 27),
        cpf: '20000000009',
      },
      {
        name: 'Gustavo Ferreira',
        phone: '11988001010',
        birthDate: dateOnlyUtc(1981, 4, 6),
        cpf: '20000000010',
      },
      {
        name: 'Sonia Ribeiro',
        phone: '11988001011',
        email: 'sonia.ribeiro@email.com',
        birthDate: dateOnlyUtc(1968, 6, 15),
        cpf: '20000000011',
      },
      {
        name: 'Marcelo Dias',
        phone: '11988001012',
        birthDate: dateOnlyUtc(1974, 10, 19),
        cpf: '20000000012',
      },
      {
        name: 'Aline Castro',
        phone: '11988001013',
        email: 'aline.castro@email.com',
        birthDate: dateOnlyUtc(1994, 3, 3),
        cpf: '20000000013',
      },
      {
        name: 'Rafael Pinto',
        phone: '11988001014',
        email: 'rafael.pinto@email.com',
        birthDate: dateOnlyUtc(1987, 7, 22),
        cpf: '20000000014',
      },
      {
        name: 'Vanessa Lopes',
        phone: '11988001015',
        birthDate: dateOnlyUtc(1998, 1, 8),
        cpf: '20000000015',
      },
      {
        name: 'Patricia Gomes',
        phone: '11988001016',
        email: 'patricia.gomes@email.com',
        birthDate: dateOnlyUtc(1982, 5, 25),
        cpf: '20000000016',
      },
      {
        name: 'Eduardo Araujo',
        phone: '11988001017',
        birthDate: dateOnlyUtc(1971, 9, 13),
        cpf: '20000000017',
      },
      {
        name: 'Helena Cardoso',
        phone: '11988001018',
        email: 'helena.cardoso@email.com',
        birthDate: dateOnlyUtc(1995, 12, 29),
        cpf: '20000000018',
      },
      {
        name: 'Igor Monteiro',
        phone: '11988001019',
        birthDate: dateOnlyUtc(1989, 8, 1),
        cpf: '20000000019',
      },
    ],
  });

  const planPatients = patients.slice(0, 15);
  const privatePatients = patients.slice(15);

  await prisma.insuranceCard.createMany({
    data: planPatients.map((patient, index) => ({
      patientId: patient.id,
      healthPlanId: params.healthPlanId,
      cardNumber: `SEED-CARD-${String(index + 1).padStart(4, '0')}`,
      expirationDate: dateOnlyUtc(2027, 12, 31),
    })),
  });

  let slotIndex = 0;
  let planPatientCursor = 0;
  let privatePatientCursor = 0;
  let guideSeq = 1;
  let healthPlanCount = 0;
  let privateCount = 0;

  for (const day of weekDays) {
    const slots =
      day.weekday === 6 ? SATURDAY_CLINICAL_SLOTS : WEEKDAY_CLINICAL_SLOTS;

    for (const slot of slots) {
      const index = slotIndex++;
      const isPrivate = index % 7 === 0;
      const professionalId =
        slot.professional === 'ana'
          ? params.generalPractitionerId
          : params.cardiologistId;
      const procedureId =
        slot.professional === 'ana'
          ? params.consultaProcedureId
          : params.ecgProcedureId;
      const tissGuideType =
        slot.professional === 'ana'
          ? params.consultaTissGuideType
          : params.ecgTissGuideType;
      const planValue =
        slot.professional === 'ana'
          ? params.consultaPlanValue
          : params.ecgPlanValue;
      const patient = isPrivate
        ? privatePatients[privatePatientCursor++ % privatePatients.length]
        : planPatients[planPatientCursor++ % planPatients.length];
      const scheduledAt = saoPauloWallTimeToDate(
        day.year,
        day.month,
        day.day,
        slot.hour,
        slot.minute,
      );
      const endsAt = new Date(
        scheduledAt.getTime() + slot.durationMinutes * 60 * 1000,
      );
      const status = resolveClinicalStatus(scheduledAt, endsAt, now, index);
      const type = isPrivate
        ? ClinicalAppointmentType.private
        : ClinicalAppointmentType.health_plan;
      const notes =
        index % 5 === 0
          ? 'Retorno. Trazer exames recentes'
          : index % 5 === 1
            ? 'Paciente prefere periodo da manha'
            : undefined;
      const authYmd = addDaysYmd(day.year, day.month, day.day, -5);
      const expYmd = addDaysYmd(authYmd.year, authYmd.month, authYmd.day, 45);

      if (type === ClinicalAppointmentType.health_plan) {
        healthPlanCount += 1;
        await prisma.clinicalAppointment.create({
          data: {
            patientId: patient.id,
            healthProfessionalId: professionalId,
            scheduledAt,
            endsAt,
            status,
            type,
            notes,
            insuranceGuides: {
              create: {
                insuranceGuide: {
                  create: {
                    healthPlanId: params.healthPlanId,
                    patientId: patient.id,
                    healthProfessionalId: professionalId,
                    guideNumber: `SEED-CA-${String(guideSeq++).padStart(4, '0')}`,
                    authorizationDate: dateOnlyUtc(
                      authYmd.year,
                      authYmd.month,
                      authYmd.day,
                    ),
                    expirationDate: dateOnlyUtc(
                      expYmd.year,
                      expYmd.month,
                      expYmd.day,
                    ),
                    status: InsuranceGuideStatus.authorized,
                    tissGuideType,
                    procedures: {
                      create: {
                        procedureId,
                        authorizedQuantity: 1,
                        usedQuantity:
                          status === ClinicalAppointmentStatus.finished ? 1 : 0,
                        value: planValue,
                      },
                    },
                  },
                },
              },
            },
            procedures: {
              create: { procedureId },
            },
          },
        });
      } else {
        privateCount += 1;
        await prisma.clinicalAppointment.create({
          data: {
            patientId: patient.id,
            healthProfessionalId: professionalId,
            scheduledAt,
            endsAt,
            status,
            type,
            notes,
            procedures: {
              create: { procedureId },
            },
          },
        });
      }
    }
  }

  return {
    total: healthPlanCount + privateCount,
    healthPlan: healthPlanCount,
    private: privateCount,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.financialEntryItem.deleteMany();
    await prisma.financialEntry.deleteMany();
    await prisma.billingBatchGuide.deleteMany();
    await prisma.billingBatch.deleteMany();
    await prisma.clinicalAppointmentProcedure.deleteMany();
    await prisma.clinicalAppointmentGuide.deleteMany();
    await prisma.clinicalAppointment.deleteMany();
    await prisma.insuranceGuideDocument.deleteMany();
    await prisma.insuranceGuideProcedure.deleteMany();
    await prisma.insuranceGuide.deleteMany();
    await prisma.insuranceCard.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.stockExit.deleteMany();
    await prisma.stockBatch.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.sector.deleteMany();
    await prisma.storageLocation.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.message.deleteMany();
    await prisma.call.deleteMany();
    await prisma.healthProfessional.deleteMany();
    await prisma.healthPlanProcedure.deleteMany();
    await prisma.procedure.deleteMany();
    await prisma.specialty.deleteMany();
    await prisma.user.deleteMany();

    const [adminPasswordHash, userPasswordHash] = await Promise.all([
      bcrypt.hash('admin123', 10),
      bcrypt.hash('user123', 10),
    ]);

    const users = await prisma.user.createManyAndReturn({
      data: [
        {
          name: 'Administrador',
          usernameLogin: 'admin',
          email: 'admin@appointments.local',
          passwordHash: adminPasswordHash,
          isAdmin: true,
        },
        {
          name: 'Atendente',
          usernameLogin: 'atendente',
          email: 'atendente@appointments.local',
          passwordHash: userPasswordHash,
          isAdmin: false,
        },
      ],
    });

    const specialties = await prisma.specialty.createManyAndReturn({
      data: [
        { name: 'CLINICO GERAL' },
        { name: 'CARDIOLOGIA' },
        { name: 'DERMATOLOGIA' },
        { name: 'PSICOLOGIA' },
      ],
    });

    const categories = await prisma.category.createManyAndReturn({
      data: [
        { name: 'MEDICAMENTOS' },
        { name: 'MATERIAL DE ESCRITORIO' },
        { name: 'HIGIENE' },
      ],
    });

    const sectors = await prisma.sector.createManyAndReturn({
      data: [
        { name: 'FARMACIA', isActive: true },
        { name: 'ALMOXARIFADO', isActive: true },
        { name: 'DEPOSITO INATIVO', isActive: false },
      ],
    });

    const storageLocations = await prisma.storageLocation.createManyAndReturn({
      data: [{ name: 'PRATELEIRA A1' }, { name: 'ARMARIO B2' }],
    });

    const adminUser = users.find((user) => user.usernameLogin === 'admin');
    const attendantUser = users.find(
      (user) => user.usernameLogin === 'atendente',
    );
    const cardiology = specialties.find(
      (specialty) => specialty.name === 'CARDIOLOGIA',
    );
    const psychology = specialties.find(
      (specialty) => specialty.name === 'PSICOLOGIA',
    );
    const generalClinic = specialties.find(
      (specialty) => specialty.name === 'CLINICO GERAL',
    );
    const dermatology = specialties.find(
      (specialty) => specialty.name === 'DERMATOLOGIA',
    );
    const medicationsCategory = categories.find(
      (category) => category.name === 'MEDICAMENTOS',
    );
    const officeCategory = categories.find(
      (category) => category.name === 'MATERIAL DE ESCRITORIO',
    );
    const hygieneCategory = categories.find(
      (category) => category.name === 'HIGIENE',
    );
    const pharmacySector = sectors.find((sector) => sector.name === 'FARMACIA');
    const warehouseSector = sectors.find(
      (sector) => sector.name === 'ALMOXARIFADO',
    );
    const shelfA1 = storageLocations.find(
      (location) => location.name === 'PRATELEIRA A1',
    );
    const cabinetB2 = storageLocations.find(
      (location) => location.name === 'ARMARIO B2',
    );

    if (
      !adminUser ||
      !attendantUser ||
      !cardiology ||
      !psychology ||
      !generalClinic ||
      !dermatology ||
      !medicationsCategory ||
      !officeCategory ||
      !hygieneCategory ||
      !pharmacySector ||
      !warehouseSector ||
      !shelfA1 ||
      !cabinetB2
    ) {
      throw new Error('Failed to create required seed references');
    }

    const cardiologist = await prisma.healthProfessional.create({
      data: {
        name: 'DR. CARLOS MENDES',
        councilType: CouncilType.CRM,
        councilNumber: '123456',
        councilUf: 'SP',
        cbosCode: '225142',
        cpf: '52998224725',
        phone: '11988887777',
        email: 'carlos.mendes@email.com',
        isActive: true,
        specialties: {
          create: [
            { specialtyId: cardiology.id },
          ],
        },
      },
    });

    const generalPractitioner = await prisma.healthProfessional.create({
      data: {
        name: 'DRA. ANA COSTA',
        councilType: CouncilType.CRM,
        councilNumber: '654321',
        councilUf: 'SP',
        cbosCode: '225125',
        cpf: '39053344705',
        phone: '11977776666',
        email: 'ana.costa@email.com',
        isActive: true,
        specialties: {
          create: [
            { specialtyId: generalClinic.id },
          ],
        },
      },
    });

    await prisma.healthProfessional.create({
      data: {
        name: 'ENF. PAULA LIMA',
        councilType: CouncilType.COREN,
        councilNumber: '98765',
        councilUf: 'SP',
        cbosCode: '223505',
        cpf: '11144477735',
        phone: '11966665555',
        isActive: false,
        specialties: {
          create: [
            { specialtyId: dermatology.id },
          ],
        },
      },
    });

    const products = await prisma.product.createManyAndReturn({
      data: [
        {
          name: 'DIPIRONA 500MG',
          sku: 'MED-DIP-500',
          categoryId: medicationsCategory.id,
          minimumStock: 50,
          unitsPerPackage: 1,
          isActive: true,
        },
        {
          name: 'PARACETAMOL 750MG',
          sku: 'MED-PAR-750',
          categoryId: medicationsCategory.id,
          minimumStock: 30,
          unitsPerPackage: 1,
          isActive: true,
        },
        {
          name: 'AGULHA HIPODERMICA 25X7',
          sku: 'MED-AGU-25X7',
          categoryId: medicationsCategory.id,
          minimumStock: 24,
          unitsPerPackage: 12,
          isActive: true,
        },
        {
          name: 'PAPEL A4 500 FOLHAS',
          sku: 'OFF-PAP-A4',
          categoryId: officeCategory.id,
          minimumStock: 10,
          unitsPerPackage: 1,
          isActive: true,
        },
        {
          name: 'ALCOOL GEL 500ML',
          sku: 'HYG-ALC-500',
          categoryId: hygieneCategory.id,
          minimumStock: 20,
          unitsPerPackage: 1,
          isActive: true,
        },
        {
          name: 'PRODUTO DESCONTINUADO',
          sku: 'DISC-001',
          categoryId: officeCategory.id,
          minimumStock: 0,
          unitsPerPackage: 1,
          isActive: false,
        },
      ],
    });

    const dipirona = products.find((product) => product.sku === 'MED-DIP-500');
    const paracetamol = products.find((product) => product.sku === 'MED-PAR-750');
    const agulha = products.find((product) => product.sku === 'MED-AGU-25X7');
    const paperA4 = products.find((product) => product.sku === 'OFF-PAP-A4');

    if (!dipirona || !paracetamol || !agulha || !paperA4) {
      throw new Error('Failed to create required product seed references');
    }

    const suppliers = await prisma.supplier.createManyAndReturn({
      data: [
        {
          legalName: 'Distribuidora Farma Brasil LTDA',
          tradeName: 'Farma Brasil',
          cnpj: '12345678000199',
          phone: '1133334444',
          email: 'contato@farmabrasil.local',
          website: 'https://farmabrasil.local',
        },
        {
          legalName: 'Comercial Papelaria Norte ME',
          tradeName: 'Papelaria Norte',
          cnpj: '98765432000188',
          phone: '11988887777',
          email: 'vendas@papelarianorte.local',
        },
      ],
    });

    const farmaBrasil = suppliers.find(
      (supplier) => supplier.cnpj === '12345678000199',
    );
    const papelariaNorte = suppliers.find(
      (supplier) => supplier.cnpj === '98765432000188',
    );

    if (!farmaBrasil || !papelariaNorte) {
      throw new Error('Failed to create required supplier seed references');
    }

    const batches = await prisma.stockBatch.createManyAndReturn({
      data: [
        {
          productId: dipirona.id,
          sectorId: pharmacySector.id,
          supplierId: farmaBrasil.id,
          initialQuantity: 100,
          currentQuantity: 80,
          unitCost: 150.5,
          movementDate: new Date('2026-06-01'),
          expirationDate: new Date('2027-06-01'),
          notes: 'Entrada via nota fiscal 12345',
          userId: adminUser.id,
          invoiceAccessKey: '35260612345678901234567890123456789012345678',
          locationId: shelfA1.id,
        },
        {
          productId: paracetamol.id,
          sectorId: pharmacySector.id,
          supplierId: farmaBrasil.id,
          initialQuantity: 60,
          currentQuantity: 60,
          unitCost: 89.9,
          movementDate: new Date('2026-06-05'),
          expirationDate: new Date('2027-03-15'),
          userId: adminUser.id,
          locationId: shelfA1.id,
        },
        {
          productId: agulha.id,
          sectorId: pharmacySector.id,
          supplierId: farmaBrasil.id,
          // 1 caixa de 12 unidades
          initialQuantity: 12,
          currentQuantity: 12,
          unitCost: 10,
          movementDate: new Date('2026-06-08'),
          expirationDate: new Date('2028-01-01'),
          notes: 'Entrada de 1 caixa (12 unidades) a R$ 120',
          userId: adminUser.id,
          locationId: shelfA1.id,
        },
        {
          productId: paperA4.id,
          sectorId: warehouseSector.id,
          supplierId: papelariaNorte.id,
          initialQuantity: 25,
          currentQuantity: 20,
          movementDate: new Date('2026-06-10'),
          userId: attendantUser.id,
          locationId: cabinetB2.id,
        },
      ],
    });

    const dipironaBatch = batches.find(
      (batch) => batch.productId === dipirona.id,
    );
    const paperBatch = batches.find((batch) => batch.productId === paperA4.id);

    if (!dipironaBatch || !paperBatch) {
      throw new Error('Failed to create required batch seed references');
    }

    await prisma.stockExit.createMany({
      data: [
        {
          batchId: dipironaBatch.id,
          quantity: 20,
          userId: attendantUser.id,
          exitDate: new Date('2026-06-08'),
          healthProfessionalId: cardiologist.id,
        },
        {
          batchId: paperBatch.id,
          quantity: 5,
          userId: attendantUser.id,
          exitDate: new Date('2026-06-11'),
        },
      ],
    });

    const messages = await prisma.message.createManyAndReturn({
      data: [
        {
          finishAt: new Date('2026-07-20T19:57:47.246Z'),
          recipient: '5561999990001',
          name: 'Maria Silva',
          userId: attendantUser.id,
          recordStatus: CallRecordStatus.registered,
          interactionId: 'SEED_INTERACTION_001',
          note: 'Agendamento confirmado via WhatsApp',
          content: [
            {
              id: 'msg-1',
              role: 'user',
              type: 'text',
              text: 'Ola, gostaria de agendar uma consulta',
              time: 1721490000,
            },
            {
              id: 'msg-2',
              role: 'assistant',
              type: 'text',
              text: 'Claro! Qual especialidade voce precisa?',
              time: 1721490060,
            },
            {
              id: 'msg-3',
              role: 'user',
              type: 'text',
              text: 'Clinico geral, pela manha',
              time: 1721490120,
            },
          ],
        },
        {
          finishAt: new Date('2026-07-21T14:30:00.000Z'),
          recipient: '5561999990002',
          name: 'Joao Santos',
          userId: attendantUser.id,
          recordStatus: CallRecordStatus.pending,
          interactionId: 'SEED_INTERACTION_002',
          content: [
            {
              id: 'msg-1',
              role: 'user',
              type: 'text',
              text: 'Preciso remarcar minha consulta de cardiologia',
              time: 1721560000,
            },
            {
              id: 'msg-2',
              role: 'assistant',
              type: 'text',
              text: 'Posso ajudar com o remanejamento. Qual a melhor data?',
              time: 1721560100,
            },
          ],
        },
        {
          finishAt: new Date('2026-07-21T16:10:00.000Z'),
          recipient: '5561999990003',
          name: 'Ana Pereira',
          userId: null,
          recordStatus: CallRecordStatus.cancelled,
          interactionId: 'SEED_INTERACTION_003',
          note: 'Cliente encerrou sem concluir o atendimento',
          content: [
            {
              id: 'msg-1',
              role: 'user',
              type: 'text',
              text: 'Quero informacoes sobre psicologia',
              time: 1721568000,
            },
          ],
        },
      ],
    });

    const mariaMessage = messages.find(
      (message) => message.interactionId === 'SEED_INTERACTION_001',
    );

    if (!mariaMessage) {
      throw new Error('Failed to create required message seed references');
    }

    await prisma.appointment.createMany({
      data: [
        {
          date: new Date('2026-03-25'),
          clientName: 'MARIA SILVA',
          phone: '11999990001',
          contactMethod: ContactMethod.whatsapp,
          firstTime: true,
          scheduled: true,
          reason: 'Consulta inicial',
          specialtyId: generalClinic.id,
          notes: 'Paciente prefere horario da manha',
          attendantId: adminUser.id,
          messageId: mariaMessage.id,
        },
        {
          date: new Date('2026-03-27'),
          clientName: 'JOAO SANTOS',
          phone: '11999990002',
          contactMethod: ContactMethod.phone,
          firstTime: false,
          scheduled: true,
          reason: 'Retorno cardiologico',
          specialtyId: cardiology.id,
          notes: 'Levar exames anteriores',
          attendantId: attendantUser.id,
        },
        {
          date: new Date('2026-04-01'),
          clientName: 'ANA PEREIRA',
          phone: '11999990003',
          contactMethod: ContactMethod.other,
          firstTime: true,
          scheduled: false,
          reason: 'Triagem psicologica',
          specialtyId: psychology.id,
          notes: 'Contato via recepcao',
          attendantId: attendantUser.id,
        },
      ],
    });

    await prisma.clinicProfile.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        legalName: 'Clinica Exemplo Ltda',
        cnpj: '12345678000199',
        cnes: '1234567',
      },
      update: {
        legalName: 'Clinica Exemplo Ltda',
        cnpj: '12345678000199',
        cnes: '1234567',
      },
    });

    const seedPlan =
      (await prisma.healthPlan.findFirst({ where: { name: 'UNIMED SEED' } })) ??
      (await prisma.healthPlan.create({
        data: {
          name: 'UNIMED SEED',
          submissionDeadlineDays: 30,
          registroAns: '351033',
          providerCode: '99999',
          tissVersion: '4.03.00',
        },
      }));

    await prisma.healthPlan.update({
      where: { id: seedPlan.id },
      data: {
        registroAns: '351033',
        providerCode: '99999',
        tissVersion: '4.03.00',
      },
    });

    const consultaProcedure =
      (await prisma.procedure.findFirst({
        where: { name: 'CONSULTA CLINICA SEED' },
      })) ??
      (await prisma.procedure.create({
        data: {
          specialtyId: generalClinic.id,
          name: 'CONSULTA CLINICA SEED',
          value: 150,
          tissGuideType: TissGuideType.consulta,
        },
      }));

    const sadtProcedure =
      (await prisma.procedure.findFirst({
        where: { name: 'ECG SEED' },
      })) ??
      (await prisma.procedure.create({
        data: {
          specialtyId: cardiology.id,
          name: 'ECG SEED',
          value: 80,
          tissGuideType: TissGuideType.sp_sadt,
        },
      }));

    await prisma.procedure.update({
      where: { id: consultaProcedure.id },
      data: { tissGuideType: TissGuideType.consulta },
    });
    await prisma.procedure.update({
      where: { id: sadtProcedure.id },
      data: { tissGuideType: TissGuideType.sp_sadt },
    });

    await prisma.healthPlanProcedure.upsert({
      where: {
        healthPlanId_procedureId: {
          healthPlanId: seedPlan.id,
          procedureId: consultaProcedure.id,
        },
      },
      create: {
        healthPlanId: seedPlan.id,
        procedureId: consultaProcedure.id,
        tissCode: '10101012',
        value: 80,
      },
      update: { tissCode: '10101012', value: 80 },
    });
    await prisma.healthPlanProcedure.upsert({
      where: {
        healthPlanId_procedureId: {
          healthPlanId: seedPlan.id,
          procedureId: sadtProcedure.id,
        },
      },
      create: {
        healthPlanId: seedPlan.id,
        procedureId: sadtProcedure.id,
        tissCode: '40304361',
        value: 40.5,
      },
      update: { tissCode: '40304361', value: 40.5 },
    });

    const clinicalSeed = await seedClinicalAppointmentsForCurrentWeek(prisma, {
      generalPractitionerId: generalPractitioner.id,
      cardiologistId: cardiologist.id,
      healthPlanId: seedPlan.id,
      consultaProcedureId: consultaProcedure.id,
      consultaTissGuideType: TissGuideType.consulta,
      consultaPlanValue: 80,
      ecgProcedureId: sadtProcedure.id,
      ecgTissGuideType: TissGuideType.sp_sadt,
      ecgPlanValue: 40.5,
    });

    console.log('Seed executado com sucesso.');
    console.log('Usuarios criados: admin / admin123, atendente / user123');
    console.log(
      `Agendamentos clinicos da semana atual: ${clinicalSeed.total} (plano_de_saude: ${clinicalSeed.healthPlan}, particular: ${clinicalSeed.private})`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
