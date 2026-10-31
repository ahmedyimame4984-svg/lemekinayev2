import {
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
import { Public } from './auth.decorators.js';
import {
  ActivateSellerAccountDto,
  SellerLoginDto,
  SellerSessionResponseDto,
} from './dto/seller-auth.dto.js';
import {
  type SellerAuthRequestContext,
  SellerAuthService,
} from './seller-auth.service.js';

@ApiTags('Seller authentication')
@ApiUnauthorizedResponse({
  description: 'The Seller activation or login request was rejected',
})
@ApiTooManyRequestsResponse({
  description: 'Authentication rate limit reached',
})
@Public()
@Controller('seller/auth')
export class SellerAuthController {
  constructor(private readonly sellerAuth: SellerAuthService) {}

  @Post('activate')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({
    summary: 'Set Seller credentials using a one-time activation token',
  })
  @ApiNoContentResponse({ description: 'Seller credentials activated' })
  async activate(
    @Body() input: ActivateSellerAccountDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.sellerAuth.activateSeller(input, this.context(request));
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({
    summary: 'Authenticate an approved active Seller and issue a session',
  })
  @ApiOkResponse({ type: SellerSessionResponseDto })
  login(
    @Body() input: SellerLoginDto,
    @Req() request: Request,
  ): Promise<SellerSessionResponseDto> {
    return this.sellerAuth.login(input, this.context(request));
  }

  private context(request: Request): SellerAuthRequestContext {
    return {
      sourceIp: request.ip || request.socket.remoteAddress || 'unknown',
      userAgent: request.get('user-agent'),
    };
  }
}
