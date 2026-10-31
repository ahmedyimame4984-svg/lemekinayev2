import { sellerWorkspaceRequest } from '@/lib/server/seller-workspace-proxy';

// Allow hosting platforms sufficient execution time for the 20-second API transaction.
export const maxDuration = 35;

export async function POST(request: Request): Promise<Response> {
  // The upstream serializable transaction can take up to 20 seconds; the
  // ordinary 10-second Seller proxy timeout would abort a valid save.
  return sellerWorkspaceRequest(request, '/seller/entry', 'POST', true, 30_000);
}
