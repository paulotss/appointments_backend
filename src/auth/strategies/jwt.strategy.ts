import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthPrincipal,
  JwtPayload,
  ServiceTokenPrincipal,
} from '../interfaces/jwt-payload.interface';
import { TokenBlacklistService } from '../token-blacklist.service';

type IncomingToken = Partial<JwtPayload> & Partial<ServiceTokenPrincipal>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change_me',
    });
  }

  async validate(payload: IncomingToken): Promise<AuthPrincipal> {
    if (!payload.jti) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (this.tokenBlacklistService.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }

    if (payload.typ === 'service') {
      const record = await this.prisma.serviceAccessToken.findUnique({
        where: { jti: payload.jti },
      });
      if (
        !record ||
        record.revokedAt != null ||
        (record.expiresAt != null && record.expiresAt.getTime() <= Date.now())
      ) {
        throw new UnauthorizedException('Token revoked');
      }

      return {
        typ: 'service',
        sub: record.id,
        scopes: record.scopes,
        jti: record.jti,
        exp: payload.exp,
      };
    }

    if (payload.sub == null || !payload.usernameLogin || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      typ: 'user',
      sub: payload.sub,
      usernameLogin: payload.usernameLogin,
      role: payload.role,
      patientId: payload.patientId ?? null,
      healthProfessionalId: payload.healthProfessionalId ?? null,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
