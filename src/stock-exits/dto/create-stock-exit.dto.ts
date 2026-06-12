import { ApiProperty } from '@nestjs/swagger';

export class CreateStockExitDto {
  @ApiProperty({ example: 1 })
  batchId!: number;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: '2026-06-12' })
  exitDate!: string;
}
