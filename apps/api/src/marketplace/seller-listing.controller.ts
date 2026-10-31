import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateSellerListingDto,
  ListingTransitionDto,
  SellerListingQueryDto,
  SellerListingResponseDto,
  UpdateListingPriceDto,
  UpdateSellerListingDto,
} from './dto/listing.dto.js';
import { ListingService } from './listing.service.js';
import { SellerListingEditService } from './seller-listing-edit.service.js';
import { SaveSellerListingEditDto } from './dto/seller-listing-edit.dto.js';
import { DatabaseService } from '../database/database.service.js';

@ApiTags('Seller listings')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'An operational Seller account is required' })
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/listings')
export class SellerListingController {
  constructor(
    private readonly listings: ListingService,
    private readonly database: DatabaseService,
    private readonly edits: SellerListingEditService,
  ) {}

  @Get()
  @ApiOkResponse({ type: SellerListingResponseDto, isArray: true })
  list(
    @Query() query: SellerListingQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto[]> {
    return this.listings.listForSellerUser(principal.userId, query);
  }

  @Post()
  @ApiCreatedResponse({ type: SellerListingResponseDto })
  create(
    @Body() input: CreateSellerListingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.createForSellerUser(input, principal.userId);
  }

  @Get(':id')
  @ApiOkResponse({ type: SellerListingResponseDto })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.getForSellerUser(id, principal.userId);
  }

  @Get(':id/article-details')
  @ApiOkResponse({ description: 'Owner-scoped complete Product Article and exact configured vehicle fitments' })
  async articleDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    // Authorize the Listing first. Never expose a draft Article by guessing its ID.
    const listing = await this.listings.getForSellerUser(id, principal.userId);
    const article = await this.database.product.findUniqueOrThrow({
      where: { id: listing.productId },
      select: {
        id: true, name: true, status: true, productTypeId: true,
        articleSource: true, sourceSellerId: true, catalogReviewSubmittedAt: true,
        brandId: true, brand: { select: { name: true } },
        productType: { select: { name: true } },
        schemaVersionId: true,
        partNumbers: { select: { type: true, partNumber: true, issuerBrandId: true } },
        articleIdentifiers: { select: { type: true, value: true } },
        attributeValues: {
          select: {
            attribute: { select: { code: true, name: true } },
            valueString: true, valueNumeric: true, valueBoolean: true,
            valueReferenceId: true, valueJson: true, unit: true,
          },
        },
        compatibilities: {
          where: { vehicleConfigurationId: { not: null } },
          select: {
            vehicleConfigurationId: true, fitmentType: true,
            status: true, verificationStatus: true,
            vehicleConfiguration: {
              select: {
                id: true, code: true, identityCode: true, modelYear: true,
                make: { select: { name: true } },
                model: { select: { name: true } },
                generation: { select: { name: true } },
                trim: { select: { name: true } },
                engine: { select: { name: true } },
                transmission: { select: { code: true } },
                bodyType: { select: { name: true } },
                market: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    return article;
  }

  @Get(':id/pending-edit')
  @ApiOkResponse({ description: 'Pending review of Seller-supplied Listing changes' })
  pendingEdit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.edits.getPending(id, principal.userId);
  }

  @Patch(':id/edit')
  @ApiOkResponse({ description: 'Save one Listing form: price now, substantive changes in Admin review' })
  saveEdit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveSellerListingEditDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.edits.save(id, input, principal.userId);
  }

  @Patch(':id')
  @ApiOkResponse({ type: SellerListingResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSellerListingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.updateForSellerUser(id, input, principal.userId);
  }

  @Patch(':id/price')
  @ApiOkResponse({ type: SellerListingResponseDto })
  updatePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateListingPriceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.updatePriceForSellerUser(
      id,
      input,
      principal.userId,
    );
  }

  @Post(':id/finish')
  @ApiOkResponse({ type: SellerListingResponseDto })
  finish(@Param('id', ParseUUIDPipe) id: string,
         @CurrentPrincipal() principal: AuthPrincipal): Promise<SellerListingResponseDto> {
    return this.listings.finishCreationForSellerUser(id, principal.userId);
  }

  @Post(':id/submit')
  @ApiOkResponse({ type: SellerListingResponseDto })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ListingTransitionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerListingResponseDto> {
    return this.listings.submitForSellerUser(id, input, principal.userId);
  }
}
