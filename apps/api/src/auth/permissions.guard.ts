import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountType } from '@prisma/client';
import {
  IS_PUBLIC_KEY,
  REQUIRED_ACCOUNT_TYPES_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredAccountTypes =
      this.reflector.getAllAndOverride<AccountType[]>(
        REQUIRED_ACCOUNT_TYPES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    if (requiredPermissions.length === 0 && requiredAccountTypes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid authenticated session is required',
      });
    }

    const granted = new Set(request.principal.permissions);
    const accountTypeAllowed =
      requiredAccountTypes.length === 0 ||
      requiredAccountTypes.includes(request.principal.accountType);
    const permissionsAllowed = requiredPermissions.every((permission) =>
      granted.has(permission),
    );
    if (!accountTypeAllowed || !permissionsAllowed) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'The authenticated account lacks a required permission',
      });
    }

    return true;
  }
}
