import { cookies } from 'next/headers';
import type { ProductRecord } from '@/lib/product-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { sellerOwnedProductWriteResponse } from '@/lib/server/seller-product-boundary';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();
    const status = url.searchParams.get('status');
    const categoryId = url.searchParams.get('categoryId');
    const productTypeId = url.searchParams.get('productTypeId');
    const productFamilyId = url.searchParams.get('productFamilyId');
    const brandId = url.searchParams.get('brandId');
    const unitOfMeasureId = url.searchParams.get('unitOfMeasureId');

    if (status) query.set('status', status);
    if (categoryId) query.set('categoryId', categoryId);
    if (productTypeId) query.set('productTypeId', productTypeId);
    if (productFamilyId) query.set('productFamilyId', productFamilyId);
    if (brandId) query.set('brandId', brandId);
    if (unitOfMeasureId) query.set('unitOfMeasureId', unitOfMeasureId);

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const products = await requestAdminApi<ProductRecord[]>(
      `/admin/products${suffix}`,
      { accessToken },
    );

    return jsonNoStore(products);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export function POST(): Response {
  return sellerOwnedProductWriteResponse();
}

function unauthenticated(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in to continue.',
      },
    },
    401,
  );
}
