import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function GET(
  request: Request,
  context: { params: Promise<{ articleId: string }> },
): Promise<Response> {
  const { articleId } = await context.params;
  return sellerWorkspaceRequest(
    request,
    `/seller/entry/offer-requirements/${validSellerUuid(articleId)}`,
    'GET',
  );
}
