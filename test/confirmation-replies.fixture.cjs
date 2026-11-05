// Disposable real Nest/Prisma/Auth fixture. Never loads AppModule or the local .env.
require('reflect-metadata');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const database = new URL(process.env.DATABASE_URL || 'http://invalid');
if (
  database.hostname !== 'host.docker.internal' ||
  database.port !== '5551' ||
  database.pathname !== '/confirmation_replies_fixture'
)
  throw Error('Disposable replies database required');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { AuthModule } = require('../dist/src/auth/auth.module');
const { PrismaService } = require('../dist/src/prisma/prisma.service');
const {
  ConfirmationAdminModule,
} = require('../dist/src/confirmation-admin/confirmation-admin.module');
const {
  ConfirmationAdminService,
} = require('../dist/src/confirmation-admin/confirmation-admin.service');
const {
  AppointmentSourceRegistry,
  CAMPAIGN_IDENTITY,
} = require('../dist/src/confirmation-admin/appointment-source');
const ref = (kind, index) =>
  `${kind}:v1:fixture:${createHash('sha256')
    .update(kind + index)
    .digest('hex')}`;
const items = [1, 2].map((index) => ({
  appointmentRef: ref('appt', index),
  patientRef: ref('patient', index),
  recipientRef: ref('recipient', index),
  informedPhoneRef: ref('phone', index),
  appointmentTime: index === 1 ? '09:00' : '10:00',
  agendaRef: 'fixture',
  isMinor: false,
  sourceResolution: 'candidate',
  recipientState: 'ELIGIBLE',
  reasonCode: 'contact_ready',
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
          load: async () => ({
            connected: true,
            availability: 'ready',
            registry: 'ready',
            reason: null,
            items,
          }),
        },
      ]),
    )
    .overrideProvider(CAMPAIGN_IDENTITY)
    .useValue({
      identify: async () => ({ state: 'unavailable' }),
      searchPatients: async () => ({ state: 'unavailable' }),
    })
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
      name: 'Fixture Reception',
      usernameLogin: 'fixture-reception',
      passwordHash: 'fixture-not-a-login',
      role: 'RECEPTIONIST',
    },
  });
  const other = await prisma.user.create({
    data: {
      name: 'Fixture Admin',
      usernameLogin: 'fixture-admin',
      passwordHash: 'fixture-not-a-login',
      role: 'ADMIN',
    },
  });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const tokens = {};
  for (const scope of [
    'CONFIRMATION_EXECUTION_READ',
    'CONFIRMATION_RESULTS_WRITE',
    'CLINIC_REGISTRY_READ',
    'CONFIRMATION_SIMULATE',
  ]) {
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
  for (const [name, person] of [
    ['staff', user],
    ['other', other],
  ])
    tokens[name] = jwt.sign(
      {
        typ: 'user',
        sub: person.id,
        usernameLogin: person.usernameLogin,
        role: person.role,
        jti: randomUUID(),
      },
      { expiresIn: '1h' },
    );
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const deadline = new Date(day + 'T10:00:00.000Z').toISOString();
  const actor = { typ: 'user', sub: user.id, role: user.role };
  const campaign = await app
    .get(ConfirmationAdminService)
    .createCampaign(actor, { campaignDate: day, source: 'SAUDEVIANET' });
  writeFileSync(
    '/tmp/higia-replies-fixture/session.json',
    JSON.stringify({
      base: 'http://127.0.0.1:3111/api',
      campaignId: campaign.id,
      campaignDate: day,
      deadline,
      tokens,
      user: {
        id: user.id,
        name: user.name,
        usernameLogin: user.usernameLogin,
        role: user.role,
      },
    }),
    { mode: 0o600 },
  );
  await app.listen(3111, '0.0.0.0');
  console.log('Replies fixture ready; no real channel or patient');
  const close = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
main().catch((error) => {
  console.error(
    'Replies fixture startup failed:',
    error.name,
    String(error.message)
      .replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted]')
      .replace(/postgres(?:ql)?:\/\/[^ ]+/g, '[database redacted]'),
  );
  process.exit(1);
});
