import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Maria Silva Santos' })
  name?: string;

  @ApiPropertyOptional({
    example: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  })
  passwordHash?: string;

  @ApiPropertyOptional({ example: 'maria.santos' })
  usernameLogin?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.ADMIN })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 10, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  patientId?: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  healthProfessionalId?: number | null;

  @ApiPropertyOptional({ example: 2002, nullable: true })
  extension?: number | null;

  @ApiPropertyOptional({ example: 'maria.santos@example.com', nullable: true })
  email?: string | null;
}
