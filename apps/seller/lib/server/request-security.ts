import 'server-only';

export class RequestInputError extends Error {
  constructor(
    readonly status: 400 | 403 | 413 | 415,
    message: string,
  ) {
    super(message);
    this.name = 'RequestInputError';
  }
}

export function assertSameOrigin(request: Request): void {
  // A deployment may not set SELLER_APP_ORIGIN. Use the origin normalized by
  // Next.js for this request, while retaining an explicit override and checking
  // Origin plus Fetch Metadata below to reject cross-site browser writes.
  const configuredOrigin = process.env.SELLER_APP_ORIGIN?.trim();
  const requestUrlOrigin = new URL(request.url).origin;
  const configuredUrlOrigin = configuredOrigin ? new URL(configuredOrigin).origin : null;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  const matchesOrigin = (cand: string) => {
    if (cand === requestUrlOrigin) return true;
    if (configuredUrlOrigin && cand === configuredUrlOrigin) return true;
    try {
      const u1 = new URL(cand);
      const isLoopback = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '::1';
      if (isLoopback(u1.hostname)) {
        const u2 = new URL(requestUrlOrigin);
        if (isLoopback(u2.hostname) && (u1.port === u2.port || (!u1.port && !u2.port))) {
          return true;
        }
        if (configuredUrlOrigin) {
          const u3 = new URL(configuredUrlOrigin);
          if (isLoopback(u3.hostname) && (u1.port === u3.port || (!u1.port && !u3.port))) {
            return true;
          }
        }
      }
    } catch {}
    return false;
  };

  if (
    (origin ? !matchesOrigin(origin) : fetchSite !== 'same-origin') ||
    (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site')
  ) {
    throw new RequestInputError(403, 'Cross-site request rejected');
  }
}

export async function readJsonObject(
  request: Request,
  maximumBytes = 4_096,
): Promise<Record<string, unknown>> {
  const contentType = request.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    throw new RequestInputError(415, 'Use an application/json request body');
  }
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new RequestInputError(413, 'Request is too large');
  }

  const reader = request.body?.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let totalBytes = 0;
  let text = '';
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maximumBytes) {
          await reader.cancel();
          throw new RequestInputError(413, 'Request is too large');
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (error instanceof RequestInputError) throw error;
      throw new RequestInputError(400, 'Request body must be valid JSON');
    } finally {
      reader.releaseLock();
    }
  }

  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Expected an object');
    }
    return value as Record<string, unknown>;
  } catch {
    throw new RequestInputError(400, 'Request body must be valid JSON');
  }
}
