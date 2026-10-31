import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const params = await context.params;
  const path = `/seller/listings/${validSellerUuid(params.id)}`;
  return sellerWorkspaceRequest(request, path, 'GET');
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const params = await context.params;
  const path = `/seller/listings/${validSellerUuid(params.id)}`;
  return sellerWorkspaceRequest(request, path, 'PATCH');
}
