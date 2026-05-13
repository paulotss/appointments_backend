import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'maria.silva' })
  usernameLogin!: string;

  @ApiProperty({ example: 'senhaSegura123' })
  password!: string;
}
