import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CanonicalChangeFeedResponse,
  CanonicalSnapshotCheckpoint,
  CanonicalSnapshotPageResponse,
  CanonicalSyncEntityType,
} from './reference-sync.types.js';

/** A frozen source snapshot is no longer available. Never reuse its page cursor. */
export class SnapshotExpiredError extends Error {
  constructor() {
    super('AutotechDoc snapshot expired (HTTP 410); create a new consistent snapshot');
    this.name = 'SnapshotExpiredError';
  }
}

export interface SyncClientConfig {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

@Injectable()
export class AutotechdocSyncClient {
  private readonly logger = new Logger(AutotechdocSyncClient.name);
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(@Optional() config?: SyncClientConfig) {
    this.baseUrl = (
      config?.baseUrl ??
      process.env.AUTOTECHDOC_SYNC_BASE_URL ??
      'http://127.0.0.1:4000/api/v1'
    ).trim().replace(/\/$/u, '');
    this.token = (config?.token ?? process.env.AUTOTECHDOC_SYNC_TOKEN)?.trim();
    this.timeoutMs = config?.timeoutMs ?? 15_000;
    this.maxRetries = config?.maxRetries ?? 4;
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 1 || this.maxRetries > 10) {
      throw new Error('AutotechDoc client maxRetries must be between 1 and 10');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.token.length >= 32);
  }

  private async requestWithRetry<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('AUTOTECHDOC_SYNC_TOKEN must be a provisioned B2B machine key');
    }
    const url = this.baseUrl + path;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + this.token,
            ...options?.headers,
          },
        });
        if (response.ok) return (await response.json()) as T;
        if (response.status === 410) throw new SnapshotExpiredError();
        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException('AutotechDoc B2B credentials rejected (HTTP ' + response.status + ')');
        }
        if (response.status === 400) {
          throw new BadRequestException('AutotechDoc rejected v2 contract request: ' + (await response.text()).slice(0, 500));
        }
        if (response.status !== 429 && response.status < 500) {
          throw new Error('AutotechDoc non-retryable response: HTTP ' + response.status);
        }
        // Do not log B2B tokens, bodies, or canonical record contents.
        lastError = new Error('AutotechDoc temporary HTTP ' + response.status);
        this.logger.warn('AutotechDoc ' + path.split('?')[0] + ' returned HTTP ' + response.status +
          ' (attempt ' + attempt + '/' + this.maxRetries + ')');
      } catch (err: unknown) {
        if (err instanceof SnapshotExpiredError || err instanceof UnauthorizedException ||
            err instanceof BadRequestException) throw err;
        lastError = err instanceof Error ? err : new Error('Network failure');
      } finally {
        clearTimeout(timer);
      }
      if (attempt < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.min(5000, 200 * 2 ** (attempt - 1)) +
          Math.floor(Math.random() * 100)));
      }
    }
    throw lastError ?? new Error('AutotechDoc v2 request exhausted retries');
  }

  createSnapshot(): Promise<CanonicalSnapshotCheckpoint> {
    return this.requestWithRetry('/reference-data/export/v2/snapshots', { method: 'POST' });
  }

  fetchSnapshotPage<T = Record<string, unknown>>(
    snapshotId: string,
    entityType: CanonicalSyncEntityType,
    cursor?: string | null,
    limit = 100,
  ): Promise<CanonicalSnapshotPageResponse<T>> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return this.requestWithRetry(
      '/reference-data/export/v2/snapshots/' + encodeURIComponent(snapshotId) +
      '/' + encodeURIComponent(entityType) + '?' + params.toString(),
    );
  }

  fetchChangeFeed(
    after?: string | null,
    through?: string | null,
    limit = 100,
  ): Promise<CanonicalChangeFeedResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (after !== undefined && after !== null) params.set('after', after);
    if (through !== undefined && through !== null) params.set('through', through);
    return this.requestWithRetry('/reference-data/export/v2/changes?' + params.toString());
  }
}
