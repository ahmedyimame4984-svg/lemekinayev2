import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  ProductStatus,
  SellerListingStatus,
} from '@prisma/client';

export const LIVE_SELLER_LISTING_STATUSES: SellerListingStatus[] = [
  SellerListingStatus.SUBMITTED,
  SellerListingStatus.ACTIVE,
  SellerListingStatus.OUT_OF_STOCK,
];

type ArticleCommerceClient = Pick<
  Prisma.TransactionClient,
  'product' | 'sellerListing' | 'supplierOffer'
>;

export async function isArticleActiveForCommerce(
  client: Pick<Prisma.TransactionClient, 'product'>,
  articleId: string,
): Promise<boolean> {
  const article = await client.product.findUnique({
    where: { id: articleId },
    select: { status: true },
  });
  return article?.status === ProductStatus.ACTIVE;
}

export async function assertArticleActiveForCommerce(
  client: Pick<Prisma.TransactionClient, 'product'>,
  articleId: string,
  options?: { code?: string; message?: string },
): Promise<void> {
  const article = await client.product.findUnique({
    where: { id: articleId },
    select: { id: true, status: true },
  });

  if (!article) {
    throw new NotFoundException({
      code: 'MANUFACTURER_ARTICLE_NOT_FOUND',
      message: 'Manufacturer Article was not found',
    });
  }

  if (article.status !== ProductStatus.ACTIVE) {
    throw new ConflictException({
      code: options?.code ?? 'ARTICLE_NOT_ACTIVE_FOR_COMMERCE',
      message:
        options?.message ??
        'Live commercial records require an Active Manufacturer Article',
    });
  }
}

export async function assertArticleHasNoLiveCommerce(
  client: ArticleCommerceClient,
  articleId: string,
): Promise<void> {
  const [listing, supplierOffer] = await Promise.all([
    client.sellerListing.findFirst({
      where: {
        productId: articleId,
        status: { in: LIVE_SELLER_LISTING_STATUSES },
      },
      select: { id: true, status: true },
    }),
    client.supplierOffer.findFirst({
      where: {
        productId: articleId,
        status: MasterDataStatus.ACTIVE,
      },
      select: { id: true },
    }),
  ]);

  if (!listing && !supplierOffer) return;

  throw new ConflictException({
    code: 'ARTICLE_LIVE_COMMERCE_EXISTS',
    message:
      'Resolve submitted/live Seller Listings and Active Supplier Offers before moving the Manufacturer Article out of Active status',
    details: {
      sellerListingId: listing?.id ?? null,
      sellerListingStatus: listing?.status ?? null,
      supplierOfferId: supplierOffer?.id ?? null,
    },
  });
}
