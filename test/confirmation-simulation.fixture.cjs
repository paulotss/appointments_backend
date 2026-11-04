// Real Nest/Prisma contract fixture. No AppModule, .env, legacy client or dispatcher.
require('reflect-metadata');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const database = new URL(process.env.DATABASE_URL || 'http://invalid');
if (
  database.hostname !== 'host.docker.internal' ||
  database.port !== '5549' ||
  database.pathname !== '/appointments_simulation_fixture'
)
  throw Error('Disposable simulation database required');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { AuthModule } = require('../dist/src/auth/auth.module');
const { PrismaService } = require('../dist/src/prisma/prisma.service');
const {
  ConfirmationAdminModule,
} = require('../dist/src/confirmation-admin/confirmation-admin.module');
const {
  AppointmentSourceRegistry,
} = require('../dist/src/confirmation-admin/appointment-source');
const ref = (kind, byte) => `${kind}:v1:fixture:${byte.repeat(32)}`;
const items = ['ab', 'cd'].map((byte, index) => ({
  appointmentRef: ref('appt', byte),
  patientRef: ref('patient', byte),
  recipientRef: ref('recipient', byte),
  informedPhoneRef: ref('phone', byte),
  appointmentTime: index ? '10:00' : '09:00',
  agendaRef: 'fixture-agenda',
  isMinor: false,
  sourceResolution: 'candidate',
  recipientState: index ? 'PENDING' : 'ELIGIBLE',
  reasonCode: index ? 'authorization_missing' : 'contact_ready',
}));
async function main() {
  const module = await Test.createTestingModule({
    imports: [AuthModule, ConfirmationAdminModule],
  })
    .overrideProvider(AppointmentSourceRegistry)
    .useValue(
      new AppointmentSourceRegistry([
        {
          key: 'SAUDEVIANET',
          label: 'Fixture',
          async load() {
            return {
              connected: true,
              availability: 'ready',
              registry: 'ready',
              reason: null,
              items,
            };
          },
        },
      ]),
    )
    .compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.init();
  const prisma = app.get(PrismaService);
  if (
    (await prisma.user.count()) ||
    (await prisma.confirmationCampaign.count())
  )
    throw Error('Fixture must start empty');
  const user = await prisma.user.create({
    data: {
      name: 'Fixture Admin',
      usernameLogin: 'fixture-admin',
      passwordHash: 'fixture-only-not-a-login',
      role: 'ADMIN',
    },
  });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const tokens = {};
  for (const scope of ['CONFIRMATION_SIMULATE', 'CLINIC_REGISTRY_READ']) {
    const jti = randomUUID();
    const token = jwt.sign(
      { typ: 'service', sub: 1, jti },
      { expiresIn: '1h' },
    );
    await prisma.serviceAccessToken.create({
      data: {
        name: 'fixture-only',
        jti,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        scopes: [scope],
        createdById: user.id,
      },
    });
    tokens[scope] = token;
  }
  tokens.staff = jwt.sign(
    {
      typ: 'user',
      sub: user.id,
      usernameLogin: user.usernameLogin,
      role: 'ADMIN',
      jti: randomUUID(),
    },
    { expiresIn: '1h' },
  );
  const campaign = await prisma.confirmationCampaign.create({
    data: {
      campaignDate: new Date('2026-11-05T00:00:00Z'),
      source: 'SAUDEVIANET',
      status: 'APPROVED',
      consultationState: 'READY',
      appointmentsAnalyzed: 2,
      eligibleRecipients: 1,
      pendingVerifications: 1,
      createdByUserId: user.id,
      approvedByUserId: user.id,
      approvedAt: new Date(),
      items: { create: items },
      events: {
        create: {
          action: 'CAMPAIGN_APPROVED',
          actorUserId: user.id,
          toStatus: 'APPROVED',
        },
      },
    },
  });
  writeFileSync(
    '/tmp/higia-simulation-fixture/session.json',
    JSON.stringify({
      base: 'http://127.0.0.1:3106/api',
      campaignId: campaign.id,
      tokens,
    }),
    { mode: 0o600 },
  );
  await app.listen(3106, '0.0.0.0'); // Runner publishes only host loopback.
  console.log('Simulation fixture ready; no real data or transport');
  const close = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
main().catch((error) => {
  console.error('Simulation fixture failed:', error.message);
  process.exit(1);
});
