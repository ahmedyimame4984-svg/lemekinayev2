import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { SessionService } from './session.service.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const parts = authorization?.split(' ') ?? [];

    if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
      throw this.authenticationRequired();
    }

    const principal = await this.sessions.authenticateToken(parts[1] ?? '');
    if (!principal) {
      throw this.authenticationRequired();
    }

    request.principal = principal;
    return true;
  }

  private authenticationRequired(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'A valid authenticated session is required',
    });
  }
}
