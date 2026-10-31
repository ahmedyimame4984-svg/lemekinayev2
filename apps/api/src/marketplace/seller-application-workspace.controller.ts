import {
  Body, Controller, Get, Header, HttpCode, Patch, Post,
  UploadedFiles, UseInterceptors, ConflictException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AccountType, SellerApplicationStatus } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { SellerApplicationDraftService } from './seller-application-draft.service.js';
import { SellerApplicationEditService } from './seller-application-edit.service.js';
import { SaveSellerApplicationDraftDto } from './dto/seller-application-draft.dto.js';
import { UpdateSellerApplicationDto } from './dto/seller-application-edit.dto.js';
import type { SellerRegistrationFiles } from './seller-registration.service.js';

const maxBytes = 8 * 1024 * 1024;
const documentFields = [
  { name: 'commercialRegistrationDocument', maxCount: 1 },
  { name: 'tradeLicenseDocument', maxCount: 1 },
  { name: 'tinCertificateDocument', maxCount: 1 },
  { name: 'vatRegistrationDocument', maxCount: 1 },
];
const allowedEdits = new Set<SellerApplicationStatus>([
  SellerApplicationStatus.SUBMITTED,
  SellerApplicationStatus.RESUBMITTED,
  SellerApplicationStatus.CHANGES_REQUESTED,
]);

@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/registration')
export class SellerApplicationWorkspaceController {
  constructor(
    private readonly drafts: SellerApplicationDraftService,
    private readonly database: DatabaseService,
    private readonly edits: SellerApplicationEditService,
  ) {}

  @Get('workspace')
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.drafts.get(principal.userId);
  }

  @Patch('draft')
  @Header('Cache-Control', 'private, no-store')
  saveDraft(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() input: SaveSellerApplicationDraftDto,
  ) {
    return this.drafts.save(principal.userId, input);
  }

  @Post('draft/documents')
  @UseInterceptors(FileFieldsInterceptor(documentFields, {
    limits: { files: 4, fileSize: maxBytes, fields: 0 },
  }))
  @Header('Cache-Control', 'private, no-store')
  saveDocuments(
    @CurrentPrincipal() principal: AuthPrincipal,
    @UploadedFiles() files: SellerRegistrationFiles,
  ) {
    return this.drafts.saveDocuments(principal.userId, files ?? {});
  }

  @Patch('application')
  @UseInterceptors(FileFieldsInterceptor(documentFields, {
    limits: { files: 4, fileSize: maxBytes, fields: 26 },
  }))
  @Header('Cache-Control', 'private, no-store')
  async update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() input: UpdateSellerApplicationDto,
    @UploadedFiles() files: SellerRegistrationFiles,
  ) {
    const owner = await this.drafts.requireAccount(principal.userId);
    const application = await this.database.sellerApplication.findFirst({
      where: { ownerUserId: principal.userId },
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
      select: { id: true, status: true },
    });
    if (!application || !allowedEdits.has(application.status)) {
      throw new ConflictException({
        code: 'SELLER_APPLICATION_REVIEW_LOCKED',
        message: 'You can edit only until Admin starts review or requests corrections.',
      });
    }
    return this.edits.update(
      application.id,
      { ...input, contactEmail: owner.email },
      files ?? {},
    );
  }
}
