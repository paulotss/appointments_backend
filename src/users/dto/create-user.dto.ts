import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Silva' })
  name!: string;

  @ApiProperty({
    example: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  })
  passwordHash!: string;

  @ApiProperty({ example: 'maria.silva' })
  usernameLogin!: string;

  @ApiPropertyOptional({ example: false })
  isAdmin?: boolean;

  @ApiPropertyOptional({ example: 2001, nullable: true })
  extension?: number | null;
}
