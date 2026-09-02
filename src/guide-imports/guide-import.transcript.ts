import { TissGuideType } from '@prisma/client';
import {
  digitsOnly,
  isoDateOrNull,
  mapCouncilType,
  rejectLabelLikeName,
  sanitizeExtractedGuide,
  type ExtractedGuide,
  type ExtractedProcedure,
} from './extracted-guide';

function firstCapture(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function firstLine(value: string): string {
  return value.split(/\n/)[0]?.trim() ?? '';
}

function inferGuideType(text: string): TissGuideType | null {
  const head = text.slice(0, 280);
  if (/sp\s*\/?\s*sadt|servi[cç]o profissional/i.test(head)) {
    return TissGuideType.sp_sadt;
  }
  if (/guia de consulta/i.test(head) || /\bconsulta\b/i.test(head)) {
    return TissGuideType.consulta;
  }
  return null;
}

export function completeExtractedGuideFromTranscript(
  extracted: ExtractedGuide,
  transcript: string,
): ExtractedGuide {
  const text = transcript.replace(/\r/g, '').trim();
  if (!text) return extracted;

  const registroAns =
    extracted.healthPlan.registroAns ??
    firstCapture(text, [
      /registro\s*(?:da\s*)?ans[^\d]{0,24}(\d{6})/i,
      /\bans[^\d]{0,12}(\d{6})\b/i,
    ]);

  const healthPlanName =
    extracted.healthPlan.name ??
    rejectLabelLikeName(
      firstLine(
        firstCapture(text, [
          /nome da operadora[:\s]+([^\n]{3,80})/i,
          /(?:^|\n)\s*operadora[:\s]+([^\n]{3,80})/i,
          /plano de sa[uú]de[:\s]+([^\n]{3,80})/i,
        ]) ?? '',
      ),
    );

  const patientName =
    extracted.patient.name ??
    rejectLabelLikeName(
      firstLine(
        firstCapture(text, [
          /nome do benefici[aá]rio[:\s]+([^\n]{3,80})/i,
          /dados do benefici[aá]rio[\s\S]{0,160}?nome[:\s]+([A-ZÁÉÍÓÚÃÕÇ][^\n]{3,80})/i,
          /(?:^|\n)\s*7\s*[-.)]?\s*(?:nome[:\s]+)?([A-ZÁÉÍÓÚÃÕÇ][^\n]{3,80})/i,
        ]) ?? '',
      ),
    );

  const cardNumber =
    extracted.patient.cardNumber ??
    digitsOrNull(
      firstCapture(text, [
        /n[uú]mero da carteira[^\d\n]{0,24}([0-9. \-]{8,40})/i,
        /(?:^|\n)\s*4\s*[-.)]?[^\d\n]{0,48}([0-9. \-]{8,40})/i,
      ]),
    );

  const cardExpirationDate =
    extracted.patient.cardExpirationDate ??
    isoDateOrNull(
      firstCapture(text, [
        /validade(?: da carteira)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
      ]),
    );

  const professionalName =
    extracted.professional.name ??
    rejectLabelLikeName(
      firstLine(
        firstCapture(text, [
          /nome do profissional(?:\s+executante)?[:\s]+([^\n]{3,80})/i,
          /profissional executante[:\s]+([A-ZÁÉÍÓÚÃÕÇ][^\n]{3,80})/i,
          /(?:^|\n)\s*12\s*[-.)]?\s*(?:nome[^\n:]{0,40}:\s*)?([A-ZÁÉÍÓÚÃÕÇ][^\n]{3,80})/i,
        ]) ?? '',
      ),
    );

  const stampMatch =
    /\b(CRM|CRO|CRP|COREN)[-\s:]*([A-Za-z]{2})[-\s:]*(\d{3,8})\b/i.exec(text);
  const councilMatch =
    /\b(CRM|CRO|CRP|COREN)\s*[:\-/]?\s*(\d{3,8})(?:\s*[/\-]\s*|\s+UF[:\s]*|\s+)([A-Za-z]{2})?/i.exec(
      text,
    );

  const councilType =
    extracted.professional.councilType ??
    mapCouncilType(stampMatch?.[1] ?? null) ??
    mapCouncilType(councilMatch?.[1] ?? null) ??
    mapCouncilType(
      firstCapture(text, [
        /conselho profissional[:\s]+([A-Za-z]{2,10})/i,
        /(?:^|\n)\s*13\s*[-.)]?\s*(?:conselho[^\n]{0,24}:\s*)?([A-Za-z]{2,10})/i,
      ]),
    );

  const councilNumber =
    extracted.professional.councilNumber ??
    stampMatch?.[3] ??
    councilMatch?.[2] ??
    firstCapture(text, [
      /n[uú]mero no conselho[^\d]{0,24}(\d{3,8})/i,
      /(?:^|\n)\s*14\s*[-.)]?[^\d]{0,48}(\d{3,8})/i,
    ]);

  const councilUf =
    extracted.professional.councilUf ??
    (stampMatch?.[2] ? stampMatch[2].toUpperCase() : null) ??
    (councilMatch?.[3] ? councilMatch[3].toUpperCase() : null) ??
    firstCapture(text, [
      /(?:^|\n)\s*15\s*[-.)]?\s*UF[:\s]*([A-Za-z]{2})/i,
      /(?:^|\n)\s*UF[:\s]+([A-Za-z]{2})\b/im,
    ])?.toUpperCase() ??
    null;

  const cbosCode =
    extracted.professional.cbosCode ??
    firstCapture(text, [
      /\bCBO[-\sS]*[:\s]*(\d{6})\b/i,
      /(?:^|\n)\s*16\s*[-.)]?[^\d]{0,40}(\d{6})/i,
    ]);

  const operatorGuideNumber =
    extracted.guide.operatorGuideNumber ??
    firstCapture(text, [
      /n[uú]mero da guia(?:\s+(?:atribu[ií]do\s+)?pela\s+operadora|\s+na\s+operadora)?[^\d\n]{0,8}([0-9]{6,20})/i,
      /(?:^|\n)\s*3\s*[-.)]?[^\d\n]{0,80}([0-9]{6,20})/i,
    ]);

  const providerGuideNumber =
    extracted.guide.providerGuideNumber ??
    firstCapture(text, [
      /(?:n[ºo°]?\s*)?guia no prestador[^\d\n]{0,24}([0-9]{6,20})/i,
      /(?:^|\n)\s*2\s*[-.)]?[^\d\n]{0,48}([0-9]{6,20})/i,
    ]);

  const attendanceDate =
    extracted.guide.attendanceDate ??
    isoDateOrNull(
      firstCapture(text, [
        /data (?:do )?atendimento[^\d\n]{0,16}(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
        /(?:^|\n)\s*18\s*[-.)]?[^\d\n]{0,40}(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
      ]),
    );

  const authorizationDate =
    extracted.guide.authorizationDate ??
    isoDateOrNull(
      firstCapture(text, [
        /data (?:de )?autoriza[cç][aã]o[^\d\n]{0,16}(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
      ]),
    );

  const passwordExpirationDate =
    extracted.guide.passwordExpirationDate ??
    isoDateOrNull(
      firstCapture(text, [
        /validade da senha[^\d\n]{0,16}(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
        /data (?:de )?validade da (?:senha|autoriza[cç][aã]o)[^\d\n]{0,16}(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
      ]),
    );

  const procedures =
    extracted.procedures.length > 0
      ? extracted.procedures
      : extractProceduresFromTranscript(text);

  return sanitizeExtractedGuide({
    tissGuideType: extracted.tissGuideType ?? inferGuideType(text),
    healthPlan: {
      name: healthPlanName,
      registroAns,
    },
    patient: {
      name: patientName,
      cardNumber,
      cardExpirationDate,
    },
    professional: {
      name: professionalName,
      councilType,
      councilNumber,
      councilUf,
      cbosCode,
      source: extracted.professional.source,
    },
    procedures,
    guide: {
      operatorGuideNumber,
      providerGuideNumber,
      authorizationDate,
      passwordExpirationDate,
      attendanceDate,
    },
  });
}

function digitsOrNull(value: string | null): string | null {
  if (!value) return null;
  const digits = digitsOnly(value);
  return digits.length > 0 ? digits : null;
}

function isLikelyTussCode(code: string): boolean {
  return /^\d{8}$/.test(code) && /^[1-8]/.test(code);
}

function procedureDescription(text: string): string | null {
  const captured = firstCapture(text, [
    /observa[cç][aã]o(?:\s*\/\s*justificativa)?[:\s]+([^\n]{5,160})/i,
    /justificativa[:\s]+([^\n]{5,160})/i,
    /(?:^|\n)\s*23\s*[-.)]?\s*(?:observa[cç][aã]o[^\n]{0,40}:\s*)?([A-Za-zÀ-ú][^\n]{5,160})/i,
  ]);
  const description = rejectLabelLikeName(firstLine(captured ?? ''));
  return description;
}

export function extractProceduresFromTranscript(
  text: string,
): ExtractedProcedure[] {
  const description = procedureDescription(text);
  const found: ExtractedProcedure[] = [];
  const seen = new Set<string>();

  function add(raw: string, desc: string | null) {
    const code = digitsOnly(raw);
    if (!isLikelyTussCode(code) || seen.has(code)) return;
    seen.add(code);
    found.push({
      tissCode: code,
      description: desc,
      requestedQuantity: null,
      authorizedQuantity: 1,
    });
  }

  for (const match of text.matchAll(
    /c[oó]digo(?:\s+do)?\s+procedimento[^\d]{0,32}(\d{8})/gi,
  )) {
    add(match[1] ?? '', description);
  }

  for (const match of text.matchAll(
    /(?:^|\n)\s*21\s*[-.)]?\s*[^\d]{0,48}(\d{8})/g,
  )) {
    add(match[1] ?? '', description);
  }

  const dotted = /(\d{2}[.\s]\d{2,3}[.\s]\d{2,4})\s+([A-Za-zÀ-ú][^\n]{2,70})/g;
  for (const match of text.matchAll(dotted)) {
    add(match[1] ?? '', firstLine(match[2] ?? '') || description);
  }

  const plain = /\b(\d{8})\s+([A-Za-zÀ-ú][^\n]{2,70})/g;
  for (const match of text.matchAll(plain)) {
    add(match[1] ?? '', firstLine(match[2] ?? '') || description);
  }

  if (found.length === 0) {
    for (const match of text.matchAll(/\b(\d{8})\b/g)) {
      add(match[1] ?? '', description);
    }
  }

  if (found.length === 1 && !found[0]?.description && description) {
    found[0] = { ...found[0], description };
  }

  return found;
}
