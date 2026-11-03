import { BadRequestException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

const PATIENT_REF = /^patient:v1:[a-z][a-z0-9_-]{0,31}:[0-9a-f]{64}$/;
const RECIPIENT_REF = /^recipient:v1:[a-z][a-z0-9_-]{0,31}:[0-9a-f]{64}$/;
const PHONE_REF = /^phone:v1:[a-z][a-z0-9_-]{0,31}:[0-9a-f]{64}$/;
const OPAQUE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const APPOINTMENT_REF = /^[a-z][a-z0-9_.:-]{0,80}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const LONG_DIGIT_RUN = /\d{8,}/;

export const APPOINTMENT_CONTACT_PURPOSE = 'appointment_contact';
export const WHATSAPP_CHANNEL = 'whatsapp';
export const UNATTACHED_EVIDENCE = 'evidence:unattached';

export function ownershipRecordId(): string {
  return `own-${randomBytes(16).toString('hex')}`;
}

export function authorizationRecordId(): string {
  return `aut-${randomBytes(16).toString('hex')}`;
}

export function associationRecordId(): string {
  return randomUUID();
}

export function assertPatientRef(value: string): string {
  return assertMatch(value, PATIENT_REF, 'Referência de paciente inválida.');
}

export function assertRecipientRef(value: string): string {
  return assertMatch(
    value,
    RECIPIENT_REF,
    'Referência de destinatário inválida.',
  );
}

export function assertPhoneRef(value: string): string {
  return assertMatch(value, PHONE_REF, 'Referência de telefone inválida.');
}

export function assertOptionalPhoneRef(
  value: string | null | undefined,
): string | null {
  if (value == null || value === '') {
    return null;
  }
  return assertPhoneRef(value);
}

export function assertOpaque(value: string, label: string): string {
  return assertMatch(value, OPAQUE, `${label} inválida.`);
}

export function assertOptionalOpaque(
  value: string | null | undefined,
  label: string,
): string | null {
  if (value == null || value === '') {
    return null;
  }
  return assertOpaque(value, label);
}

export function assertAppointmentRef(value: string): string {
  const ref = assertMatch(
    value,
    APPOINTMENT_REF,
    'Referência de agendamento inválida.',
  );
  if (LONG_DIGIT_RUN.test(ref)) {
    throw new BadRequestException('Referência de agendamento inválida.');
  }
  return ref;
}

export function assertCampaignDate(value: string): string {
  const date = assertMatch(value, DATE_ONLY, 'Data da campanha inválida.');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new BadRequestException('Data da campanha inválida.');
  }
  return date;
}

export function assertInstant(value: string, label: string): Date {
  assertMatch(value, INSTANT, `${label} inválida.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} inválida.`);
  }
  return parsed;
}

export function formatInstant(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function campaignDateValue(date: string): Date {
  return new Date(`${assertCampaignDate(date)}T00:00:00.000Z`);
}

function assertMatch(value: string, pattern: RegExp, message: string): string {
  if (!pattern.test(value)) {
    throw new BadRequestException(message);
  }
  return value;
}
