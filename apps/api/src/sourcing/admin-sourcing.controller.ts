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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
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
  CreateSupplierOfferDto,
  SupplierOfferAdminQueryDto,
  SupplierOfferResponseDto,
  UpdateSupplierOfferDto,
} from './dto/supplier-offer.dto.js';
import {
  BulkUpdateSupplierStatusDto,
  CreateSupplierDto,
  SupplierAdminPageQueryDto,
  SupplierAdminQueryDto,
  SupplierBulkStatusResponseDto,
  SupplierPageResponseDto,
  SupplierResponseDto,
  UpdateSupplierDto,
} from './dto/supplier.dto.js';
import { SourcingService } from './sourcing.service.js';

@ApiTags('Admin sourcing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'sourcing.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('sourcing.manage')
@Controller('admin/sourcing')
export class AdminSourcingController {
  constructor(private readonly sourcing: SourcingService) {}

  @Get('suppliers')
  @ApiOperation({ summary: 'List governed automotive Suppliers' })
  @ApiOkResponse({ type: SupplierResponseDto, isArray: true })
  listSuppliers(
    @Query() query: SupplierAdminQueryDto,
  ): Promise<SupplierResponseDto[]> {
    return this.sourcing.listSuppliers(query);
  }

  @Get('suppliers/page')
  @ApiOperation({ summary: 'Search and page governed automotive Suppliers' })
  @ApiOkResponse({ type: SupplierPageResponseDto })
  listSuppliersPage(
    @Query() query: SupplierAdminPageQueryDto,
  ): Promise<SupplierPageResponseDto> {
    return this.sourcing.listSuppliersPage(query);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create a governed automotive Supplier' })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  @ApiConflictResponse({ description: 'Duplicate Supplier code' })
  createSupplier(
    @Body() input: CreateSupplierDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SupplierResponseDto> {
    return this.sourcing.createSupplier(input, principal.userId);
  }

  @Patch('suppliers/bulk-status')
  @ApiOperation({ summary: 'Bulk update Supplier lifecycle with version safety' })
  @ApiOkResponse({ type: SupplierBulkStatusResponseDto })
  @ApiConflictResponse({ description: 'Lifecycle or version conflict' })
  bulkUpdateSupplierStatus(
    @Body() input: BulkUpdateSupplierStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SupplierBulkStatusResponseDto> {
    return this.sourcing.bulkUpdateSupplierStatus(input, principal.userId);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: 'Update Supplier Master with optimistic versioning' })
  @ApiOkResponse({ type: SupplierResponseDto })
  @ApiConflictResponse({ description: 'Lifecycle or version conflict' })
  updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSupplierDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SupplierResponseDto> {
    return this.sourcing.updateSupplier(id, input, principal.userId);
  }

  @Get('offers')
  @ApiOperation({
    summary: 'List commercial Supplier Offers linked to Manufacturer Articles',
  })
  @ApiOkResponse({ type: SupplierOfferResponseDto, isArray: true })
  listOffers(
    @Query() query: SupplierOfferAdminQueryDto,
  ): Promise<SupplierOfferResponseDto[]> {
    return this.sourcing.listOffers(query);
  }

  @Post('offers')
  @ApiOperation({
    summary: 'Create a commercial Supplier Offer for a Manufacturer Article',
  })
  @ApiCreatedResponse({ type: SupplierOfferResponseDto })
  @ApiConflictResponse({ description: 'Lifecycle or sourcing conflict' })
  createOffer(
    @Body() input: CreateSupplierOfferDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SupplierOfferResponseDto> {
    return this.sourcing.createOffer(input, principal.userId);
  }

  @Patch('offers/:id')
  @ApiOperation({
    summary: 'Update a Supplier Offer with optimistic versioning',
  })
  @ApiOkResponse({ type: SupplierOfferResponseDto })
  @ApiConflictResponse({ description: 'Lifecycle or version conflict' })
  updateOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSupplierOfferDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SupplierOfferResponseDto> {
    return this.sourcing.updateOffer(id, input, principal.userId);
  }
}
