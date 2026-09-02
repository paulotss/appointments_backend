import { GuideImportMatcher } from './guide-import.matcher';
import { emptyExtractedGuide } from './extracted-guide';

describe('GuideImportMatcher', () => {
  const prisma = {
    healthPlan: { findFirst: jest.fn(), findMany: jest.fn() },
    healthProfessional: { findFirst: jest.fn(), findMany: jest.fn() },
    healthPlanProcedure: { findMany: jest.fn() },
    insuranceCard: { findFirst: jest.fn() },
    patient: { findMany: jest.fn() },
    insuranceGuide: { findUnique: jest.fn() },
  };
  const matcher = new GuideImportMatcher(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.healthPlan.findFirst.mockResolvedValue(null);
    prisma.healthPlan.findMany.mockResolvedValue([]);
    prisma.healthProfessional.findFirst.mockResolvedValue(null);
    prisma.healthProfessional.findMany.mockResolvedValue([]);
    prisma.healthPlanProcedure.findMany.mockResolvedValue([]);
    prisma.insuranceCard.findFirst.mockResolvedValue(null);
    prisma.patient.findMany.mockResolvedValue([]);
    prisma.insuranceGuide.findUnique.mockResolvedValue(null);
  });

  it('matches plan by ANS, professional by CRM and procedure by TUSS code', async () => {
    const plan = { id: 4, name: 'CASSI', registroAns: '346659' };
    const professional = {
      id: 7,
      name: 'LUIZ FERNANDO VIEIRA',
      councilType: 'CRM',
      councilNumber: '3163',
      councilUf: 'DF',
    };
    const procedure = {
      id: 9,
      name: 'CONSULTA',
      specialtyId: 1,
      tissGuideType: 'consulta',
    };
    prisma.healthPlan.findFirst.mockResolvedValue(plan);
    prisma.healthProfessional.findFirst.mockResolvedValue(professional);
    prisma.healthPlanProcedure.findMany.mockResolvedValue([
      { tissCode: '10101012', procedure },
    ]);
    prisma.insuranceCard.findFirst.mockResolvedValue({
      patient: { id: 3, name: 'MARIA', insuranceCards: [] },
    });

    const extracted = emptyExtractedGuide();
    extracted.healthPlan = { name: 'CASSI', registroAns: '346659' };
    extracted.professional = {
      name: 'Luiz Fernando Vieira',
      councilType: 'CRM',
      councilNumber: '3163',
      councilUf: 'DF',
      cbosCode: '225105',
      source: 'executante',
    };
    extracted.procedures = [
      {
        tissCode: '10101012',
        description: 'Consulta',
        requestedQuantity: 1,
        authorizedQuantity: 1,
      },
    ];
    extracted.patient = {
      name: 'Maria',
      cardNumber: '0300021048000055',
      cardExpirationDate: null,
    };

    const result = await matcher.match(extracted);

    expect(result.healthPlan?.id).toBe(4);
    expect(result.healthProfessional?.id).toBe(7);
    expect(result.procedures[0]?.match?.id).toBe(9);
    expect(result.patient?.id).toBe(3);
    expect(result.canAdvance).toBe(true);
    expect(result.missing.healthPlan).toBe(false);
  });

  it('blocks advance when plan or procedure is missing', async () => {
    const extracted = emptyExtractedGuide();
    extracted.healthPlan = { name: 'UNIMED', registroAns: '351033' };
    extracted.procedures = [
      {
        tissCode: '31601014',
        description: 'Acupuntura',
        requestedQuantity: 5,
        authorizedQuantity: 5,
      },
    ];

    const result = await matcher.match(extracted);

    expect(result.canAdvance).toBe(false);
    expect(result.missing.healthPlan).toBe(true);
    expect(result.missing.procedures).toEqual(['31601014']);
  });

  it('matches professional by council number even without council type', async () => {
    const professional = {
      id: 7,
      name: 'LUIZ FERNANDO VIEIRA',
      councilType: 'CRM',
      councilNumber: '3163',
      councilUf: 'DF',
    };
    prisma.healthProfessional.findFirst.mockResolvedValue(professional);

    const extracted = emptyExtractedGuide();
    extracted.professional = {
      name: null,
      councilType: null,
      councilNumber: '3163',
      councilUf: 'DF',
      cbosCode: null,
      source: null,
    };

    const result = await matcher.match(extracted);
    expect(result.healthProfessional?.id).toBe(7);
  });
});
