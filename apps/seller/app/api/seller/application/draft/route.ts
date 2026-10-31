import { sellerWorkspaceRequest } from '@/lib/server/seller-workspace-proxy';
export async function PATCH(request: Request) {
  return sellerWorkspaceRequest(request, '/seller/registration/draft', 'PATCH');
}
