import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BillingBatchStatus, TissGuideType } from '@prisma/client';
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
              cbosCode: null,
            },
            procedures: [
              {
                usedQuantity: 1,
                value: 80,
                procedure: {
                  name: 'CONSULTA',
                  tissGuideType: TissGuideType.consulta,
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
          'Guia #8: informe o CBO-S do profissional (6 dígitos).',
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
            healthProfessional: {
              name: 'DR CARLOS',
              councilType: 'CRM',
              councilNumber: '123456',
              councilUf: 'SP',
              cbosCode: '225142',
            },
            procedures: [
              {
                usedQuantity: 1,
                value: 80,
                procedure: {
                  name: 'CONSULTA',
                  tissGuideType: TissGuideType.consulta,
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
      '<ans:codigoPrestadorNaOperadora>12345678000199</ans:codigoPrestadorNaOperadora>',
    );
    expect(xml).not.toContain('<ans:codigoPrestadorNaOperadora>99999</ans:codigoPrestadorNaOperadora>');
    expect(xml).toContain('<ans:codigoProcedimento>10101012</ans:codigoProcedimento>');
    expect(xml).toMatch(/<ans:hash>[a-f0-9]{32}<\/ans:hash>/);
  });
});
