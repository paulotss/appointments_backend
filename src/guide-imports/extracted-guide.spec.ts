import { CouncilType, TissGuideType } from '@prisma/client';
import {
  isoDateOrNull,
  mapCouncilType,
  parseExtractedGuideJson,
  sanitizeExtractedGuide,
} from './extracted-guide';

describe('sanitizeExtractedGuide', () => {
  it('normalizes ANS, card, TUSS code and BR dates', () => {
    const extracted = sanitizeExtractedGuide({
      tissGuideType: 'GUIA DE CONSULTA',
      healthPlan: { name: ' CASSI ', registroAns: '346.659' },
      patient: {
        name: 'Maria Silva',
        cardNumber: '0300 0210 4800 0055',
        cardExpirationDate: '17/08/2026',
      },
      professional: {
        name: 'Dr. Teste',
        councilType: 'crm-df',
        councilNumber: '3163',
        councilUf: 'df',
        cbosCode: '225105',
        source: 'Executante',
      },
      procedures: [
        {
          tissCode: '10.101.012',
          description: 'Consulta',
          authorizedQuantity: '1',
        },
      ],
      guide: {
        operatorGuideNumber: '794250219',
        authorizationDate: '2026-08-17',
      },
    });

    expect(extracted.tissGuideType).toBe(TissGuideType.consulta);
    expect(extracted.healthPlan.registroAns).toBe('346659');
    expect(extracted.patient.cardNumber).toBe('0300021048000055');
    expect(extracted.patient.cardExpirationDate).toBe('2026-08-17');
    expect(extracted.professional.councilType).toBe(CouncilType.CRM);
    expect(extracted.professional.councilUf).toBe('DF');
    expect(extracted.procedures[0]?.tissCode).toBe('10101012');
    expect(extracted.procedures[0]?.authorizedQuantity).toBe(1);
  });

  it('maps SP/SADT titles and ignores empty invented fields', () => {
    const extracted = sanitizeExtractedGuide({
      tissGuideType: 'SP/SADT',
      healthPlan: { name: '', registroAns: '12' },
      patient: { name: '   ', cardNumber: null },
      professional: { councilType: 'xyz', councilUf: 'XX' },
      procedures: [],
      guide: { attendanceDate: '32/13/2026' },
    });

    expect(extracted.tissGuideType).toBe(TissGuideType.sp_sadt);
    expect(extracted.healthPlan.registroAns).toBeNull();
    expect(extracted.patient.name).toBeNull();
    expect(extracted.professional.councilType).toBeNull();
    expect(extracted.professional.councilUf).toBeNull();
    expect(extracted.guide.attendanceDate).toBeNull();
  });

  it('drops form titles copied as health plan or person names', () => {
    const extracted = sanitizeExtractedGuide({
      tissGuideType: 'consulta',
      healthPlan: { name: 'Guia de consulta', registroAns: null },
      patient: { name: 'Nome do beneficiário' },
      professional: { name: 'Profissional executante' },
    });
    expect(extracted.healthPlan.name).toBeNull();
    expect(extracted.patient.name).toBeNull();
    expect(extracted.professional.name).toBeNull();
  });

  it('parses JSON inside markdown fences', () => {
    const extracted = parseExtractedGuideJson(
      '```json\n{"tissGuideType":"consulta","healthPlan":{"name":"CASSI"}}\n```',
    );
    expect(extracted.tissGuideType).toBe(TissGuideType.consulta);
    expect(extracted.healthPlan.name).toBe('CASSI');
  });
});

describe('isoDateOrNull', () => {
  it('accepts ISO and BR dates', () => {
    expect(isoDateOrNull('2026-08-17')).toBe('2026-08-17');
    expect(isoDateOrNull('8/7/2026')).toBe('2026-07-08');
  });
});

describe('mapCouncilType', () => {
  it('maps verbose labels to CRM', () => {
    expect(mapCouncilType('Conselho Regional de Medicina')).toBe(
      CouncilType.CRM,
    );
  });
});
