import { sellerOwnedProductWriteResponse } from '@/lib/server/seller-product-boundary';

export function POST(): Response {
  return sellerOwnedProductWriteResponse();
}
