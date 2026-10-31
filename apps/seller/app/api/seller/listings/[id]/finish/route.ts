import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return sellerWorkspaceRequest(
    request, `/seller/listings/${validSellerUuid(id)}/finish`, 'POST',
  );
}
