import { sellerOwnedProductWriteResponse } from '@/lib/server/seller-product-boundary';

export function PATCH(): Response {
  return sellerOwnedProductWriteResponse();
}
