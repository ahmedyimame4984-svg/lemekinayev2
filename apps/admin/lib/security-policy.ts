export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.r2.dev",
    // Application document previews use temporary in-memory Blob URLs.
    "frame-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.r2.cloudflarestorage.com https://*.r2.dev",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
}
