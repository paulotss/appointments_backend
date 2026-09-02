import { CouncilType, TissGuideType } from '@prisma/client';

export type ProfessionalSource = 'executante' | 'solicitante';

export type ExtractedHealthPlan = {
  name: string | null;
  registroAns: string | null;
};

export type ExtractedPatient = {
  name: string | null;
  cardNumber: string | null;
  cardExpirationDate: string | null;
};

export type ExtractedProfessional = {
  name: string | null;
  councilType: CouncilType | null;
  councilNumber: string | null;
  councilUf: string | null;
  cbosCode: string | null;
  source: ProfessionalSource | null;
};

export type ExtractedProcedure = {
  tissCode: string | null;
  description: string | null;
  requestedQuantity: number | null;
  authorizedQuantity: number | null;
};

export type ExtractedGuideMeta = {
  operatorGuideNumber: string | null;
  providerGuideNumber: string | null;
  authorizationDate: string | null;
  passwordExpirationDate: string | null;
  attendanceDate: string | null;
};

export type ExtractedGuide = {
  tissGuideType: TissGuideType | null;
  healthPlan: ExtractedHealthPlan;
  patient: ExtractedPatient;
  professional: ExtractedProfessional;
  procedures: ExtractedProcedure[];
  guide: ExtractedGuideMeta;
};

const COUNCIL_TYPES = new Set<string>(Object.values(CouncilType));
const GUIDE_TYPES = new Set<string>(Object.values(TissGuideType));
const UF_SET = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function foldLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const JUNK_EXTRACTED_NAMES = new Set([
  'guia de consulta',
  'guia de sp sadt',
  'guia sp sadt',
  'guia de sadt',
  'guia sadt',
  'padrao tiss',
  'tiss',
  'consulta',
  'sp sadt',
  'sadt',
  'operadora',
  'plano de saude',
  'nome da operadora',
  'beneficiario',
  'nome do beneficiario',
  'profissional',
  'profissional executante',
  'profissional solicitante',
  'nome do profissional',
  'codigo na tabela',
  'procedimento',
]);

export function rejectLabelLikeName(value: string | null): string | null {
  if (!value) return null;
  const folded = foldLabel(value);
  if (!folded || JUNK_EXTRACTED_NAMES.has(folded)) return null;
  if (/^guia de /.test(folded)) return null;
  if (!/[a-z]/.test(folded)) return null;
  return value.trim();
}

export function isoDateOrNull(value: unknown): string | null {
  const text = nullableText(value);
  if (!text) return null;
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const day = br[1].padStart(2, '0');
    const month = br[2].padStart(2, '0');
    const year = br[3];
    return isValidIsoDate(`${year}-${month}-${day}`)
      ? `${year}-${month}-${day}`
      : null;
  }
  const iso = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) {
    const year = iso[1];
    const month = iso[2].padStart(2, '0');
    const day = iso[3].padStart(2, '0');
    return isValidIsoDate(`${year}-${month}-${day}`)
      ? `${year}-${month}-${day}`
      : null;
  }
  return null;
}

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function positiveIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const digits = value.replace(/\D/g, '');
    if (!digits) return null;
    const parsed = Number(digits);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function mapCouncilType(value: unknown): CouncilType | null {
  const text = nullableText(value);
  if (!text) return null;
  const upper = text.toUpperCase().replace(/[^A-Z]/g, '');
  if (COUNCIL_TYPES.has(upper)) {
    return upper as CouncilType;
  }
  if (upper.includes('CRM') || upper.includes('MEDICINA')) {
    return CouncilType.CRM;
  }
  if (upper.includes('CRO') || upper.includes('ODONTO')) {
    return CouncilType.CRO;
  }
  if (upper.includes('CRP') || upper.includes('PSICO')) {
    return CouncilType.CRP;
  }
  if (upper.includes('COREN') || upper.includes('ENFERM')) {
    return CouncilType.COREN;
  }
  return null;
}

export function mapGuideType(value: unknown): TissGuideType | null {
  const text = nullableText(value);
  if (!text) return null;
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, '_');
  if (GUIDE_TYPES.has(normalized)) {
    return normalized as TissGuideType;
  }
  if (normalized.includes('consulta')) return TissGuideType.consulta;
  if (
    normalized.includes('sadt') ||
    normalized.includes('sp_sadt') ||
    normalized.includes('terapia') ||
    normalized.includes('diagnostico') ||
    normalized.includes('diagnóstico')
  ) {
    return TissGuideType.sp_sadt;
  }
  return null;
}

