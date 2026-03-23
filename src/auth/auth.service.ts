import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  validateUser(usernameLogin: string, password: string) {
    return this.usersService.validateUserCredentials(usernameLogin, password);
  }

  async login(user: {
    id: number;
    usernameLogin: string;
    isAdmin: boolean;
    name: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      usernameLogin: user.usernameLogin,
      isAdmin: user.isAdmin,
      jti: randomUUID(),
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
    };
  }

  logout(payload: JwtPayload) {
    if (!payload.exp) {
      throw new UnauthorizedException('Invalid token payload');
    }

    this.tokenBlacklistService.revoke(payload.jti, payload.exp);

    return { message: 'Logged out successfully' };
  }
}
