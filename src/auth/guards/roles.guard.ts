import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServiceTokenScope, UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SERVICE_SCOPES_KEY } from '../decorators/service-scopes.decorator';
import {
  AuthPrincipal,
  isServicePrincipal,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const scopes = this.reflector.getAllAndOverride<ServiceTokenScope[]>(
      SERVICE_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if ((!roles || roles.length === 0) && (!scopes || scopes.length === 0)) {
      throw new ForbiddenException();
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const principal = request.user;
    if (!principal) {
      throw new ForbiddenException();
    }

    if (isServicePrincipal(principal)) {
      if (!scopes?.length) {
        throw new ForbiddenException();
      }
      const allowed = scopes.every((scope) => principal.scopes.includes(scope));
      if (!allowed) {
        throw new ForbiddenException();
      }
      return true;
    }

    if (!roles?.includes(principal.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
