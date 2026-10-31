import { sellerWorkspaceRequest, validSellerUuid } from '@/lib/server/seller-workspace-proxy';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';

export const maxDuration = 70;

type Context = { params: Promise<{ id: string; operation?: string[] }> };
async function forward(request: Request, context: Context, method: 'GET' | 'POST' | 'PATCH') {
  try {
    const { id, operation = [] } = await context.params;
    const listing = validSellerUuid(id);
    const normalized = operation.length === 0 ? '' : operation.join('/');
    const valid = method === 'GET'
      ? normalized === '' || normalized === 'requirements' || /^[a-f0-9-]{36}\/preview$/i.test(normalized)
      : method === 'PATCH'
      ? normalized === 'order'
      : normalized === 'presign' || /^[a-f0-9-]{36}\/(?:complete|remove)$/i.test(normalized);
    if (!valid) return new Response(null, { status: 404 });
    const parts = normalized.split('/').filter(Boolean);
    if (parts[0] && parts[0] !== 'order' && parts[0] !== 'presign' && parts[0] !== 'requirements') {
      parts[0] = validSellerUuid(parts[0]);
    }
    const path = `/seller/listings/${listing}/assets${parts.length ? '/' + parts.join('/') : ''}`;
    return sellerWorkspaceRequest(request, path, method, method === 'POST' && normalized === 'presign',
      normalized.endsWith('/complete') ? 60_000 : undefined);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
export function GET(request: Request, context: Context) { return forward(request, context, 'GET'); }
export function POST(request: Request, context: Context) { return forward(request, context, 'POST'); }
export function PATCH(request: Request, context: Context) { return forward(request, context, 'PATCH'); }
