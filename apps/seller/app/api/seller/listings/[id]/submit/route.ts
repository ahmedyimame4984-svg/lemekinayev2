import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const params = await context.params;
  const path = `/seller/listings/${validSellerUuid(params.id)}/submit`;
  return sellerWorkspaceRequest(request, path, 'POST');
}
