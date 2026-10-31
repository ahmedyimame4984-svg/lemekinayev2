import {
  applyDecorators,
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  type AdminAuthRequestContext,
  AdminAuthService,
} from './admin-auth.service.js';
import { Public } from './auth.decorators.js';
import {
  AdminActivationResponseDto,
  AdminLoginDto,
  AdminMfaChallengeResponseDto,
  AdminRefreshDto,
  AdminSessionResponseDto,
  BeginAdminActivationDto,
  VerifyAdminActivationDto,
  VerifyAdminMfaDto,
} from './dto/admin-auth.dto.js';

const NoStore = () =>
  applyDecorators(
    Header('Cache-Control', 'no-store'),
    Header('Pragma', 'no-cache'),
  );

@ApiTags('Admin authentication')
@ApiUnauthorizedResponse({
  description:
    'The activation, credential, MFA, or refresh request was rejected',
})
@ApiTooManyRequestsResponse({
  description: 'Authentication rate limit reached',
})
@Public()
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('activate')
  @HttpCode(200)
  @NoStore()
  @ApiOperation({
    summary: 'Begin one-time Admin activation and MFA enrollment',
  })
  @ApiOkResponse({ type: AdminActivationResponseDto })
  beginActivation(
    @Body() input: BeginAdminActivationDto,
    @Req() request: Request,
  ): Promise<AdminActivationResponseDto> {
    return this.adminAuth.beginActivation(input, this.context(request));
  }

  @Post('activate/verify')
  @HttpCode(204)
  @NoStore()
  @ApiOperation({
    summary: 'Verify enrollment TOTP and activate the Admin account',
  })
  @ApiNoContentResponse({ description: 'Admin account activated' })
  async verifyActivation(
    @Body() input: VerifyAdminActivationDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.adminAuth.verifyActivation(input, this.context(request));
  }

  @Post('login')
  @HttpCode(200)
  @NoStore()
  @ApiOperation({ summary: 'Verify Admin password and issue an MFA challenge' })
  @ApiOkResponse({ type: AdminMfaChallengeResponseDto })
  login(
    @Body() input: AdminLoginDto,
    @Req() request: Request,
  ): Promise<AdminMfaChallengeResponseDto> {
    return this.adminAuth.login(input, this.context(request));
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @NoStore()
  @ApiOperation({
    summary: 'Verify Admin TOTP and issue an MFA-backed session',
  })
  @ApiOkResponse({ type: AdminSessionResponseDto })
  verifyMfa(
    @Body() input: VerifyAdminMfaDto,
    @Req() request: Request,
  ): Promise<AdminSessionResponseDto> {
    return this.adminAuth.verifyLoginMfa(input, this.context(request));
  }

  @Post('refresh')
  @HttpCode(200)
  @NoStore()
  @ApiOperation({ summary: 'Rotate the Admin refresh and access tokens' })
  @ApiOkResponse({ type: AdminSessionResponseDto })
  refresh(
    @Body() input: AdminRefreshDto,
    @Req() request: Request,
  ): Promise<AdminSessionResponseDto> {
    return this.adminAuth.refreshSession(
      input.refreshToken,
      this.context(request),
    );
  }

  @Post('logout')
  @HttpCode(204)
  @NoStore()
  @ApiOperation({ summary: 'Revoke an Admin session using its refresh token' })
  @ApiNoContentResponse({ description: 'The matching session is revoked' })
  async logout(
    @Body() input: AdminRefreshDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.adminAuth.logoutSession(
      input.refreshToken,
      this.context(request),
    );
  }

  private context(request: Request): AdminAuthRequestContext {
    return {
      sourceIp: request.ip || request.socket.remoteAddress || 'unknown',
      userAgent: request.get('user-agent'),
    };
  }
}
