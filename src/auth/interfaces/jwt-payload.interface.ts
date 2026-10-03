import { ServiceTokenScope, UserRole } from '@prisma/client';

export interface JwtPayload {
  typ?: 'user';
  sub: number;
  usernameLogin: string;
  role: UserRole;
  patientId: number | null;
  healthProfessionalId: number | null;
  jti: string;
  exp?: number;
}

export interface ServiceTokenPrincipal {
  typ: 'service';
  sub: number;
  scopes: ServiceTokenScope[];
  jti: string;
  exp?: number;
}

export type AuthPrincipal = JwtPayload | ServiceTokenPrincipal;

export function isServicePrincipal(
  principal: AuthPrincipal,
): principal is ServiceTokenPrincipal {
  return principal.typ === 'service';
}
