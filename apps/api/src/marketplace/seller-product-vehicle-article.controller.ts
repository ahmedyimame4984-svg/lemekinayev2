import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { SellerProductVehicleArticleService } from './seller-product-vehicle-article.service.js';

@ApiTags('Seller Product Articles')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/product-articles')
export class SellerProductVehicleArticleController {
  constructor(private readonly articles: SellerProductVehicleArticleService) {}

  @Get()
  @ApiOkResponse({ description: 'Unique canonical product and vehicle-configuration applications' })
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.articles.list(principal.userId);
  }
}
