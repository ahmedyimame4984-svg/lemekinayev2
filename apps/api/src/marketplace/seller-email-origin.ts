/**
 * All links in Seller notification emails must use a trusted absolute origin.
 * Reject invalid configuration at startup instead of silently exhausting the
 * encrypted notification outbox with unrenderable messages.
 */
export function resolveSellerEmailOrigin(
  configured: string | undefined,
  nodeEnvironment: string | undefined,
): string {
  const raw = configured?.trim();
  if (nodeEnvironment === 'production' && !raw) {
    throw new Error('SELLER_APP_ORIGIN must be an HTTPS origin in production.');
  }

  const value = raw || 'http://127.0.0.1:3002';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SELLER_APP_ORIGIN must be a full URL, such as http://localhost:3002.');
  }

  const developmentLocalhost =
    nodeEnvironment !== 'production' &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (
    !(url.protocol === 'https:' || developmentLocalhost) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('SELLER_APP_ORIGIN must use HTTPS (or HTTP localhost) without a path, credentials or query.');
  }
  return url.origin;
}
