import { BillingBatchStatus, PaymentMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBillingBatchDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId!: number;

  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  insuranceGuideIds!: number[];

  @ApiPropertyOptional({ example: 'PROT-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  protocolNumber?: string;
}

export class UpdateBillingBatchDto {
  @ApiPropertyOptional({ type: [Number], example: [4, 5] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  addInsuranceGuideIds?: number[];

  @ApiPropertyOptional({ type: [Number], example: [2] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  removeInsuranceGuideIds?: number[];

  @ApiPropertyOptional({ example: 'PROT-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  protocolNumber?: string;
}

export class ReceiveBillingBatchItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  insuranceGuideId!: number;

  @ApiProperty({ example: 80.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receivedAmount!: number;

  @ApiPropertyOptional({ example: 'Glosa de procedimento nao autorizado' })
  @IsOptional()
  @IsString()
  glosaReason?: string;
}

export class ReceiveBillingBatchDto {
  @ApiProperty({ example: 1200.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receivedAmount!: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-08-24T15:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ type: [ReceiveBillingBatchItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveBillingBatchItemDto)
  items?: ReceiveBillingBatchItemDto[];
}

export class ListBillingBatchesQueryDto {
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
