import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { AccountType } from '@prisma/client';
import {
  IS_PUBLIC_KEY,
  REQUIRED_ACCOUNT_TYPES_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './auth.constants.js';
import type { AuthenticatedRequest, AuthPrincipal } from './auth.types.js';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequireAccountTypes = (...accountTypes: AccountType[]) =>
  SetMetadata(REQUIRED_ACCOUNT_TYPES_KEY, accountTypes);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) {
      throw new Error('Authenticated principal is unavailable');
    }

    return request.principal;
  },
);
