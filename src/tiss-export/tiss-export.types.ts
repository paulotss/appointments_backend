import type { CouncilType, TissGuideType } from '@prisma/client';

export type TissGuideKind = TissGuideType;

export interface TissClinicData {
  legalName: string;
  cnpj: string;
  cnes: string;
}

export interface TissPlanData {
  registroAns: string;
  providerCode: string | null;
  tissVersion: string;
}

export interface TissProfessionalData {
  name: string;
  councilType: CouncilType;
  councilNumber: string;
  councilUf: string;
  cbosCode: string;
}

export interface TissProcedureItem {
  tissCode: string;
  description: string;
  quantity: number;
  unitValue: number;
  executionDate: string;
}

export interface TissGuideData {
  id: number;
  kind: TissGuideKind;
  guideNumber: string;
  cardNumber: string;
  authorizationDate: string;
  attendanceDate: string;
  professional: TissProfessionalData;
  procedures: TissProcedureItem[];
}

export interface TissLotePayload {
  batchNumber: string;
  sequencialTransacao: string;
  generatedAt: Date;
  clinic: TissClinicData;
  plan: TissPlanData;
  guides: TissGuideData[];
}

export interface TissExportFile {
  filename: string;
  xml: string;
}
