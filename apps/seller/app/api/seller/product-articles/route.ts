import { sellerWorkspaceRequest } from '@/lib/server/seller-workspace-proxy';

export async function GET(request: Request): Promise<Response> {
  return sellerWorkspaceRequest(request, '/seller/product-articles', 'GET');
}