export function mapProfessionalSource(
  value: unknown,
): ProfessionalSource | null {
  const text = nullableText(value);
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  if (normalized.includes('execut')) return 'executante';
  if (normalized.includes('solicit')) return 'solicitante';
  return null;
}

export function normalizeTissCode(value: string): string {
  return digitsOnly(value);
}

export function emptyExtractedGuide(): ExtractedGuide {
  return {
    tissGuideType: null,
    healthPlan: { name: null, registroAns: null },
    patient: { name: null, cardNumber: null, cardExpirationDate: null },
    professional: {
      name: null,
      councilType: null,
      councilNumber: null,
      councilUf: null,
      cbosCode: null,
      source: null,
    },
    procedures: [],
    guide: {
      operatorGuideNumber: null,
      providerGuideNumber: null,
      authorizationDate: null,
      passwordExpirationDate: null,
      attendanceDate: null,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload) as unknown;
}

export function sanitizeExtractedGuide(input: unknown): ExtractedGuide {
  const root = asRecord(input);
  const healthPlan = asRecord(root.healthPlan);
  const patient = asRecord(root.patient);
  const professional = asRecord(root.professional);
  const guide = asRecord(root.guide);
  const rawProcedures = Array.isArray(root.procedures) ? root.procedures : [];

  const registroAnsDigits = digitsOnly(
    nullableText(healthPlan.registroAns) ?? '',
  );
  const cardDigits = digitsOnly(nullableText(patient.cardNumber) ?? '');
  const councilNumber = nullableText(professional.councilNumber);
  const uf = (nullableText(professional.councilUf) ?? '').toUpperCase();
  const cbosDigits = digitsOnly(nullableText(professional.cbosCode) ?? '');

  const procedures = rawProcedures
    .map((item) => {
      const row = asRecord(item);
      const codeDigits = digitsOnly(nullableText(row.tissCode) ?? '');
      return {
        tissCode: codeDigits.length > 0 ? codeDigits : null,
        description: nullableText(row.description),
        requestedQuantity: positiveIntOrNull(row.requestedQuantity),
        authorizedQuantity: positiveIntOrNull(row.authorizedQuantity),
      };
    })
    .filter(
      (item) =>
        item.tissCode != null ||
        item.description != null ||
        item.authorizedQuantity != null ||
        item.requestedQuantity != null,
    );

  return {
    tissGuideType: mapGuideType(root.tissGuideType),
    healthPlan: {
      name: rejectLabelLikeName(nullableText(healthPlan.name)),
      registroAns: registroAnsDigits.length === 6 ? registroAnsDigits : null,
    },
    patient: {
      name: rejectLabelLikeName(nullableText(patient.name)),
      cardNumber: cardDigits.length > 0 ? cardDigits : null,
      cardExpirationDate: isoDateOrNull(patient.cardExpirationDate),
    },
    professional: {
      name: rejectLabelLikeName(nullableText(professional.name)),
      councilType: mapCouncilType(professional.councilType),
      councilNumber: councilNumber,
      councilUf: UF_SET.has(uf) ? uf : null,
      cbosCode: cbosDigits.length === 6 ? cbosDigits : null,
      source: mapProfessionalSource(professional.source),
    },
    procedures,
    guide: {
      operatorGuideNumber: nullableText(guide.operatorGuideNumber),
      providerGuideNumber: nullableText(guide.providerGuideNumber),
      authorizationDate: isoDateOrNull(guide.authorizationDate),
      passwordExpirationDate: isoDateOrNull(guide.passwordExpirationDate),
      attendanceDate: isoDateOrNull(guide.attendanceDate),
    },
  };
}

export function parseExtractedGuideJson(raw: string): ExtractedGuide {
  try {
    return sanitizeExtractedGuide(parseJsonPayload(raw));
  } catch {
    return emptyExtractedGuide();
  }
}

export function suggestedGuideNumber(extracted: ExtractedGuide): string | null {
  return (
    extracted.guide.operatorGuideNumber ?? extracted.guide.providerGuideNumber
  );
}

export function suggestedAuthorizationDate(
  extracted: ExtractedGuide,
): string | null {
  return extracted.guide.authorizationDate ?? extracted.guide.attendanceDate;
}

export function suggestedExpirationDate(
  extracted: ExtractedGuide,
): string | null {
  return extracted.guide.passwordExpirationDate;
}
