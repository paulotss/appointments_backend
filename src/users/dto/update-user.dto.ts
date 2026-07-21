import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Maria Silva Santos' })
  name?: string;

  @ApiPropertyOptional({
    example: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  })
  passwordHash?: string;

  @ApiPropertyOptional({ example: 'maria.santos' })
  usernameLogin?: string;

  @ApiPropertyOptional({ example: true })
  isAdmin?: boolean;

  @ApiPropertyOptional({ example: 2002, nullable: true })
  extension?: number | null;

  @ApiPropertyOptional({ example: 'maria.santos@example.com', nullable: true })
  email?: string | null;
}
