import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(
    @Body() _loginDto: LoginDto,
    @CurrentUser()
    user: { id: number; usernameLogin: string; isAdmin: boolean; name: string },
  ) {
    return this.authService.login({
      id: user.id,
      usernameLogin: user.usernameLogin,
      isAdmin: user.isAdmin,
      name: user.name,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logoff')
  logoff(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user);
  }
}
