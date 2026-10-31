import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Body,
  Header,
  StreamableFile,
  NotFoundException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType, SellerApplicationDocumentStatus } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Response } from 'express';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import {
  ApplicationDecisionDto,
  ApplicationDocumentDecisionDto,
  ApplicationPageQueryDto,
} from './dto/seller-application-review.dto.js';
import { SellerApplicationReviewService } from './seller-application-review.service.js';

@ApiTags('Admin Seller applications')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('seller.manage')
@Controller('admin/seller-applications')
export class AdminSellerApplicationController {
  constructor(
    private readonly applications: SellerApplicationReviewService,
    private readonly database: DatabaseService,
  ) {}

  @Get('page')
  list(@Query() query: ApplicationPageQueryDto) {
    return this.applications.list(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.get(id);
  }

  @Post(':id/decision')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ApplicationDecisionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.applications.decide(id, input, principal.userId);
  }

  @Post(':id/documents/:documentId/review')
  async reviewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() input: ApplicationDocumentDecisionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    if (input.status === SellerApplicationDocumentStatus.REJECTED &&
      (!input.reason || input.reason.trim().length < 10)) {
      throw new BadRequestException({ code: 'DOCUMENT_REVIEW_REASON_REQUIRED', message: 'A reason is required to reject a document.' });
    }
    return this.applications.reviewDocument(id, documentId, input, principal.userId);
  }

  @Get(':id/documents/:documentId/download')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const document = await this.database.sellerApplicationDocument.findFirst({
      where: { id: documentId, applicationId: id, isCurrent: true },
      select: { storageKey: true, originalName: true, mimeType: true },
    });
    if (!document) throw new NotFoundException();

    const parts = document.storageKey.split('/');
    if (parts.length !== 2 || parts[0] !== id ||
      !/^[a-z0-9_-]+-[a-f0-9-]+\.(pdf|png|jpg)$/iu.test(parts[1] ?? '') ||
      basename(parts[1]!) !== parts[1]) {
      throw new NotFoundException();
    }
    const folder = validateEnvironment(process.env).sellerDocumentStoragePath;
    let contents: Buffer;
    try {
      contents = await readFile(join(folder, id, parts[1]!));
    } catch {
      throw new NotFoundException();
    }
    const name = document.originalName.replace(/[^a-zA-Z0-9._ -]/gu, '_').slice(0, 120) || 'document';
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return new StreamableFile(contents, {
      type: document.mimeType,
      disposition: `attachment; filename="${name.replaceAll('"','_')}"`,
      length: contents.byteLength,
    });
  }
}
