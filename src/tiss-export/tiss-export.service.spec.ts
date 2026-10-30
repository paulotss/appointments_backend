import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BillingBatchStatus,
  ClinicalAppointmentStatus,
  TissGuideType,
} from '@prisma/client';
import { TissExportService } from './tiss-export.service';

describe('TissExportService.exportBatch', () => {
  const prisma = {
    billingBatch: { findUnique: jest.fn() },
    clinicProfile: { findUnique: jest.fn() },
  };
  const service = new TissExportService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing batches', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue(null);
    await expect(service.exportBatch(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects cancelled batches', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 1,
      status: BillingBatchStatus.cancelled,
      healthPlan: {},
      guides: [],
    });
    await expect(service.exportBatch(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows open batches to export', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 1,
      status: BillingBatchStatus.open,
      batchNumber: '1-20260901',
      healthPlanId: 3,
      healthPlan: {
        registroAns: '351033',
        providerCode: '99999',
        tissVersion: '4.03.00',
      },
      guides: [],
    });
    prisma.clinicProfile.findUnique.mockResolvedValue({
      legalName: 'Clinica Exemplo Ltda',
      cnpj: '12345678000199',
      cnes: '1234567',
    });
    await expect(service.exportBatch(1)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('collects missing TISS fields as 422 messages', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 1,
      status: BillingBatchStatus.billed,
      batchNumber: '1-20260901',
      healthPlanId: 3,
      healthPlan: {
        registroAns: null,
        providerCode: null,
        tissVersion: '4.03.00',
      },
      guides: [
        {
          insuranceGuide: {
            id: 8,
            guideNumber: null,
            tissGuideType: TissGuideType.consulta,
            authorizationDate: new Date('2026-08-01T00:00:00.000Z'),
            patient: { insuranceCards: [] },
            healthProfessional: {
              name: 'DR CARLOS',
              councilType: 'CRM',
              councilNumber: '123456',
              councilUf: null,
            },
            procedures: [
              {
                usedQuantity: 1,
                value: 80,
                procedure: {
                  name: 'CONSULTA',
                  tissGuideType: TissGuideType.consulta,
                  specialty: { id: 4, name: 'CARDIOLOGIA', cbosCode: null },
                  healthPlanPrices: [],
                },
              },
            ],
            clinicalAppointmentGuides: [],
          },
        },
      ],
    });
    prisma.clinicProfile.findUnique.mockResolvedValue(null);

    await expect(service.exportBatch(1)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    try {
      await service.exportBatch(1);
    } catch (error) {
      const response = (error as UnprocessableEntityException).getResponse() as {
        message: string[];
      };
      expect(response.message).toEqual(
        expect.arrayContaining([
          'Clínica: informe a razão social.',
          'Clínica: informe o CNPJ com 14 dígitos.',
          'Clínica: informe o CNES com 7 dígitos.',
          'Plano: informe o registro ANS com 6 dígitos.',
          'Guia #8: informe o número da guia.',
          'Guia #8: paciente sem carteira deste plano.',
          'Guia #8: informe a UF do conselho do profissional.',
          'Guia #8: informe o CBO-S da especialidade CARDIOLOGIA (6 dígitos).',
        ]),
      );
    }
  });

  it('builds a consulta xml when the batch is complete', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 15,
      status: BillingBatchStatus.billed,
      batchNumber: '15-20260901',
      healthPlanId: 3,
      healthPlan: {
        registroAns: '351033',
        providerCode: '99999',
        tissVersion: '4.03.00',
      },
      guides: [
        {
          insuranceGuide: {
            id: 8,
            guideNumber: 'G-1',
            tissGuideType: TissGuideType.consulta,
            authorizationDate: new Date('2026-08-01T00:00:00.000Z'),
            patient: {
              insuranceCards: [{ healthPlanId: 3, cardNumber: '000111' }],
            },
            participationDegree: '12',
            healthProfessional: {
              name: 'DR CARLOS',
              councilType: 'CRM',
              councilNumber: '123456',
              councilUf: 'SP',
            },
            procedures: [
              {
                usedQuantity: 1,
                value: 80,
                procedure: {
                  name: 'CONSULTA',
                  tissGuideType: TissGuideType.consulta,
                  specialty: { id: 4, name: 'CARDIOLOGIA', cbosCode: '225142' },
                  healthPlanPrices: [{ healthPlanId: 3, tissCode: '10101012' }],
                },
              },
            ],
            clinicalAppointmentGuides: [],
          },
        },
      ],
    });
    prisma.clinicProfile.findUnique.mockResolvedValue({
      legalName: 'Clinica Exemplo Ltda',
      cnpj: '12345678000199',
      cnes: '1234567',
    });

    const file = await service.exportBatch(15);
    expect(file.contentType).toContain('application/xml');
    expect(file.filename).toContain('consulta');
    const xml = file.buffer.toString('utf8');
    expect(xml).toContain('<ans:guiaConsulta>');
    expect(xml).toContain(
      '<ans:codigoPrestadorNaOperadora>99999</ans:codigoPrestadorNaOperadora>',
    );
    expect(xml).not.toContain(
      '<ans:codigoPrestadorNaOperadora>12345678000199</ans:codigoPrestadorNaOperadora>',
    );
    expect(xml).toContain('<ans:codigoProcedimento>10101012</ans:codigoProcedimento>');
    expect(xml).toContain('<ans:CBOS>225142</ans:CBOS>');
    expect(xml).not.toContain('<ans:grauPart>');
    expect(xml).toMatch(/<ans:hash>[a-f0-9]{32}<\/ans:hash>/);
  });

  it('emits one SP-SADT line per finished session', async () => {
    const sessionDates = [
      '2026-08-19',
      '2026-08-10',
      '2026-08-14',
      '2026-08-12',
      '2026-08-17',
    ];
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 16,
      status: BillingBatchStatus.billed,
      batchNumber: '16-20260901',
      healthPlanId: 3,
      healthPlan: {
        registroAns: '351033',
        providerCode: '99999',
        tissVersion: '4.03.00',
      },
      guides: [
        {
          insuranceGuide: {
            id: 9,
            guideNumber: 'G-ACU',
            tissGuideType: TissGuideType.sp_sadt,
            authorizationDate: new Date('2026-08-01T00:00:00.000Z'),
            expirationDate: new Date('2026-09-01T00:00:00.000Z'),
            authorizationPassword: 'SENHA1',
            participationDegree: '06',
            executorCbosCode: null,
            requesterName: 'ANA PAULA LARA BARCELOS',
            requesterCouncilType: 'CRM',
            requesterCouncilNumber: '16906',
            requesterCouncilUf: 'DF',
            requesterCbosCode: '225120',
            patient: {
              insuranceCards: [{ healthPlanId: 3, cardNumber: '000111' }],
            },
            healthProfessional: {
              name: 'DR CARLOS',
              councilType: 'CRM',
              councilNumber: '123456',
              councilUf: 'SP',
              cpf: '12345678901',
            },
            procedures: [
              {
                procedureId: 31,
                usedQuantity: 5,
                value: 40,
                procedure: {
                  name: 'ACUPUNTURA',
                  tissGuideType: TissGuideType.sp_sadt,
                  specialty: { id: 2, name: 'CLINICO GERAL', cbosCode: '225125' },
                  healthPlanPrices: [{ healthPlanId: 3, tissCode: '31601014' }],
                },
              },
            ],
            clinicalAppointmentGuides: [],
            appointmentProcedures: sessionDates.map((date) => ({
              procedureId: 31,
              clinicalAppointment: {
                status: ClinicalAppointmentStatus.finished,
                scheduledAt: new Date(`${date}T15:00:00.000Z`),
              },
            })),
          },
        },
      ],
    });
    prisma.clinicProfile.findUnique.mockResolvedValue({
      legalName: 'Clinica Exemplo Ltda',
      cnpj: '12345678000199',
      cnes: '1234567',
    });

    const file = await service.exportBatch(16);
    const xml = file.buffer.toString('utf8');
    const dates = [
      ...xml.matchAll(/<ans:dataExecucao>([^<]+)<\/ans:dataExecucao>/g),
    ].map((match) => match[1]);
    expect(dates).toEqual([
      '2026-08-10',
      '2026-08-12',
      '2026-08-14',
      '2026-08-17',
      '2026-08-19',
    ]);
    expect(
      xml.match(/<ans:quantidadeExecutada>1<\/ans:quantidadeExecutada>/g),
    ).toHaveLength(5);
    expect(xml).not.toContain('<ans:quantidadeExecutada>5');
    expect(xml).toContain('<ans:valorUnitario>40.00</ans:valorUnitario>');
    expect(xml).toContain('<ans:valorTotal>40.00</ans:valorTotal>');
    expect(xml).toContain('<ans:valorTotalGeral>200.00</ans:valorTotalGeral>');
    expect(xml).toContain('<ans:sequencialItem>5</ans:sequencialItem>');
    expect(xml).toContain('<ans:grauPart>06</ans:grauPart>');
    expect(xml).toContain('<ans:CBOS>225125</ans:CBOS>');
    expect(xml).toContain('<ans:nomeProfissional>ANA PAULA LARA BARCELOS</ans:nomeProfissional>');
    expect(xml).toContain('<ans:CBOS>225120</ans:CBOS>');
    expect(xml).toContain('<ans:numeroConselhoProfissional>16906</ans:numeroConselhoProfissional>');
  });

  it('rejects a guide whose procedures belong to different specialties', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 17,
      status: BillingBatchStatus.billed,
      batchNumber: '17-20260901',
      healthPlanId: 3,
      healthPlan: {
        registroAns: '351033',
        providerCode: '99999',
        tissVersion: '4.03.00',
      },
      guides: [
        {
          insuranceGuide: {
            id: 10,
            guideNumber: 'G-MIX',
            tissGuideType: TissGuideType.sp_sadt,
            authorizationDate: new Date('2026-08-01T00:00:00.000Z'),
            participationDegree: '12',
            patient: {
              insuranceCards: [{ healthPlanId: 3, cardNumber: '000111' }],
            },
            healthProfessional: {
              name: 'DR CARLOS',
              councilType: 'CRM',
              councilNumber: '123456',
              councilUf: 'SP',
              cpf: '12345678901',
            },
            procedures: [
              {
                usedQuantity: 1,
                value: 40,
                procedure: {
                  name: 'ECG',
                  tissGuideType: TissGuideType.sp_sadt,
                  specialty: { id: 2, name: 'CARDIOLOGIA', cbosCode: '225142' },
                  healthPlanPrices: [{ healthPlanId: 3, tissCode: '40304361' }],
                },
              },
              {
                usedQuantity: 1,
                value: 40,
                procedure: {
                  name: 'CONSULTA SADT',
                  tissGuideType: TissGuideType.sp_sadt,
                  specialty: { id: 3, name: 'CLINICO GERAL', cbosCode: '225125' },
                  healthPlanPrices: [{ healthPlanId: 3, tissCode: '10101012' }],
                },
              },
            ],
            clinicalAppointmentGuides: [],
          },
        },
      ],
    });
    prisma.clinicProfile.findUnique.mockResolvedValue({
      legalName: 'Clinica Exemplo Ltda',
      cnpj: '12345678000199',
      cnes: '1234567',
    });

    await expect(service.exportBatch(17)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    try {
      await service.exportBatch(17);
    } catch (error) {
      const response = (error as UnprocessableEntityException).getResponse() as {
        message: string[];
      };
      expect(response.message).toEqual(
        expect.arrayContaining([
          'Guia G-MIX: procedimentos de especialidades diferentes devem ficar em guias distintas.',
        ]),
      );
    }
  });
});
