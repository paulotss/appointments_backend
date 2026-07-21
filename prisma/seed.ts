import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CallRecordStatus,
  ContactMethod,
  CouncilType,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.stockExit.deleteMany();
    await prisma.stockBatch.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.sector.deleteMany();
    await prisma.storageLocation.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.message.deleteMany();
    await prisma.call.deleteMany();
    await prisma.healthProfessional.deleteMany();
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

    const healthProfessionals = await prisma.healthProfessional.createManyAndReturn({
      data: [
        {
          name: 'DR. CARLOS MENDES',
          specialtyId: cardiology.id,
          councilType: CouncilType.CRM,
          councilNumber: '123456',
          cpf: '52998224725',
          phone: '11988887777',
          email: 'carlos.mendes@email.com',
          isActive: true,
        },
        {
          name: 'DRA. ANA COSTA',
          specialtyId: generalClinic.id,
          councilType: CouncilType.CRM,
          councilNumber: '654321',
          cpf: '39053344705',
          phone: '11977776666',
          email: 'ana.costa@email.com',
          isActive: true,
        },
        {
          name: 'ENF. PAULA LIMA',
          specialtyId: dermatology.id,
          councilType: CouncilType.COREN,
          councilNumber: '98765',
          cpf: '11144477735',
          phone: '11966665555',
          isActive: false,
        },
      ],
    });

    const cardiologist = healthProfessionals.find(
      (professional) => professional.cpf === '52998224725',
    );

    if (!cardiologist) {
      throw new Error('Failed to create required health professional seed references');
    }

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

    const batches = await prisma.stockBatch.createManyAndReturn({
      data: [
        {
          productId: dipirona.id,
          sectorId: pharmacySector.id,
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

    console.log('Seed executado com sucesso.');
    console.log('Usuarios criados: admin / admin123, atendente / user123');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
