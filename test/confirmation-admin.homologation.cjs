/* Disposable administrative fixture. Never imports .env or the production AppModule. */
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { hash } = require('bcrypt');
const { createHash, randomBytes } = require('node:crypto');
const { writeFileSync } = require('node:fs');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { AuthModule } = require('../dist/src/auth/auth.module');
const { ConfirmationAdminModule } = require('../dist/src/confirmation-admin/confirmation-admin.module');
const { ConfirmationAdminService } = require('../dist/src/confirmation-admin/confirmation-admin.service');
const { PrismaService } = require('../dist/src/prisma/prisma.service');
const { AppointmentSourceRegistry, CAMPAIGN_IDENTITY, HttpCampaignContactClassifier } = require('../dist/src/confirmation-admin/appointment-source');

const database = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['127.0.0.1', 'host.docker.internal'].includes(database.hostname) || database.port !== '5548' || database.pathname !== '/appointments_homolog_fixture') {
  throw Error('Only the disposable fixture database on loopback:5548 is permitted');
}
if (!['http://127.0.0.1:8877', 'http://host.docker.internal:8877'].includes(process.env.SAUDEVIANET_INTERNAL_API_BASE) ||
    process.env.SAUDEVIANET_INTERNAL_API_TOKEN !== 'fixture-only') {
  throw Error('Only the fixture classifier is permitted');
}
const ref = (kind, value) => `${kind}:v1:fixture:${createHash('sha256').update(value).digest('hex')}`;
const subjects = ['adult', 'noauth', 'minor', 'expired', 'revoked', 'wrongphone'].map((key) => ({
  key, patientRef: ref('patient', key), recipientRef: ref('recipient', key),
  informedPhoneRef: ref('phone', key), displayName: `Fixture ${key}`,
}));
const items = subjects.flatMap((person) => (person.key === 'adult' ? ['09:00', '10:00'] : ['11:00']).map((time) => ({
  appointmentRef: ref('appt', person.key + time), patientRef: person.patientRef,
  recipientRef: person.recipientRef, informedPhoneRef: person.informedPhoneRef,
  recipientState: 'PENDING', reasonCode: 'verification_missing',
  appointmentTime: time, professionalRef: 'fixture-professional', agendaRef: 'fixture-agenda',
  sourceResolution: 'candidate', isMinor: person.key === 'minor',
})));

async function main() {
  const fixture = await Test.createTestingModule({ imports: [AuthModule, ConfirmationAdminModule] })
    .overrideProvider(AppointmentSourceRegistry).useValue(new AppointmentSourceRegistry([{
      key: 'SAUDEVIANET', label: 'Saúde Vianet (fixture)',
      async load() {
        const classified = await new HttpCampaignContactClassifier().classify(items.map((item) => ({
          appointmentRef: item.appointmentRef, patientRef: item.patientRef, recipientRef: item.recipientRef,
          phoneRef: item.informedPhoneRef, isMinor: item.isMinor, resolution: item.sourceResolution,
        })));
        const prepared = items.map((item) => {
          const result = classified.find((row) => row.appointmentRef === item.appointmentRef);
          return { ...item, recipientState: result.contactState.toUpperCase(), reasonCode: result.reasonCode };
        });
        return { connected: true, availability: 'partial', reason: 'partial_consultation', registry: 'ready', items: prepared,
        failures: [{ appointmentRef: ref('fail', 'failure'), recipientState: 'UNAVAILABLE', reasonCode: 'unexpected_response', agendaRef: 'fixture-failed-agenda' }] }; },
    }]))
    .overrideProvider(CAMPAIGN_IDENTITY).useValue({
      async identify() { return { state: 'ready', items: items.map((item) => ({
        appointmentRef: item.appointmentRef, displayName: subjects.find((p) => p.patientRef === item.patientRef).displayName,
        professionalName: 'Profissional fictício', phoneStatus: 'available', maskedPhone: '(11) 9****-0000',
      })) }; },
      async searchPatients(name) { return { state: 'ready', truncated: false, people: subjects.filter((p) => p.displayName.toLowerCase().includes(name.toLowerCase())).map((p) => ({
        displayName: p.displayName, patientRef: p.patientRef, recipientRef: p.recipientRef,
        phoneRef: p.informedPhoneRef, maskedPhone: '(11) 9****-0000', phoneStatus: 'available',
      })) }; },
    }).compile();
  const app = fixture.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  const prisma = app.get(PrismaService);
  await app.init();
  if (await prisma.user.count() || await prisma.confirmationCampaign.count()) throw Error('Fixture DB must be empty');
  const passwordHash = await hash('fixture-only-password', 4);
  const users = {};
  for (const role of ['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL']) {
    users[role] = await prisma.user.create({ data: { name: `Fixture ${role}`, usernameLogin: `fixture-${role.toLowerCase()}`, role, passwordHash } });
  }
  const actor = { typ: 'user', sub: users.ADMIN.id, usernameLogin: users.ADMIN.usernameLogin, role: 'ADMIN', jti: 'fixture-admin' };
  const service = app.get(ConfirmationAdminService);
  const now = Date.now();
  for (const person of subjects) {
    if (person.key !== 'noauth') {
      const expired = person.key === 'expired';
      const auth = await service.recordAuthorization(actor, {
        patientRef: person.patientRef, recipientRef: person.recipientRef, purpose: 'appointment_contact', channel: 'whatsapp',
        legalBasis: 'fixture-only', evidenceRef: 'fixture-only',
        validFrom: new Date(now - 172800000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        expiresAt: new Date(now + (expired ? -86400000 : 86400000)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      });
      person.authorizationId = auth.id;
      if (person.key === 'revoked') await service.revokeAuthorization(actor, auth.id);
    }
    if (['expired', 'revoked', 'wrongphone'].includes(person.key)) {
      const verification = await service.informVerification(actor, {
        patientRef: person.patientRef, recipientRef: person.recipientRef,
        informedPhoneRef: person.key === 'wrongphone' ? ref('phone', 'different') : person.informedPhoneRef,
        role: 'PATIENT', origin: 'IN_PERSON', evidenceRef: 'fixture-only',
      });
      await service.verifyContact(actor, verification.id, { procedure: 'IN_PERSON_CONFIRMATION', legalGuardianVerified: false });
    }
  }
  const jti = 'fixture-registry-read';
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({ typ: 'service', sub: 1, jti }, { expiresIn: '1h' });
  await prisma.serviceAccessToken.create({ data: {
    name: 'fixture-only', jti, tokenHash: createHash('sha256').update(token).digest('hex'),
    scopes: ['CLINIC_REGISTRY_READ'], createdById: users.ADMIN.id,
  } });
  writeFileSync('/tmp/higia-admin-homolog-fixture/session.json', JSON.stringify({ subjects, registryToken: token }), { mode: 0o600 });
  await app.listen(3105, '0.0.0.0'); // Container port must be published on host loopback only.
  console.log('Fixture backend ready on loopback:3105; disposable DB only');
  const shutdown = async () => { await app.close(); await prisma.$disconnect(); process.exit(0); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
main().catch((error) => { console.error('Fixture setup failed:', error.message); process.exit(1); });
