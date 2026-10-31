import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  ReceiveSellerStockTransferDto,
  TransferSellerProductStockDto,
} from './dto/seller-product.dto.js';
import { SellerStockTransferService } from './seller-stock-transfer.service.js';

@ApiTags('Seller stock transfers')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/products/:sellerProductId/transfers')
export class SellerStockTransferController {
  constructor(private readonly transfers: SellerStockTransferService) {}

  @Get()
  list(
    @Param('sellerProductId', ParseUUIDPipe) sellerProductId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.transfers.list(sellerProductId, principal.userId);
  }

  @Post()
  dispatch(
    @Param('sellerProductId', ParseUUIDPipe) sellerProductId: string,
    @Body() input: TransferSellerProductStockDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.transfers.dispatch(sellerProductId, input, principal.userId);
  }

  @Post(':transferId/receive')
  receive(
    @Param('sellerProductId', ParseUUIDPipe) sellerProductId: string,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() input: ReceiveSellerStockTransferDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.transfers.receive(sellerProductId, transferId, input, principal.userId);
  }
}
