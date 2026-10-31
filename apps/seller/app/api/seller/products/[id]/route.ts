import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const params = await context.params;
  const path = `/seller/products/${validSellerUuid(params.id)}`;
  return sellerWorkspaceRequest(request, path, 'GET');
}
