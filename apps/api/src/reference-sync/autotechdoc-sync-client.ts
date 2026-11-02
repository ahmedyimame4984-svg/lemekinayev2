import {
  BadRequestException,
  Injectable,
  Inject,
  Optional,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CanonicalChangeFeedResponse,
  CanonicalManifestResponse,
  CanonicalSnapshotPageResponse,
  CanonicalSyncEntityType,
} from './reference-sync.types.js';

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

  constructor(@Optional() @Inject('AUTOTECHDOC_SYNC_CLIENT_CONFIG') config?: SyncClientConfig) {
    this.baseUrl = (
      config?.baseUrl ??
      process.env.AUTOTECHDOC_SYNC_BASE_URL ??
      'http://127.0.0.1:4000/api/v1'
    ).replace(/\/$/u, '');
    this.token = config?.token ?? process.env.AUTOTECHDOC_SYNC_TOKEN;
    this.timeoutMs = config?.timeoutMs ?? 15_000;
    this.maxRetries = config?.maxRetries ?? 4;
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.token.length >= 32);
  }

  private async requestWithRetry<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'AutotechDoc synchronization is not configured: AUTOTECHDOC_SYNC_TOKEN is missing or too short',
      );
    }

    const url = `${this.baseUrl}${path}`;
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
            Authorization: `Bearer ${this.token}`,
            ...options?.headers,
          },
        });

        clearTimeout(timer);

        if (response.ok) {
          return (await response.json()) as T;
        }

        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException(
            `AutotechDoc rejected credentials with status ${response.status}`,
          );
        }

        if (response.status === 400) {
          const body = await response.text();
          throw new BadRequestException(`AutotechDoc bad request: ${body}`);
        }

        // Retryable status: 429 or 5xx
        if (response.status === 429 || response.status >= 500) {
          const body = await response.text();
          lastError = new Error(`HTTP ${response.status} from AutotechDoc: ${body}`);
          this.logger.warn(
            `Request to ${path} failed with HTTP ${response.status} (attempt ${attempt}/${this.maxRetries})`,
          );
        } else {
          const body = await response.text();
          throw new Error(`Unexpected HTTP ${response.status} from AutotechDoc: ${body}`);
        }
      } catch (err: any) {
        clearTimeout(timer);
        if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
          throw err;
        }
        lastError = err;
        this.logger.warn(
          `Request to ${path} encountered network error: ${err.message} (attempt ${attempt}/${this.maxRetries})`,
        );
      }

      if (attempt < this.maxRetries) {
        // Exponential backoff with jitter: 2^(attempt) * 100ms + [0, 50ms)
        const delayMs = Math.pow(2, attempt) * 100 + Math.floor(Math.random() * 50);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed after ${this.maxRetries} attempts`);
  }

  async fetchManifest(): Promise<CanonicalManifestResponse> {
    return this.requestWithRetry<CanonicalManifestResponse>('/reference-data/export/manifest');
  }

  async fetchSnapshotPage<T = Record<string, unknown>>(
    entityType: CanonicalSyncEntityType,
    cursor?: string | null,
    limit = 100,
  ): Promise<CanonicalSnapshotPageResponse<T>> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestWithRetry<CanonicalSnapshotPageResponse<T>>(
      `/reference-data/export/snapshot/${entityType}${query}`,
    );
  }

  async fetchChangeFeed(
    since?: string | null,
    limit = 100,
  ): Promise<CanonicalChangeFeedResponse> {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (limit) params.set('limit', String(limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestWithRetry<CanonicalChangeFeedResponse>(
      `/reference-data/export/feed${query}`,
    );
  }

  async fetchEntity<T = Record<string, unknown>>(
    entityType: CanonicalSyncEntityType,
    id: string,
  ): Promise<T> {
    return this.requestWithRetry<T>(`/reference-data/export/entities/${entityType}/${id}`);
  }
}
