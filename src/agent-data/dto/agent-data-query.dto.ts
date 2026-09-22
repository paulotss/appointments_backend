import {
  BillingBatchStatus,
  CallRecordStatus,
  CallStatus,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  ContactMethod,
  FinancialEntryStatus,
  FinancialEntryType,
  InsuranceGuideStatus,
  PayableStatus,
  PaymentMethod,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AgentDataPaginationDto } from './agent-data-pagination.dto';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

export enum AgentCatalogType {
  specialties = 'specialties',
  health_plans = 'health_plans',
  categories = 'categories',
  sectors = 'sectors',
  storage_locations = 'storage_locations',
}

export class SearchQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 'Maria' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class ListClinicalAppointmentsAgentQueryDto extends AgentDataPaginationDto {
  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId?: number;

  @ApiPropertyOptional({ enum: ClinicalAppointmentStatus })
  @IsOptional()
  @IsEnum(ClinicalAppointmentStatus)
  status?: ClinicalAppointmentStatus;

  @ApiPropertyOptional({ enum: ClinicalAppointmentType })
  @IsOptional()
  @IsEnum(ClinicalAppointmentType)
  type?: ClinicalAppointmentType;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  insuranceGuideId?: number;
}

export class ListInsuranceGuidesAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  guideNumber?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isBilled?: boolean;

  @ApiPropertyOptional({ enum: InsuranceGuideStatus })
  @IsOptional()
  @IsEnum(InsuranceGuideStatus)
  status?: InsuranceGuideStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  availableForBilling?: boolean;
}

export class ListCallCenterAppointmentsAgentQueryDto extends AgentDataPaginationDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendantId?: number;

  @ApiPropertyOptional({ enum: ContactMethod })
  @IsOptional()
  @IsEnum(ContactMethod)
  contactMethod?: ContactMethod;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  firstTime?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  scheduled?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;
}

export class ListCallsAgentQueryDto extends AgentDataPaginationDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ enum: CallRecordStatus })
  @IsOptional()
  @IsEnum(CallRecordStatus)
  recordStatus?: CallRecordStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ enum: CallStatus })
  @IsOptional()
  @IsEnum(CallStatus)
  status?: CallStatus;
}

export class ListMessagesAgentQueryDto extends AgentDataPaginationDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ enum: CallRecordStatus })
  @IsOptional()
  @IsEnum(CallRecordStatus)
  recordStatus?: CallRecordStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export class ListFinancialEntriesAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ enum: FinancialEntryType })
  @IsOptional()
  @IsEnum(FinancialEntryType)
  type?: FinancialEntryType;

  @ApiPropertyOptional({ enum: FinancialEntryStatus })
  @IsOptional()
  @IsEnum(FinancialEntryStatus)
  status?: FinancialEntryStatus;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListPayablesAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ enum: PayableStatus })
  @IsOptional()
  @IsEnum(PayableStatus)
  status?: PayableStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListFinancialExitsAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class ListBillingBatchesAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId?: number;

  @ApiPropertyOptional({ enum: BillingBatchStatus })
  @IsOptional()
  @IsEnum(BillingBatchStatus)
  status?: BillingBatchStatus;
}

export class ListProductsAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 'Dipirona' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  belowMinimum?: boolean;
}

export class ListStockBatchesAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiPropertyOptional({
    example: 'open',
    description: 'open (padrao), closed ou all',
  })
  @IsOptional()
  @IsString()
  status?: 'open' | 'closed' | 'all';
}

export class ListStockExitsAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListProceduresAgentQueryDto extends AgentDataPaginationDto {
  @ApiPropertyOptional({ example: 'Consulta' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId?: number;
}

export class ListCatalogAgentQueryDto {
  @ApiProperty({
    enum: AgentCatalogType,
    example: AgentCatalogType.specialties,
  })
  @IsEnum(AgentCatalogType)
  type!: AgentCatalogType;
}
