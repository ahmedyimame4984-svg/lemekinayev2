import { sellerWorkspaceRequest } from '@/lib/server/seller-workspace-proxy';
export async function GET(request: Request) {
  return sellerWorkspaceRequest(request, '/seller/registration/workspace', 'GET');
}
