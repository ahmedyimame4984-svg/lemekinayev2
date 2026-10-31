import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentPrincipal } from './auth.decorators.js';
import type { AuthPrincipal } from './auth.types.js';
import { SessionService } from './session.service.js';

@ApiTags('Authentication')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@Controller('auth')
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Get('me')
  @ApiOkResponse({ description: 'Resolved identity, roles and permissions' })
  getCurrentPrincipal(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): AuthPrincipal {
    return principal;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The current session was revoked' })
  async logout(@CurrentPrincipal() principal: AuthPrincipal): Promise<void> {
    await this.sessions.revokeSession(principal.sessionId, principal.userId);
  }
}
