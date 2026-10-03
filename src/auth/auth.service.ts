import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateServiceTokenDto } from './dto/create-service-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TokenBlacklistService } from './token-blacklist.service';

const DEFAULT_SERVICE_TOKEN_DAYS = 365;

const serviceTokenSelect = {
  id: true,
  name: true,
  scopes: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  createdById: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly prisma: PrismaService,
  ) {}

  validateUser(usernameLogin: string, password: string) {
    return this.usersService.validateUserCredentials(usernameLogin, password);
  }

  async login(user: {
    id: number;
    usernameLogin: string;
    name: string;
    role: UserRole;
    patientId: number | null;
    healthProfessionalId: number | null;
    extension: number | null;
  }) {
    const payload: JwtPayload = {
      typ: 'user',
      sub: user.id,
      usernameLogin: user.usernameLogin,
      role: user.role,
      patientId: user.patientId,
      healthProfessionalId: user.healthProfessionalId,
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

  async createServiceToken(admin: JwtPayload, dto: CreateServiceTokenDto) {
    const expiresInDays = dto.expiresInDays ?? DEFAULT_SERVICE_TOKEN_DAYS;
    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );
    const token = await this.jwtService.signAsync(
      {
        typ: 'service',
        scopes: dto.scopes,
        jti,
      },
      { expiresIn: `${expiresInDays}d` },
    );
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.serviceAccessToken.create({
      data: {
        name: dto.name.trim(),
        tokenHash,
        jti,
        scopes: dto.scopes,
        expiresAt,
        createdById: admin.sub,
      },
      select: serviceTokenSelect,
    });

    return { ...record, token };
  }

  listServiceTokens() {
    return this.prisma.serviceAccessToken.findMany({
      orderBy: { id: 'desc' },
      select: serviceTokenSelect,
    });
  }

  async revokeServiceToken(id: number) {
    const record = await this.prisma.serviceAccessToken.findUnique({
      where: { id },
      select: { id: true, revokedAt: true },
    });
    if (!record) {
      throw new NotFoundException(`Service token ${id} not found`);
    }
    if (record.revokedAt) {
      return this.prisma.serviceAccessToken.findUniqueOrThrow({
        where: { id },
        select: serviceTokenSelect,
      });
    }

    return this.prisma.serviceAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: serviceTokenSelect,
    });
  }
}
