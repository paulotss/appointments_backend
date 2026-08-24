import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  FinancialEntryStatus,
  FinancialEntryType,
  PaymentMethod,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePrivateFinancialEntryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clinicalAppointmentId!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-08-24T15:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ example: 10.5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  surchargeAmount?: number;

  @ApiPropertyOptional({ example: 'Desconto de pontualidade' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListFinancialEntriesQueryDto {
  @ApiPropertyOptional({ enum: FinancialEntryType })
  @IsOptional()
  @IsEnum(FinancialEntryType)
  type?: FinancialEntryType;

  @ApiPropertyOptional({ enum: FinancialEntryStatus })
  @IsOptional()
  @IsEnum(FinancialEntryStatus)
  status?: FinancialEntryStatus;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

export const PRIVATE_APPOINTMENT_REQUIRED_STATUS =
  ClinicalAppointmentStatus.finished;
export const PRIVATE_APPOINTMENT_REQUIRED_TYPE =
  ClinicalAppointmentType.private;
