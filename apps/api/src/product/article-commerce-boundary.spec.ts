import {
  MasterDataStatus,
  Prisma,
  ProductStatus,
  SellerListingStatus,
} from '@prisma/client';
import {
  assertArticleActiveForCommerce,
  assertArticleHasNoLiveCommerce,
  isArticleActiveForCommerce,
  LIVE_SELLER_LISTING_STATUSES,
} from './article-commerce-boundary.js';

describe('Article commerce boundary', () => {
  const product = { findUnique: vi.fn() };
  const sellerListing = { findFirst: vi.fn() };
  const supplierOffer = { findFirst: vi.fn() };
  const client = {
    product,
    sellerListing,
    supplierOffer,
  } as unknown as Pick<
    Prisma.TransactionClient,
    'product' | 'sellerListing' | 'supplierOffer'
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockResolvedValue({
      id: 'article-id',
      status: ProductStatus.ACTIVE,
    });
    sellerListing.findFirst.mockResolvedValue(null);
    supplierOffer.findFirst.mockResolvedValue(null);
  });

  it('defines submitted and approved listing states as live commerce', async () => {
    await expect(
      assertArticleHasNoLiveCommerce(client, 'article-id'),
    ).resolves.toBeUndefined();

    expect(sellerListing.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 'article-id',
        status: { in: LIVE_SELLER_LISTING_STATUSES },
      },
      select: { id: true, status: true },
    });
    expect(LIVE_SELLER_LISTING_STATUSES).toEqual([
      SellerListingStatus.SUBMITTED,
      SellerListingStatus.ACTIVE,
      SellerListingStatus.OUT_OF_STOCK,
    ]);
    expect(supplierOffer.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 'article-id',
        status: MasterDataStatus.ACTIVE,
      },
      select: { id: true },
    });
  });

  it('blocks Article deactivation when live commerce exists', async () => {
    sellerListing.findFirst.mockResolvedValue({
      id: 'listing-id',
      status: SellerListingStatus.OUT_OF_STOCK,
    });
    supplierOffer.findFirst.mockResolvedValue({ id: 'offer-id' });

    await expect(
      assertArticleHasNoLiveCommerce(client, 'article-id'),
    ).rejects.toMatchObject({
      response: {
        code: 'ARTICLE_LIVE_COMMERCE_EXISTS',
        details: {
          sellerListingId: 'listing-id',
          sellerListingStatus: SellerListingStatus.OUT_OF_STOCK,
          supplierOfferId: 'offer-id',
        },
      },
    });
  });

  it('reports Article commerce readiness without exposing commercial fields', async () => {
    expect(await isArticleActiveForCommerce(client, 'article-id')).toBe(true);

    product.findUnique.mockResolvedValue({
      id: 'article-id',
      status: ProductStatus.INACTIVE,
    });

    expect(await isArticleActiveForCommerce(client, 'article-id')).toBe(false);
    await expect(
      assertArticleActiveForCommerce(client, 'article-id'),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_NOT_ACTIVE_FOR_COMMERCE' },
    });
  });
});
