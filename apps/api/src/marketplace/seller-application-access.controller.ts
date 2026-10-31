import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
  HttpCode,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  UploadedFiles,
  UseInterceptors,
  StreamableFile,
  NotFoundException,
  Res,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { validateEnvironment } from '../config/environment.js';
import { SellerApplicationEditService } from './seller-application-edit.service.js';
import type { SellerRegistrationFiles } from './seller-registration.service.js';
import { UpdateSellerApplicationDto } from './dto/seller-application-edit.dto.js';
import { Public } from '../auth/auth.decorators.js';
import { SellerApplicationAccessService } from './seller-application-access.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  SellerApplicationAccessRequestDto,
  SellerApplicationAccessVerifyDto,
  SellerApplicationNewContactEmailDto,
} from './dto/seller-application-access.dto.js';

@ApiTags('Seller application access')
@Public()
@Controller('seller/registration/access')
export class SellerApplicationAccessController {
  constructor(
    private readonly access: SellerApplicationAccessService,
    private readonly database: DatabaseService,
    private readonly edits: SellerApplicationEditService,
  ) {}

  @Post('request')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  requestCode(@Body() input: SellerApplicationAccessRequestDto, @Req() request: Request) {
    return this.access.requestCode(
      input.referenceCode,
      input.contactEmail,
      request.ip || request.socket.remoteAddress || 'unknown',
    );
  }

  @Post('verify')
  @Header('Cache-Control', 'no-store')
  verifyCode(@Body() input: SellerApplicationAccessVerifyDto, @Req() request: Request) {
    return this.access.verifyCode(
      input.referenceCode,
      input.contactEmail,
      input.code,
      request.ip || request.socket.remoteAddress || 'unknown',
    );
  }

  @Get('application')
  @Header('Cache-Control', 'no-store')
  async application(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const applicationId = await this.access.requireApplication(token);
    const application = await this.database.sellerApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        documents: {
          where: { isCurrent: true },
          select: {
            id: true,
            documentType: true,
            originalName: true,
            status: true,
            uploadedAt: true,
          },
        },
      },
    });
    return {
      referenceCode: application.referenceCode,
      status: application.status,
      version: application.version,
      correctionReason: application.correctionReason,
      submittedAt: application.submittedAt,
      updatedAt: application.updatedAt,
      contactName: application.contactName,
      contactEmail: application.contactEmail,
      contactPhone: application.contactPhone,
      businessName: application.businessName,
      displayName: application.displayName,
      sellerType: application.sellerType,
      businessEmail: application.businessEmail,
      businessPhone: application.businessPhone,
      region: application.region,
      city: application.city,
      address: application.address,
      commercialRegistrationNumber: application.commercialRegistrationNumber,
      tradeLicenseNumber: application.tradeLicenseNumber,
      tinNumber: application.tinNumber,
      vatRegistrationNumber: application.vatRegistrationNumber,
      documents: application.documents,
    };
  }

  @Post('application/contact-email/request')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  async requestContactEmailChange(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: SellerApplicationNewContactEmailDto,
    @Req() request: Request,
  ) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const applicationId = await this.access.requireApplication(token);
    await this.access.requestContactEmailChange(
      applicationId,
      input.contactEmail,
      request.ip || request.socket.remoteAddress || 'unknown',
    );
    return { message: 'If the address is eligible, a verification code will be sent.' };
  }

  @Patch('application')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(FileFieldsInterceptor(
    [
      { name: 'commercialRegistrationDocument', maxCount: 1 },
      { name: 'tradeLicenseDocument', maxCount: 1 },
      { name: 'tinCertificateDocument', maxCount: 1 },
      { name: 'vatRegistrationDocument', maxCount: 1 },
    ],
    { limits: { files: 4, fileSize: 8 * 1024 * 1024, fields: 30 } },
  ))
  async updateApplication(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: UpdateSellerApplicationDto,
    @UploadedFiles() files: SellerRegistrationFiles,
  ) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const applicationId = await this.access.requireApplication(token);
    return this.edits.update(applicationId, input, files ?? {});
  }

  @Get('application/documents/:documentId/download')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async downloadApplicationDocument(
    @Headers('authorization') authorization: string | undefined,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const applicationId = await this.access.requireApplication(token);
    const doc = await this.database.sellerApplicationDocument.findFirst({
      where: { id: documentId, applicationId, isCurrent: true },
      select: { originalName: true, mimeType: true, storageKey: true },
    });
    if (!doc) throw new NotFoundException();

    const parts = doc.storageKey.split('/');
    if (parts.length !== 2 || parts[0] !== applicationId ||
        !/^[a-z0-9_-]+-[a-f0-9-]+\.(pdf|jpg|png)$/iu.test(parts[1] ?? '') ||
        basename(parts[1]!) !== parts[1]) throw new NotFoundException();
    let data: Buffer;
    try {
      data = await readFile(join(
        validateEnvironment(process.env).sellerDocumentStoragePath,
        applicationId,
        parts[1]!,
      ));
    } catch {
      throw new NotFoundException();
    }
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    const safeName = doc.originalName.replace(/[^a-zA-Z0-9._ -]/gu, '_').slice(0, 120);
    return new StreamableFile(data, {
      type: doc.mimeType,
      disposition: `attachment; filename="${safeName}"`,
      length: data.byteLength,
    });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Headers('authorization') authorization?: string): Promise<void> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    await this.access.revoke(token);
  }
}
