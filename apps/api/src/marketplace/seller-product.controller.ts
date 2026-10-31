import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { CreateSellerProductDto, MoveSellerProductStockDto } from './dto/seller-product.dto.js';
import { SellerProductService } from './seller-product.service.js';

@ApiTags('Seller Products')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/products')
export class SellerProductController {
  constructor(private readonly products: SellerProductService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.products.list(principal.userId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.products.get(id, principal.userId);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Seller Product created, with default Store associated at zero stock' })
  create(@Body() input: CreateSellerProductDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.products.create(input, principal.userId);
  }

  @Post(':id/locations/:locationId')
  addLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.products.addLocation(id, locationId, principal.userId);
  }

  @Post(':id/stock')
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MoveSellerProductStockDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.products.adjustStock(id, input, principal.userId);
  }
}
