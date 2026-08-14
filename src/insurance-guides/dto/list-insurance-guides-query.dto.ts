import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

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

export class ListInsuranceGuidesQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description:
      'Filtrar guias faturadas (true) ou nao faturadas (false). Se omitido, lista todas',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isBilled?: boolean;
}
