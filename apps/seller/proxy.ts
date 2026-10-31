import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from '@/lib/security-policy';

const production = process.env.NODE_ENV === 'production';
const SELLER_ACCESS_COOKIE = production
  ? '__Host-lemekinaye_seller_access'
  : 'lemekinaye_seller_access';

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== 'production',
  );
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  headers.set('x-nonce', nonce);

  const protectedPath =
    request.nextUrl.pathname === '/account' ||
    request.nextUrl.pathname.startsWith('/account/') ||
    request.nextUrl.pathname === '/dashboard' ||
    request.nextUrl.pathname.startsWith('/dashboard/') ||
    request.nextUrl.pathname === '/onboarding' ||
    request.nextUrl.pathname.startsWith('/onboarding/') ||
    request.nextUrl.pathname === '/products' ||
    request.nextUrl.pathname.startsWith('/products/') ||
    request.nextUrl.pathname === '/listings' ||
    request.nextUrl.pathname.startsWith('/listings/') ||
    request.nextUrl.pathname === '/articles' ||
    request.nextUrl.pathname.startsWith('/articles/');
  let response: NextResponse;
  if (protectedPath && !request.cookies.has(SELLER_ACCESS_COOKIE)) {
    response = NextResponse.redirect(new URL('/login', request.url));
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
