import { BadRequestException } from '@nestjs/common';
import { CouncilType, TissGuideType } from '@prisma/client';
import { isBrazilianUf } from '../common/brazilian-uf';
import { isTissCbosCode } from '../common/tiss-cbos';

export type RequesterInput = {
  name: string;
  councilType: CouncilType;
  councilNumber: string;
  councilUf: string;
  cbosCode: string;
};

export type RequesterColumns = {
  requesterName: string | null;
  requesterCouncilType: CouncilType | null;
  requesterCouncilNumber: string | null;
  requesterCouncilUf: string | null;
  requesterCbosCode: string | null;
};

const EMPTY_REQUESTER: RequesterColumns = {
  requesterName: null,
  requesterCouncilType: null,
  requesterCouncilNumber: null,
  requesterCouncilUf: null,
  requesterCbosCode: null,
};

export function assertExecutorCbos(code: string, available: string[]): string {
  const normalized = code.replace(/\D/g, '');
  if (!isTissCbosCode(normalized) || !available.includes(normalized)) {
    throw new BadRequestException(
      'executorCbosCode must be one of the professional specialty CBOS codes',
    );
  }
  return normalized;
}

export function requesterColumns(
  input: RequesterInput | undefined,
  tissGuideType: TissGuideType,
): RequesterColumns {
  if (tissGuideType !== TissGuideType.sp_sadt) {
    return EMPTY_REQUESTER;
  }
  if (!input) {
    throw new BadRequestException('requester is required for SP/SADT guides');
  }
  const name = input.name.trim();
  const councilNumber = input.councilNumber.trim();
  const councilUf = input.councilUf.trim().toUpperCase();
  const cbosCode = input.cbosCode.replace(/\D/g, '');
  if (name.length < 3) {
    throw new BadRequestException('requester.name is required');
  }
  if (!councilNumber) {
    throw new BadRequestException('requester.councilNumber is required');
  }
  if (!isBrazilianUf(councilUf)) {
    throw new BadRequestException('requester.councilUf is invalid');
  }
  if (!isTissCbosCode(cbosCode)) {
    throw new BadRequestException('requester.cbosCode is not a TISS table 24 code');
  }
  return {
    requesterName: name,
    requesterCouncilType: input.councilType,
    requesterCouncilNumber: councilNumber,
    requesterCouncilUf: councilUf,
    requesterCbosCode: cbosCode,
  };
}

export function cbosCodesFromLinks(
  links: Array<{ specialty?: { cbosCode: string | null } | null }>,
): string[] {
  const codes = new Set<string>();
  for (const link of links) {
    const code = link.specialty?.cbosCode?.replace(/\D/g, '') ?? '';
    if (code.length === 6) codes.add(code);
  }
  return [...codes];
}
