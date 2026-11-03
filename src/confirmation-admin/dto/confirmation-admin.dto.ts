import {
  CampaignRecipientState,
  CampaignSourceKey,
  ContactOrigin,
  ContactSubjectRole,
  ContactVerificationProcedure,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const PATIENT_REF = /^patient:v1:[a-z][a-z0-9_-]{0,31}:[0-9a-f]{64}$/;
const RECIPIENT_REF = /^recipient:v1:[a-z][a-z0-9_-]{0,31}:[0-9a-f]{64}$/;
const PHONE_REF = /^phone:v1:[a-z][a-z0-9_-]{0,31}:[0-9a-f]{64}$/;
const OPAQUE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const APPOINTMENT_REF = /^[a-z][a-z0-9_.:-]{0,80}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export class PatientRefQueryDto {
  @Matches(PATIENT_REF)
  patientRef!: string;
}

export class InformVerificationDto {
  @Matches(PATIENT_REF)
  patientRef!: string;

  @Matches(RECIPIENT_REF)
  recipientRef!: string;

  @Matches(PHONE_REF)
  informedPhoneRef!: string;

  @IsEnum(ContactSubjectRole)
  role!: ContactSubjectRole;

  @IsEnum(ContactOrigin)
  origin!: ContactOrigin;

  @IsOptional()
  @Matches(OPAQUE)
  evidenceRef?: string;
}

export class VerifyVerificationDto {
  @IsEnum(ContactVerificationProcedure)
  procedure!: ContactVerificationProcedure;

  @IsBoolean()
  legalGuardianVerified!: boolean;
}

export class RecordAuthorizationDto {
  @Matches(PATIENT_REF)
  patientRef!: string;

  @Matches(RECIPIENT_REF)
  recipientRef!: string;

  @Equals('appointment_contact')
  purpose!: 'appointment_contact';

  @Equals('whatsapp')
  channel!: 'whatsapp';

  @Matches(OPAQUE)
  legalBasis!: string;

  @IsOptional()
  @Matches(OPAQUE)
  evidenceRef?: string;

  @Matches(INSTANT)
  validFrom!: string;

  @Matches(INSTANT)
  expiresAt!: string;
}

export class AssociateSubjectDto {
  @Matches(PATIENT_REF)
  patientRef!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  higiaPatientId?: number;
}

export class CampaignItemDto {
  @Matches(APPOINTMENT_REF)
  appointmentRef!: string;

  @IsOptional()
  @Matches(PATIENT_REF)
  patientRef?: string;

  @IsOptional()
  @Matches(RECIPIENT_REF)
  recipientRef?: string;

  @IsOptional()
  @Matches(PHONE_REF)
  informedPhoneRef?: string;

  @IsEnum(CampaignRecipientState)
  recipientState!: CampaignRecipientState;

  @IsOptional()
  @Matches(OPAQUE)
  reasonCode?: string;
}

export class CreateCampaignDto {
  @Matches(DATE_ONLY)
  campaignDate!: string;

  @IsEnum(CampaignSourceKey)
  source!: CampaignSourceKey;

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: CampaignItemDto) => item.appointmentRef)
  @ValidateNested({ each: true })
  @Type(() => CampaignItemDto)
  items?: CampaignItemDto[];
}

export class ReplaceCampaignItemsDto {
  @IsArray()
  @ArrayUnique((item: CampaignItemDto) => item.appointmentRef)
  @ValidateNested({ each: true })
  @Type(() => CampaignItemDto)
  items!: CampaignItemDto[];
}
