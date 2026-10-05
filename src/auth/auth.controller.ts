import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CreateServiceTokenDto } from './dto/create-service-token.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { ALL_USER_ROLES } from './roles';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login (retorna access_token JWT)' })
  @ApiBody({ type: LoginDto })
  login(
    @Body() _loginDto: LoginDto,
    @CurrentUser()
    user: {
      id: number;
      usernameLogin: string;
      name: string;
      role: UserRole;
      patientId: number | null;
      healthProfessionalId: number | null;
      extension: number | null;
    },
  ) {
    return this.authService.login(user);
  }

  @Roles(...ALL_USER_ROLES)
  @Post('logout')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Logout (invalida o token)' })
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user);
  }

  @Roles(...ALL_USER_ROLES)
  @Post('logoff')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Alias de logout' })
  logoff(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user);
  }

  @Roles(UserRole.ADMIN)
  @Post('service-tokens')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Gerar token de serviço (o segredo é devolvido uma única vez)',
  })
  createServiceToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateServiceTokenDto,
  ) {
    return this.authService.createServiceToken(user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('service-tokens')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Listar tokens de serviço, sem o segredo' })
  listServiceTokens() {
    return this.authService.listServiceTokens();
  }

  @Roles(UserRole.ADMIN)
  @Delete('service-tokens/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Revogar token de serviço' })
  revokeServiceToken(@Param('id', ParseIntPipe) id: number) {
    return this.authService.revokeServiceToken(id);
  }
}
