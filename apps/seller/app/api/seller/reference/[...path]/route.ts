import { requestSellerApi } from '@/lib/server/seller-api';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

const ALLOWED = [
  /^brands$/u,
  /^vehicles\/makes$/u,
  /^vehicles\/models\?makeId=[0-9a-f-]+$/iu,
  /^vehicles\/derivatives\?modelId=[0-9a-f-]+$/iu,
  /^vehicles\/generations\?modelId=[0-9a-f-]+(?:&derivativeId=[0-9a-f-]+)?$/iu,
  /^vehicles\/trims\?generationId=[0-9a-f-]+$/iu,
  /^vehicles\/configurations\?modelId=[0-9a-f-]+(?:&[A-Za-z]+=[0-9a-f-]+)*$/iu,
];

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const pathname = (await context.params).path.join('/');
    const searchParams = new URL(request.url).searchParams;

    if (pathname === 'search/catalog') {
      const q = searchParams.get('q')?.trim() ?? '';
      const limit = Number(searchParams.get('limit') ?? '8');
      if (
        q.length < 2 ||
        q.length > 120 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 20
      ) {
        return jsonNoStore(
          {
            error: {
              code: 'SELLER_REFERENCE_QUERY_INVALID',
              message: 'Catalog search requires 2–120 characters and limit 1–20.',
            },
          },
          400,
        );
      }
      const query = new URLSearchParams({ q, limit: String(limit) });
      return jsonNoStore(
        await requestSellerApi<unknown>(`/search/catalog?${query.toString()}`),
      );
    }

    const query = searchParams.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    if (!ALLOWED.some((pattern) => pattern.test(target))) {
      return jsonNoStore(
        { error: { code: 'SELLER_REFERENCE_NOT_ALLOWED', message: 'Reference route not allowed.' } },
        404,
      );
    }
    return jsonNoStore(await requestSellerApi<unknown>(`/${target}`));
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
