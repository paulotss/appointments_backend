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
    await prisma.appointment.deleteMany();
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

    if (
      !adminUser ||
      !attendantUser ||
      !cardiology ||
      !psychology ||
      !generalClinic
    ) {
      throw new Error('Failed to create required seed references');
    }

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
