import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function GET(request: Request): Promise<Response> {
  const path = '/seller/products';
  return sellerWorkspaceRequest(request, path, 'GET');
}

export async function POST(request: Request): Promise<Response> {
  const path = '/seller/products';
  return sellerWorkspaceRequest(request, path, 'POST', true);
}
