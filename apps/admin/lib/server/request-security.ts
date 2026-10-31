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
  const configuredOrigin = process.env.ADMIN_APP_ORIGIN;
  if (!configuredOrigin && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_APP_ORIGIN is required in production');
  }
  const requestOrigin = new URL(configuredOrigin || request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  if (
    (origin ? origin !== requestOrigin : fetchSite !== 'same-origin') ||
    (fetchSite && fetchSite !== 'same-origin')
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
