import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import {
  digitsOnly,
  normalizeTissCode,
  suggestedGuideNumber,
  type ExtractedGuide,
} from './extracted-guide';

const patientInclude = {
  insuranceCards: {
    include: { healthPlan: true },
    orderBy: { id: 'asc' as const },
  },
} as const;

const professionalInclude = {
  specialties: {
    include: { specialty: true },
  },
} as const;

const procedureInclude = {
  specialty: true,
  healthPlanPrices: {
    include: { healthPlan: true },
  },
} as const;

export type GuideImportMatchResult = {
  extracted: ExtractedGuide;
  healthPlan: Prisma.HealthPlanGetPayload<object> | null;
  healthProfessional: Prisma.HealthProfessionalGetPayload<{
    include: typeof professionalInclude;
  }> | null;
  procedures: Array<{
    extracted: ExtractedGuide['procedures'][number];
    match: Prisma.ProcedureGetPayload<{
      include: typeof procedureInclude;
    }> | null;
  }>;
  patient: Prisma.PatientGetPayload<{ include: typeof patientInclude }> | null;
  existingGuide: { id: number; guideNumber: string | null } | null;
  missing: {
    healthPlan: boolean;
    healthProfessional: boolean;
    procedures: string[];
  };
  warnings: string[];
  canAdvance: boolean;
};

@Injectable()
export class GuideImportMatcher {
  constructor(private readonly prisma: PrismaService) {}

  async match(extracted: ExtractedGuide): Promise<GuideImportMatchResult> {
    const warnings: string[] = [];
    const healthPlan = await this.matchHealthPlan(extracted, warnings);
    const healthProfessional = await this.matchProfessional(
      extracted,
      warnings,
    );
    const procedures = await this.matchProcedures(extracted, healthPlan?.id);
    const patient = await this.matchPatient(extracted, warnings);
    const existingGuide = await this.matchExistingGuide(extracted);

    if (extracted.professional.source === 'solicitante') {
      warnings.push(
        'Executing professional was empty; matched the requesting professional',
      );
    }
    if (existingGuide) {
      warnings.push('A guide with this number already exists');
    }

    const unmatched = procedures.filter((item) => item.match == null);
    const missingCodes = unmatched
      .map((item) => item.extracted.tissCode)
      .filter((code): code is string => Boolean(code));

    const missing = {
      healthPlan: healthPlan == null,
      healthProfessional: healthProfessional == null,
      procedures: missingCodes,
    };

    const hasProcedures = procedures.length > 0;
    const allProceduresMatched = hasProcedures && unmatched.length === 0;

    return {
      extracted,
      healthPlan,
      healthProfessional,
      procedures,
      patient,
      existingGuide,
      missing,
      warnings,
      canAdvance:
        !missing.healthPlan &&
        !missing.healthProfessional &&
        allProceduresMatched,
    };
  }

  private async matchHealthPlan(extracted: ExtractedGuide, warnings: string[]) {
    const registroAns = extracted.healthPlan.registroAns;
    if (registroAns) {
      const byAns = await this.prisma.healthPlan.findFirst({
        where: { registroAns },
      });
      if (byAns) return byAns;
    }

    const name = extracted.healthPlan.name;
    if (!name) return null;

    const candidates = await this.prisma.healthPlan.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
    });
    if (candidates.length === 0) return null;
    const exact = candidates.find(
      (item) => normalizeName(item.name) === normalizeName(name),
    );
    if (candidates.length > 1 && !exact) {
      warnings.push('Multiple health plans matched the extracted name');
    }
    return exact ?? candidates[0] ?? null;
  }

  private async matchProfessional(
    extracted: ExtractedGuide,
    warnings: string[],
  ) {
    const councilType = extracted.professional.councilType;
    const councilNumber = extracted.professional.councilNumber?.trim();
    const digits = councilNumber ? digitsOnly(councilNumber) : '';
    if (!digits && !councilNumber) {
      return this.matchProfessionalByName(extracted, warnings);
    }

    const uf = extracted.professional.councilUf;
    const whereNumber: Prisma.HealthProfessionalWhereInput = {
      ...(councilType ? { councilType } : {}),
      OR: [
        ...(councilNumber ? [{ councilNumber }] : []),
        ...(digits ? [{ councilNumber: digits }] : []),
      ],
    };

    if (uf) {
      const withUf = await this.prisma.healthProfessional.findFirst({
        where: { ...whereNumber, councilUf: uf },
        include: professionalInclude,
      });
      if (withUf) return withUf;
    }

    const matches = await this.prisma.healthProfessional.findMany({
      where: whereNumber,
      include: professionalInclude,
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      warnings.push(
        'Multiple professionals matched the extracted council number',
      );
      return matches[0];
    }

    return this.matchProfessionalByName(extracted, warnings);
  }

  private async matchProfessionalByName(
    extracted: ExtractedGuide,
    warnings: string[],
  ) {
    const name = extracted.professional.name;
    if (!name) return null;
    const matches = await this.prisma.healthProfessional.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      include: professionalInclude,
    });
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      warnings.push('Multiple professionals matched the extracted name');
    }
    const exact = matches.find(
      (item) => normalizeName(item.name) === normalizeName(name),
    );
    return exact ?? matches[0] ?? null;
  }

  private async matchProcedures(
    extracted: ExtractedGuide,
    healthPlanId: number | undefined,
  ) {
    if (extracted.procedures.length === 0) {
      return [];
    }
    if (healthPlanId == null) {
      return extracted.procedures.map((item) => ({
        extracted: item,
        match: null,
      }));
    }

    const prices = await this.prisma.healthPlanProcedure.findMany({
      where: { healthPlanId },
      include: { procedure: { include: procedureInclude } },
    });

    return extracted.procedures.map((item) => {
      const code = item.tissCode ? normalizeTissCode(item.tissCode) : '';
      if (!code) {
        return { extracted: item, match: null };
      }
      const price = prices.find(
        (row) => normalizeTissCode(row.tissCode) === code,
      );
      return { extracted: item, match: price?.procedure ?? null };
    });
  }

  private async matchPatient(extracted: ExtractedGuide, warnings: string[]) {
    const cardNumber = extracted.patient.cardNumber;
    if (cardNumber) {
      const card = await this.prisma.insuranceCard.findFirst({
        where: { cardNumber },
        include: { patient: { include: patientInclude } },
      });
      if (card) return card.patient;
    }

    const name = extracted.patient.name;
    if (!name) return null;

    const exactName = normalizeName(name);
    const exact = await this.prisma.patient.findMany({
      where: { name: exactName },
      include: patientInclude,
    });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      warnings.push('Multiple patients matched the extracted name');
      return exact[0];
    }

    const contains = await this.prisma.patient.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      include: patientInclude,
    });
    if (contains.length === 0) return null;
    if (contains.length > 1) {
      warnings.push('Multiple patients matched the extracted name');
    }
    return contains[0];
  }

  private async matchExistingGuide(extracted: ExtractedGuide) {
    const guideNumber = suggestedGuideNumber(extracted);
    if (!guideNumber) return null;
    const existing = await this.prisma.insuranceGuide.findUnique({
      where: { guideNumber: guideNumber.trim() },
      select: { id: true, guideNumber: true },
    });
    return existing;
  }
}
