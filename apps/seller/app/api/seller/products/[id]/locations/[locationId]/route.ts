import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function POST(request: Request, context: { params: Promise<{ id: string; locationId: string }> }): Promise<Response> {
  const params = await context.params;
  const path = `/seller/products/${validSellerUuid(params.id)}/locations/${validSellerUuid(params.locationId)}`;
  return sellerWorkspaceRequest(request, path, 'POST');
}
