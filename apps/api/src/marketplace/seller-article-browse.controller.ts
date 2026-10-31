import { Controller, Get, Query } from '@nestjs/common';
import { AccountType, ProductStatus } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';

class SellerArticleBrowseQuery {
  @IsOptional() @IsString() @MaxLength(120)
  q?: string;
}

@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/catalog')
export class SellerArticleBrowseController {
  constructor(private readonly database: DatabaseService) {}

  @Get('browse')
  async browse(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: SellerArticleBrowseQuery,
  ) {
    const user = await this.database.user.findFirst({
      where: {
        id: principal.userId,
        accountType: AccountType.SELLER,
        status: 'ACTIVE',
        emailVerifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (!user) return { articles: [] };

    const q = query.q?.trim();
    const articles = await this.database.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        ...(q && q.length >= 2 ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { brand: { name: { contains: q, mode: 'insensitive' as const } } },
          ],
        } : {}),
      },
      select: {
        id: true, name: true, shortDescription: true,
        description: true, publishedAt: true,
        brand: { select: { name: true } },
        productType: { select: { name: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: 50,
    });
    return { articles };
  }
}
