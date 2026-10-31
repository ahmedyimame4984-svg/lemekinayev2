import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AccountType } from '@prisma/client';
import { AuthThrottleService } from '../auth/auth-throttle.service.js';
import {
  CreateSellerApplicationDto,
  SellerApplicationSubmittedDto,
} from './dto/seller-registration.dto.js';
import type { SellerRegistrationFiles } from './seller-registration.service.js';
import { SellerRegistrationService } from './seller-registration.service.js';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

@ApiTags('Seller registration')
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/registration')
export class SellerRegistrationController {
  constructor(
    private readonly registration: SellerRegistrationService,
    private readonly throttles: AuthThrottleService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  getStatus(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.registration.getOnboardingStatus(principal.userId);
  }

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'commercialRegistrationDocument', maxCount: 1 },
        { name: 'tradeLicenseDocument', maxCount: 1 },
        { name: 'tinCertificateDocument', maxCount: 1 },
        { name: 'vatRegistrationDocument', maxCount: 1 },
      ],
      {
        limits: {
          files: 4,
          fileSize: MAX_DOCUMENT_BYTES,
          fields: 24,
        },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Submit a Seller application with the four required verification documents',
  })
  @ApiCreatedResponse({ type: SellerApplicationSubmittedDto })
  @ApiTooManyRequestsResponse({ description: 'Registration rate limit reached' })
  async submit(
    @Body() input: CreateSellerApplicationDto,
    @UploadedFiles() files: SellerRegistrationFiles,
    @Req() request: Request,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerApplicationSubmittedDto> {
    const sourceIp = request.ip || request.socket.remoteAddress || 'unknown';
    await this.throttles.consume('seller-registration', sourceIp);
    return this.registration.submit(
      input,
      files ?? {},
      this.throttles.sourceHash(sourceIp),
      principal.userId,
    );
  }
}
