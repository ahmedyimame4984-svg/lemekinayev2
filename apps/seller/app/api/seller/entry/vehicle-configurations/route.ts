import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { RequestInputError } from '@/lib/server/request-security';
import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';

export async function GET(request: Request): Promise<Response> {
  try {
    const modelId = new URL(request.url).searchParams.get('modelId');
    if (!modelId) throw new RequestInputError(400, 'Select a vehicle model.');
    return sellerWorkspaceRequest(
      request,
      `/seller/entry/vehicle-configurations?modelId=${validSellerUuid(modelId)}`,
      'GET',
    );
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
