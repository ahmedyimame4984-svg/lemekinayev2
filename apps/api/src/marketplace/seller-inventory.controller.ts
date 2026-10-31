import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  AdjustInventoryDto,
  CreateInventoryDto,
  CreateInventoryLocationDto,
  InventoryLocationResponseDto,
  InventoryResponseDto,
} from './dto/listing.dto.js';
import { InventoryService } from './inventory.service.js';
import { ChangeSellerLocationDto } from './dto/seller-product.dto.js';

@ApiTags('Seller inventory')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'An operational Seller account is required' })
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/inventory')
export class SellerInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('locations')
  @ApiOkResponse({ type: InventoryLocationResponseDto, isArray: true })
  listLocations(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<InventoryLocationResponseDto[]> {
    return this.inventory.listLocationsForSellerUser(principal.userId);
  }

  @Post('locations')
  @ApiCreatedResponse({ type: InventoryLocationResponseDto })
  createLocation(
    @Body() input: CreateInventoryLocationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<InventoryLocationResponseDto> {
    return this.inventory.createLocationForSellerUser(
      input,
      principal.userId,
    );
  }

  @Patch('locations/:id')
  @ApiOkResponse({ type: InventoryLocationResponseDto })
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ChangeSellerLocationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.inventory.updateLocationForSellerUser(id, input, principal.userId);
  }

  @Get('listings/:listingId')
  @ApiOkResponse({ type: InventoryResponseDto, isArray: true })
  listListingInventory(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<InventoryResponseDto[]> {
    return this.inventory.listForSellerUser(listingId, principal.userId);
  }

  @Post('listings/:listingId')
  @ApiCreatedResponse({ type: InventoryResponseDto })
  createListingInventory(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() input: CreateInventoryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<InventoryResponseDto> {
    return this.inventory.createForSellerUser(
      listingId,
      input,
      principal.userId,
    );
  }

  @Patch('listings/:listingId/:inventoryId/adjust')
  @ApiOkResponse({ type: InventoryResponseDto })
  adjustListingInventory(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() input: AdjustInventoryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<InventoryResponseDto> {
    return this.inventory.adjustForSellerUser(
      listingId,
      inventoryId,
      input,
      principal.userId,
    );
  }
}
