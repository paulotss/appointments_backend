// Real Nest/Auth/Prisma with a strictly disposable database and synthetic source.
require('reflect-metadata');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const db = new URL(process.env.DATABASE_URL || 'http://invalid');
if (
  process.env.CONFIRMATION_LEGACY_FIXTURE !== 'fixture-only' ||
  db.hostname !== '127.0.0.1' ||
  db.port !== '5553' ||
  db.pathname !== '/confirmation_legacy_fixture'
)
  throw Error('Disposable fixture database required');
const directory = process.env.CONFIRMATION_LEGACY_DIRECTORY;
const meta = JSON.parse(readFileSync(path.join(directory, 'python.json')));
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const built = (name) => require(path.join(directory, 'dist/src', name));
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { AuthModule } = built('auth/auth.module');
const { PrismaService } = built('prisma/prisma.service');
const { ConfirmationAdminModule } = built(
  'confirmation-admin/confirmation-admin.module',
);
const { ConfirmationAdminService } = built(
  'confirmation-admin/confirmation-admin.service',
);
const { AppointmentSourceRegistry } = built(
  'confirmation-admin/appointment-source',
);
const item = {
  appointmentRef: meta.appointmentRef,
  patientRef: meta.patientRef,
  recipientRef: meta.recipientRef,
  informedPhoneRef: meta.phoneRef,
  appointmentTime: meta.appointmentTime,
  agendaRef: 'fixture',
  isMinor: false,
  sourceResolution: 'candidate',
  recipientState: 'ELIGIBLE',
  reasonCode: 'contact_ready',
};
async function main() {
  const sources = new AppointmentSourceRegistry([
    {
      key: 'SAUDEVIANET',
      label: 'Fixture',
      load: async () => ({
        connected: true,
        availability: 'ready',
        registry: 'ready',
        reason: null,
        items: [item],
      }),
    },
  ]);
  const module = await Test.createTestingModule({
    imports: [AuthModule, ConfirmationAdminModule],
  })
    .overrideProvider(AppointmentSourceRegistry)
    .useValue(sources)
    .overrideProvider(ConfirmationAdminService)
    .useFactory({
      factory: (prisma) =>
        new ConfirmationAdminService(prisma, sources, () => new Date(meta.now)),
      inject: [PrismaService],
    })
    .compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.init();
  const prisma = app.get(PrismaService);
  if (await prisma.user.count()) throw Error('Fixture must start empty');
  const user = await prisma.user.create({
    data: {
      name: 'Fixture Reception',
      usernameLogin: 'fixture',
      passwordHash: 'fixture-only',
      role: 'RECEPTIONIST',
    },
  });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const tokens = {};
  for (const scope of [
    'CONFIRMATION_EXECUTION_READ',
    'CONFIRMATION_RESULTS_WRITE',
    'CLINIC_REGISTRY_READ',
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
  tokens.staff = jwt.sign(
    {
      typ: 'user',
      sub: user.id,
      usernameLogin: user.usernameLogin,
      role: user.role,
      jti: randomUUID(),
    },
    { expiresIn: '1h' },
  );
  const actor = { typ: 'user', sub: user.id, role: user.role };
  const admin = app.get(ConfirmationAdminService);
  const campaign = await admin.createCampaign(actor, {
    campaignDate: meta.date,
    source: 'SAUDEVIANET',
  });
  await admin.setResponseDeadline(actor, campaign.id, meta.deadline);
  await admin.submitReview(actor, campaign.id);
  await admin.approve(actor, campaign.id);
  writeFileSync(
    path.join(directory, 'session.json'),
    JSON.stringify({
      tokens,
      campaignId: campaign.id,
      user: {
        id: user.id,
        name: user.name,
        usernameLogin: user.usernameLogin,
        role: user.role,
      },
    }),
    { mode: 0o600 },
  );
  await app.listen(3113, '127.0.0.1');
  console.log('Synthetic legacy fixture ready');
  process.on('SIGTERM', async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
main().catch((error) => {
  console.error(
    'Fixture startup failed:',
    error.name,
    String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]'),
  );
  process.exit(1);
});
