import { PayableKind, PayableStatus, PaymentMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePayableDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId!: number;

  @ApiProperty({ enum: PayableKind })
  @IsEnum(PayableKind)
  kind!: PayableKind;

  @ApiProperty({ example: 'Compra de material de limpeza' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description!: string;

  @ApiProperty({ example: 350.9 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ example: 'NF-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: 'Boleto com vencimento em setembro' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayableDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional({ enum: PayableKind })
  @IsOptional()
  @IsEnum(PayableKind)
  kind?: PayableKind;

  @ApiPropertyOptional({ example: 'Compra de material de limpeza' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: 350.9 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: '2026-09-10' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'NF-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayPayableDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-08-24T15:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class ListPayablesQueryDto {
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
