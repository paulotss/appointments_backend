import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BillingBatchStatus, TissGuideType } from '@prisma/client';
import { isBrazilianUf } from '../common/brazilian-uf';
import { isTissVersion } from '../common/tiss-version';
import { decimalToNumber } from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import { buildExportFiles } from './tiss-xml.builder';
import { formatDateOnly, formatYmdSaoPaulo } from './tiss-xml';
import { zipStore } from './tiss-zip';
import type { TissGuideData, TissProfessionalData } from './tiss-export.types';

export type TissExportDownload = {
  filename: string;
  contentType: string;
  buffer: Buffer;
};

@Injectable()
export class TissExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportBatch(id: number): Promise<TissExportDownload> {
    const batch = await this.prisma.billingBatch.findUnique({
      where: { id },
      include: {
        healthPlan: true,
        guides: {
          include: {
            insuranceGuide: {
              include: {
                patient: {
                  include: {
                    insuranceCards: true,
                  },
                },
                healthProfessional: true,
                procedures: {
                  include: {
                    procedure: {
                      include: { healthPlanPrices: true },
                    },
                  },
                },
                clinicalAppointmentGuides: {
                  include: { clinicalAppointment: true },
                },
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Billing batch ${id} not found`);
    }
    if (batch.status === BillingBatchStatus.cancelled) {
      throw new BadRequestException(
        'Cancelled billing batches cannot export TISS XML',
      );
    }

    const clinic = await this.prisma.clinicProfile.findUnique({
      where: { id: 1 },
    });
    const errors: string[] = [];

    const legalName = clinic?.legalName?.trim() ?? '';
    const cnpj = clinic?.cnpj?.replace(/\D/g, '') ?? '';
    const cnes = clinic?.cnes?.replace(/\D/g, '') ?? '';
    if (!legalName) errors.push('Clínica: informe a razão social.');
    if (cnpj.length !== 14) errors.push('Clínica: informe o CNPJ com 14 dígitos.');
    if (cnes.length !== 7) errors.push('Clínica: informe o CNES com 7 dígitos.');

    const registroAns = batch.healthPlan.registroAns?.replace(/\D/g, '') ?? '';
    if (registroAns.length !== 6) {
      errors.push('Plano: informe o registro ANS com 6 dígitos.');
    }
    const providerCode = batch.healthPlan.providerCode?.trim() || null;
    if (!providerCode && cnpj.length !== 14) {
      errors.push(
        'Plano: informe o código do prestador na operadora ou o CNPJ da clínica.',
      );
    }
    const tissVersion = batch.healthPlan.tissVersion;
    if (!isTissVersion(tissVersion)) {
      errors.push('Plano: versão TISS inválida.');
    }

    const guides: TissGuideData[] = [];
    for (const batchGuide of batch.guides) {
      const guide = batchGuide.insuranceGuide;
      const label = guide.guideNumber?.trim() || `#${guide.id}`;
      const kind = this.resolveGuideKind(guide, errors, label);
      const guideNumber = guide.guideNumber?.trim() ?? '';
      if (!guideNumber) {
        errors.push(`Guia ${label}: informe o número da guia.`);
      }

      const card = guide.patient.insuranceCards.find(
        (item) => item.healthPlanId === batch.healthPlanId,
      );
      const cardNumber = card?.cardNumber.trim() ?? '';
      if (!cardNumber) {
        errors.push(`Guia ${label}: paciente sem carteira deste plano.`);
      }

      const professional = this.mapProfessional(
        guide.healthProfessional,
        errors,
        label,
      );

      const used = guide.procedures.filter((item) => item.usedQuantity > 0);
      if (used.length === 0) {
        errors.push(`Guia ${label}: nenhum procedimento com quantidade utilizada.`);
      }
      if (kind === TissGuideType.consulta && used.length > 1) {
        errors.push(
          `Guia ${label}: guia de consulta deve ter exatamente um procedimento.`,
        );
      }

      const attendanceDate = this.attendanceDate(guide);
      const procedures = used.map((item) => {
        const tissCode =
          item.procedure.healthPlanPrices.find(
            (price) => price.healthPlanId === batch.healthPlanId,
          )?.tissCode.trim() ?? '';
        if (!tissCode) {
          errors.push(
            `Guia ${label}: procedimento ${item.procedure.name} sem código TISS neste plano.`,
          );
        }
        return {
          tissCode,
          description: item.procedure.name,
          quantity: item.usedQuantity,
          unitValue: decimalToNumber(item.value),
          executionDate: attendanceDate,
        };
      });

      guides.push({
        id: guide.id,
        kind: kind ?? TissGuideType.sp_sadt,
        guideNumber,
        cardNumber,
        authorizationDate: formatDateOnly(guide.authorizationDate),
        attendanceDate,
        professional,
        procedures,
      });
    }

    if (guides.length === 0) {
      errors.push('O lote não possui guias para exportar.');
    }

    if (errors.length > 0) {
      throw new UnprocessableEntityException(errors);
    }

    const files = buildExportFiles({
      batchNumber: batch.batchNumber,
      sequencialTransacao: String(batch.id).slice(0, 12),
      generatedAt: new Date(),
      clinic: { legalName, cnpj, cnes },
      plan: {
        registroAns,
        providerCode,
        tissVersion,
      },
      guides,
    });

    if (files.length === 1) {
      const file = files[0]!;
      return {
        filename: file.filename,
        contentType: 'application/xml; charset=utf-8',
        buffer: Buffer.from(file.xml, 'utf8'),
      };
    }

    return {
      filename: `lote-${batch.batchNumber.replaceAll(/[^a-zA-Z0-9._-]/g, '_')}-tiss.zip`,
      contentType: 'application/zip',
      buffer: zipStore(
        files.map((file) => ({
          name: file.filename,
          data: Buffer.from(file.xml, 'utf8'),
        })),
      ),
    };
  }

  private resolveGuideKind(
    guide: {
      id: number;
      tissGuideType: TissGuideType | null;
      procedures: Array<{ procedure: { tissGuideType: TissGuideType } }>;
    },
    errors: string[],
    label: string,
  ): TissGuideType | null {
    const types = new Set(guide.procedures.map((item) => item.procedure.tissGuideType));
    if (types.size !== 1) {
      errors.push(
        `Guia ${label}: misture procedimentos de consulta e SP-SADT em guias distintas.`,
      );
      return guide.tissGuideType;
    }
    return [...types][0] ?? guide.tissGuideType;
  }

  private mapProfessional(
    professional: {
      name: string;
      councilType: TissProfessionalData['councilType'];
      councilNumber: string;
      councilUf: string | null;
      cbosCode: string | null;
    },
    errors: string[],
    label: string,
  ): TissProfessionalData {
    const councilUf = professional.councilUf?.trim().toUpperCase() ?? '';
    const cbosCode = professional.cbosCode?.replace(/\D/g, '') ?? '';
    if (!isBrazilianUf(councilUf)) {
      errors.push(`Guia ${label}: informe a UF do conselho do profissional.`);
    }
    if (cbosCode.length !== 6) {
      errors.push(`Guia ${label}: informe o CBO-S do profissional (6 dígitos).`);
    }
    return {
      name: professional.name,
      councilType: professional.councilType,
      councilNumber: professional.councilNumber.trim(),
      councilUf,
      cbosCode,
    };
  }

  private attendanceDate(guide: {
    authorizationDate: Date;
    clinicalAppointmentGuides: Array<{
      clinicalAppointment: { scheduledAt: Date };
    }>;
  }): string {
    const dates = guide.clinicalAppointmentGuides.map(
      (item) => item.clinicalAppointment.scheduledAt,
    );
    if (dates.length === 0) {
      return formatDateOnly(guide.authorizationDate);
    }
    const latest = dates.reduce((max, current) =>
      current > max ? current : max,
    );
    return formatYmdSaoPaulo(latest);
  }
}
