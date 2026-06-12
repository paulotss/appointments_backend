import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ContactMethod, PrismaClient } from '@prisma/client';
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
    await prisma.call.deleteMany();
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
          passwordHash: adminPasswordHash,
          isAdmin: true,
        },
        {
          name: 'Atendente',
          usernameLogin: 'atendente',
          passwordHash: userPasswordHash,
          isAdmin: false,
        },
      ],
    });

    const specialties = await prisma.specialty.createManyAndReturn({
      data: [
        { name: 'Clinico Geral' },
        { name: 'Cardiologia' },
        { name: 'Dermatologia' },
        { name: 'Psicologia' },
      ],
    });

    const categories = await prisma.category.createManyAndReturn({
      data: [
        { name: 'Medicamentos' },
        { name: 'Material de Escritorio' },
        { name: 'Higiene' },
      ],
    });

    const sectors = await prisma.sector.createManyAndReturn({
      data: [
        { name: 'Farmacia', isActive: true },
        { name: 'Almoxarifado', isActive: true },
        { name: 'Deposito Inativo', isActive: false },
      ],
    });

    const storageLocations = await prisma.storageLocation.createManyAndReturn({
      data: [{ name: 'Prateleira A1' }, { name: 'Armario B2' }],
    });

    const adminUser = users.find((user) => user.usernameLogin === 'admin');
    const attendantUser = users.find(
      (user) => user.usernameLogin === 'atendente',
    );
    const cardiology = specialties.find(
      (specialty) => specialty.name === 'Cardiologia',
    );
    const psychology = specialties.find(
      (specialty) => specialty.name === 'Psicologia',
    );
    const generalClinic = specialties.find(
      (specialty) => specialty.name === 'Clinico Geral',
    );
    const medicationsCategory = categories.find(
      (category) => category.name === 'Medicamentos',
    );
    const officeCategory = categories.find(
      (category) => category.name === 'Material de Escritorio',
    );
    const hygieneCategory = categories.find(
      (category) => category.name === 'Higiene',
    );
    const pharmacySector = sectors.find((sector) => sector.name === 'Farmacia');
    const warehouseSector = sectors.find(
      (sector) => sector.name === 'Almoxarifado',
    );
    const shelfA1 = storageLocations.find(
      (location) => location.name === 'Prateleira A1',
    );
    const cabinetB2 = storageLocations.find(
      (location) => location.name === 'Armario B2',
    );

    if (
      !adminUser ||
      !attendantUser ||
      !cardiology ||
      !psychology ||
      !generalClinic ||
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

    const products = await prisma.product.createManyAndReturn({
      data: [
        {
          name: 'Dipirona 500mg',
          sku: 'MED-DIP-500',
          categoryId: medicationsCategory.id,
          minimumStock: 50,
          isActive: true,
        },
        {
          name: 'Paracetamol 750mg',
          sku: 'MED-PAR-750',
          categoryId: medicationsCategory.id,
          minimumStock: 30,
          isActive: true,
        },
        {
          name: 'Papel A4 500 folhas',
          sku: 'OFF-PAP-A4',
          categoryId: officeCategory.id,
          minimumStock: 10,
          isActive: true,
        },
        {
          name: 'Alcool Gel 500ml',
          sku: 'HYG-ALC-500',
          categoryId: hygieneCategory.id,
          minimumStock: 20,
          isActive: true,
        },
        {
          name: 'Produto Descontinuado',
          sku: 'DISC-001',
          categoryId: officeCategory.id,
          minimumStock: 0,
          isActive: false,
        },
      ],
    });

    const dipirona = products.find((product) => product.sku === 'MED-DIP-500');
    const paracetamol = products.find((product) => product.sku === 'MED-PAR-750');
    const paperA4 = products.find((product) => product.sku === 'OFF-PAP-A4');

    if (!dipirona || !paracetamol || !paperA4) {
      throw new Error('Failed to create required product seed references');
    }

    const batches = await prisma.stockBatch.createManyAndReturn({
      data: [
        {
          productId: dipirona.id,
          sectorId: pharmacySector.id,
          initialQuantity: 100,
          currentQuantity: 80,
          value: 150.5,
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
          value: 89.9,
          movementDate: new Date('2026-06-05'),
          expirationDate: new Date('2027-03-15'),
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
        },
        {
          batchId: paperBatch.id,
          quantity: 5,
          userId: attendantUser.id,
          exitDate: new Date('2026-06-11'),
        },
      ],
    });

    await prisma.appointment.createMany({
      data: [
        {
          date: new Date('2026-03-25'),
          clientName: 'Maria Silva',
          phone: '11999990001',
          contactMethod: ContactMethod.whatsapp,
          firstTime: true,
          scheduled: true,
          reason: 'Consulta inicial',
          specialtyId: generalClinic.id,
          notes: 'Paciente prefere horario da manha',
          attendantId: adminUser.id,
        },
        {
          date: new Date('2026-03-27'),
          clientName: 'Joao Santos',
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
          clientName: 'Ana Pereira',
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
