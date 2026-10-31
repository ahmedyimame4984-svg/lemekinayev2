import { Body, Controller, Header, HttpCode, Post, Req } from '@nestjs/common';
import { ApiAcceptedResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from './auth.decorators.js';
import {
  RegisterSellerAccountDto,
  ResendSellerVerificationDto,
  VerifySellerEmailDto,
} from './dto/seller-registration-auth.dto.js';
import { SellerAccountRegistrationService } from './seller-account-registration.service.js';

@ApiTags('Seller account registration')
@Public()
@Controller('seller/auth')
export class SellerAccountRegistrationController {
  constructor(private readonly registration: SellerAccountRegistrationService) {}

  @Post('register')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @ApiAcceptedResponse({ description: 'Registration received; verification email requested' })
  async register(@Body() input: RegisterSellerAccountDto, @Req() request: Request) {
    await this.registration.register(input, this.sourceIp(request));
    return { message: 'If eligible, check your email for a verification link.' };
  }

  @Post('verify-email')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiNoContentResponse()
  async verify(@Body() input: VerifySellerEmailDto, @Req() request: Request): Promise<void> {
    await this.registration.verify(input.token, this.sourceIp(request));
  }

  @Post('resend-verification')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @ApiAcceptedResponse()
  async resend(@Body() input: ResendSellerVerificationDto, @Req() request: Request) {
    await this.registration.resend(input, this.sourceIp(request));
    return { message: 'If your account is awaiting verification, a new link will be sent.' };
  }

  private sourceIp(request: Request): string {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
