import { SetMetadata } from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';

export const SERVICE_SCOPES_KEY = 'serviceScopes';

export const ServiceScopes = (...scopes: ServiceTokenScope[]) =>
  SetMetadata(SERVICE_SCOPES_KEY, scopes);
