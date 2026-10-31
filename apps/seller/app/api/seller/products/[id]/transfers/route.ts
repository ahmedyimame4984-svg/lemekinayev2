import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Params): Promise<Response> {
  const { id } = await context.params;
  return sellerWorkspaceRequest(request, `/seller/products/${validSellerUuid(id)}/transfers`, 'GET');
}
export async function POST(request: Request, context: Params): Promise<Response> {
  const { id } = await context.params;
  return sellerWorkspaceRequest(request, `/seller/products/${validSellerUuid(id)}/transfers`, 'POST', true);
}
