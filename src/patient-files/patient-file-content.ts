import { BadRequestException } from '@nestjs/common';
import { PatientFileKind } from '@prisma/client';

type GeneratedContent = {
  date: string;
  professionalName: string;
  professionalCouncil: string;
  medications?: { name: string; dosage: string; quantity: string }[];
  notes?: string;
  indication?: string;
  items?: { description: string }[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type GeneratedFileKind = 'MEDICAL_ORDER' | 'PRESCRIPTION';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Informe o conteúdo do documento.');
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, message: string, max: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    throw new BadRequestException(message);
  }
  return trimmed;
}

function optionalText(value: unknown, max: number): string {
  if (value == null) return '';
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new BadRequestException('Texto do documento inválido.');
  }
  return value.trim();
}

function requireDate(value: unknown): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new BadRequestException('Informe a data do documento.');
  }
  return value;
}

function parsePrescription(raw: Record<string, unknown>): GeneratedContent {
  if (
    !Array.isArray(raw.medications) ||
    raw.medications.length === 0 ||
    raw.medications.length > 30
  ) {
    throw new BadRequestException('Informe ao menos um medicamento.');
  }
  const medications = raw.medications.map((item) => {
    const line = asRecord(item);
    return {
      name: requireText(line.name, 'Informe o nome do medicamento.', 200),
      dosage: requireText(line.dosage, 'Informe a posologia.', 200),
      quantity: requireText(line.quantity, 'Informe a quantidade.', 80),
    };
  });
  return {
    date: requireDate(raw.date),
    professionalName: requireText(
      raw.professionalName,
      'Informe o nome do profissional.',
      150,
    ),
    professionalCouncil: requireText(
      raw.professionalCouncil,
      'Informe o conselho do profissional.',
      80,
    ),
    medications,
    notes: optionalText(raw.notes, 4000),
  };
}

function parseMedicalOrder(raw: Record<string, unknown>): GeneratedContent {
  if (
    !Array.isArray(raw.items) ||
    raw.items.length === 0 ||
    raw.items.length > 30
  ) {
    throw new BadRequestException('Informe ao menos um exame ou procedimento.');
  }
  const items = raw.items.map((item) => {
    const line = asRecord(item);
    return {
      description: requireText(
        line.description,
        'Informe o exame ou procedimento.',
        300,
      ),
    };
  });
  return {
    date: requireDate(raw.date),
    professionalName: requireText(
      raw.professionalName,
      'Informe o nome do profissional.',
      150,
    ),
    professionalCouncil: requireText(
      raw.professionalCouncil,
      'Informe o conselho do profissional.',
      80,
    ),
    indication: requireText(
      raw.indication,
      'Informe a indicação clínica.',
      4000,
    ),
    items,
  };
}

export function parseGeneratedContent(
  kind: GeneratedFileKind,
  content: unknown,
): GeneratedContent {
  const raw = asRecord(content);
  if (kind === PatientFileKind.PRESCRIPTION) {
    return parsePrescription(raw);
  }
  return parseMedicalOrder(raw);
}

export function titleForGenerated(
  kind: GeneratedFileKind,
  date: string,
): string {
  const label =
    kind === PatientFileKind.PRESCRIPTION ? 'Receituário' : 'Pedido médico';
  return `${label} ${date}`;
}
