import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { SELLER_ACCESS_COOKIE } from '@/lib/server/seller-session';
import { jsonNoStore } from '@/lib/server/safe-response';

const GET_PATTERNS = [
  /^classification$/u,
  /^product-types$/u,
  /^products\/[0-9a-f-]+\/preview$/iu,
  /^product-types\/[0-9a-f-]+\/schema$/iu,
  /^articles$/u,
  /^articles\/[0-9a-f-]+\/draft$/iu,
  /^articles\/[0-9a-f-]+\/validation$/iu,
];

const POST_PATTERNS = [
  /^articles\/resolve-identity$/u,
  /^articles\/duplicate-preflight$/u,
  /^articles\/submit$/u,
  /^articles\/[0-9a-f-]+\/direct-identifiers$/iu,
  /^articles\/[0-9a-f-]+\/identifiers$/iu,
  /^articles\/[0-9a-f-]+\/relations$/iu,
  /^articles\/[0-9a-f-]+\/fitments\/exact$/iu,
  /^articles\/[0-9a-f-]+\/assets$/iu,
  /^articles\/[0-9a-f-]+\/submit-for-review$/iu,
];

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const path = (await context.params).path.join('/');
    if (!GET_PATTERNS.some((pattern) => pattern.test(path))) {
      return jsonNoStore(
        { error: { code: 'SELLER_ROUTE_NOT_ALLOWED', message: 'Route not allowed.' } },
        404,
      );
    }
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();
    return jsonNoStore(
      await requestSellerApi<unknown>(`/seller/catalog/${path}`, {
        accessToken,
      }),
    );
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}

const PATCH_PATTERNS = [/^articles\/[0-9a-f-]+\/draft$/iu];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const path = (await context.params).path.join('/');
    if (!PATCH_PATTERNS.some(pattern => pattern.test(path))) {
      return jsonNoStore(
        { error: { code: 'SELLER_ROUTE_NOT_ALLOWED', message: 'Route not allowed.' } },
        404,
      );
    }
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();
    const body = await readJsonObject(request, 32_000);
    return jsonNoStore(await requestSellerApi<unknown>(`/seller/catalog/${path}`, {
      method: 'PATCH',
      body,
      accessToken,
      timeoutMs: 20_000,
    }));
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const path = (await context.params).path.join('/');
    if (!POST_PATTERNS.some((pattern) => pattern.test(path))) {
      return jsonNoStore(
        { error: { code: 'SELLER_ROUTE_NOT_ALLOWED', message: 'Route not allowed.' } },
        404,
      );
    }
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();
    const body = await readJsonObject(request, 32_000);
    const result = await requestSellerApi<unknown>(`/seller/catalog/${path}`, {
      method: 'POST',
      body,
      accessToken,
      timeoutMs: 20_000,
    });
    const status =
      path === 'articles/resolve-identity' ||
      path.endsWith('/submit-for-review')
        ? 200
        : 201;
    return jsonNoStore(result, status);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}
