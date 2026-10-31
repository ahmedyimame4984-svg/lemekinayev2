import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; transferId: string }> },
): Promise<Response> {
  const { id, transferId } = await context.params;
  return sellerWorkspaceRequest(
    request,
    `/seller/products/${validSellerUuid(id)}/transfers/${validSellerUuid(transferId)}/receive`,
    'POST',
  );
}
