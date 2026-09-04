import { CouncilType, TissGuideType } from '@prisma/client';
import {
  emptyExtractedGuide,
  sanitizeExtractedGuide,
  suggestedGuideNumber,
} from './extracted-guide';
import { completeExtractedGuideFromTranscript } from './guide-import.transcript';

const CASSI_CONSULTA = `
GUIA DE CONSULTA
Padrão TISS
Registro ANS 346659
Número da Guia na Operadora 794250219
Operadora: CASSI
Nome do Beneficiário: MARIA SILVA
Número da Carteira: 0300 0210 4800 0055
Validade da carteira: 17/08/2026
Nome do Profissional Executante: LUIZ FERNANDO VIEIRA
Conselho: CRM 3163 UF: DF
CBO-S: 225105
Tabela 22 Código 10.10.1012 CONSULTA EM CONSULTORIO Qtde 1
Data do atendimento: 17/08/2026
`;

describe('completeExtractedGuideFromTranscript', () => {
  it('fills plan, professional, patient and TUSS when the model returns empty JSON', () => {
    const extracted = completeExtractedGuideFromTranscript(
      emptyExtractedGuide(),
      CASSI_CONSULTA,
    );

    expect(extracted.tissGuideType).toBe(TissGuideType.consulta);
    expect(extracted.healthPlan.name).toBe('CASSI');
    expect(extracted.healthPlan.registroAns).toBe('346659');
    expect(extracted.patient.name).toBe('MARIA SILVA');
    expect(extracted.patient.cardNumber).toBe('0300021048000055');
    expect(extracted.professional.name).toBe('LUIZ FERNANDO VIEIRA');
    expect(extracted.professional.councilType).toBe(CouncilType.CRM);
    expect(extracted.professional.councilNumber).toBe('3163');
    expect(extracted.professional.councilUf).toBe('DF');
    expect(extracted.professional.cbosCode).toBe('225105');
    expect(extracted.procedures[0]?.tissCode).toBe('10101012');
    expect(extracted.guide.operatorGuideNumber).toBe('794250219');
  });

  it('reads TISS consulta fields 12-16 and procedure code 21 without adjacent description', () => {
    const extracted = completeExtractedGuideFromTranscript(
      emptyExtractedGuide(),
      `
CASSI
GUIA DE CONSULTA
1 Registro ANS 346659
2 Nº Guia no Prestador 322776148
3 Número da Guia Atribuído pela Operadora 794250219
4 Numero da Carteira 03000210480000055
7 Nome CLEIDINA SOUZA CAIXETA SANTOS
8 Nome do Contratado INSTITUTO SERAPHIS S/C LTDA
12 Nome do Profissional Executante Luiz Fernando Vieira
13 Conselho Profissional CRM
14 Numero no Conselho 3163
15 UF DF
16 Codigo CBO 225105
18 Data do Atendimento 17/08/2026
20 Tabela 22
21 Codigo do Procedimento 10101012
22 Valor do Procedimento 0,00
23 Observação / Justificativa CONSULTA EM CONSULTÓRIO (NO HORÁRIO NORMAL OU PREESTABELECIDO)
`,
    );

    expect(extracted.professional.name).toBe('Luiz Fernando Vieira');
    expect(extracted.professional.councilType).toBe(CouncilType.CRM);
    expect(extracted.professional.councilNumber).toBe('3163');
    expect(extracted.professional.councilUf).toBe('DF');
    expect(extracted.professional.cbosCode).toBe('225105');
    expect(extracted.procedures[0]?.tissCode).toBe('10101012');
    expect(extracted.procedures[0]?.description).toMatch(
      /CONSULTA EM CONSULT/i,
    );
    expect(extracted.patient.name).toBe('CLEIDINA SOUZA CAIXETA SANTOS');
    expect(extracted.patient.cardNumber).toBe('03000210480000055');
    expect(extracted.guide.operatorGuideNumber).toBe('794250219');
    expect(extracted.guide.providerGuideNumber).toBe('322776148');
    expect(suggestedGuideNumber(extracted)).toBe('322776148');
    expect(extracted.guide.attendanceDate).toBe('2026-08-17');
  });

  it('does not treat the form title as the health plan', () => {
    const extracted = completeExtractedGuideFromTranscript(
      emptyExtractedGuide(),
      'GUIA DE CONSULTA\nPadrão TISS\nNome do Beneficiário: ANA',
    );
    expect(extracted.healthPlan.name).toBeNull();
    expect(extracted.tissGuideType).toBe(TissGuideType.consulta);
    expect(extracted.patient.name).toBe('ANA');
  });

  it('recovers TUSS from transcript when the model only copied the word Consulta', () => {
    const extracted = completeExtractedGuideFromTranscript(
      sanitizeExtractedGuide({
        tissGuideType: 'consulta',
        procedures: [{ description: 'Consulta' }],
      }),
      `
Nome do Beneficiário: MARIA SILVA
21 Codigo do Procedimento 10101012
23 Observação / Justificativa CONSULTA EM CONSULTÓRIO
`,
    );
    expect(extracted.patient.name).toBe('MARIA SILVA');
    expect(extracted.procedures[0]?.tissCode).toBe('10101012');
  });

  it('keeps values already extracted by the model', () => {
    const extracted = completeExtractedGuideFromTranscript(
      {
        ...emptyExtractedGuide(),
        healthPlan: { name: 'Unimed', registroAns: '123456' },
      },
      CASSI_CONSULTA,
    );
    expect(extracted.healthPlan.name).toBe('Unimed');
    expect(extracted.healthPlan.registroAns).toBe('123456');
  });
});
