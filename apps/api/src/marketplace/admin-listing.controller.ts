import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  ListingTransitionDto,
  RejectListingDto,
  SellerListingQueryDto,
  SellerListingResponseDto,
} from './dto/listing.dto.js';
import { ListingService } from './listing.service.js';
import { AdminListingReviewService } from './admin-listing-review.service.js';
import { SellerListingEditService } from './seller-listing-edit.service.js';
import { RejectListingEditRevisionDto } from './dto/seller-listing-edit.dto.js';

@ApiTags('Admin seller listings')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'listing.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('listing.manage')
@Controller('admin/listings')
export class AdminListingController {
  constructor(
    private readonly listings: ListingService,
    private readonly edits: SellerListingEditService,
    private readonly reviewDetails: AdminListingReviewService,
  ) {}

  @Get()
  @ApiOkResponse({ type: SellerListingResponseDto, isArray: true })
  list(
    @Query() query: SellerListingQueryDto,
  ): Promise<SellerListingResponseDto[]> {
    return this.listings.listAdmin(query);
  }

  @Get('pending-revisions')
  @ApiOkResponse({ description: 'Pending Seller changes without unpublishing approved Listings' })
  pendingRevisions() {
    return this.edits.listPendingAdmin();
  }

  @Post(':id/revisions/:revisionId/approve')
  @ApiOkResponse({ description: 'Apply a reviewed revision only after the proposed Article is Active' })
  approveRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.edits.review(id, revisionId, principal.userId, 'APPROVE');
  }

  @Post(':id/revisions/:revisionId/reject')
  @ApiOkResponse({ description: 'Reject pending edits without changing the published Listing' })
  rejectRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @Body() input: RejectListingEditRevisionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.edits.review(id, revisionId, principal.userId, 'REJECT', input.reason);
  }

  @Get(':id/review')
  @ApiOkResponse({ description: 'Seller, Product Article, technical attributes, exact vehicle fitments, and pending revision for Admin review' })
  reviewDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewDetails.get(id);
  }

  @Get(':id')
  @ApiOkResponse({ type: SellerListingResponseDto })
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SellerListingResponseDto> {
    return this.listings.getAdmin(id);
  }

  @Post(':id/approve')
  @ApiOkResponse({ type: SellerListingResponseDto })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ListingTransitionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.approveAdmin(id, input, principal.userId);
  }

  @Post(':id/reject')
  @ApiOkResponse({ type: SellerListingResponseDto })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RejectListingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.rejectAdmin(id, input, principal.userId);
  }
}
