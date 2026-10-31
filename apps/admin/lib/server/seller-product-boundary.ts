import { jsonNoStore } from './safe-response';

export function sellerOwnedProductWriteResponse(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'SELLER_PRODUCT_OWNED',
        message:
          'Actual products, identifiers, assets, and fitment are created by sellers. Admin manages reference data only.',
      },
    },
    405,
  );
}
