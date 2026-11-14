import {
  BadRequestException, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutotechdocSyncClient, SnapshotExpiredError } from './autotechdoc-sync-client.js';
import { SYNCHRONIZATION_ORDER } from './reference-sync.types.js';

const token = 'atd_live_' + 'A'.repeat(43);
const ok = (body: any) => ({
  ok: true, status: 200, json: async () => body,
});
const http = (status: number) => ({
  ok: false, status, text: async () => 'unavailable',
});
const make = () => new AutotechdocSyncClient({
  baseUrl: 'https://source.example/api/v1', token, maxRetries: 2, timeoutMs: 2000,
});

describe('ATD-06 v2 HTTP contract, machine security and retry boundaries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses only the approved v2 endpoints with bearer machine credentials', async () => {
    const fetcher = vi.fn(async (_url: string, _options: any) => ok({
      snapshotId: 'id', through: '40', recordCount: 0, expiresAt: new Date().toISOString(),
      contractVersion: '2.1.0', entityTypes: [...SYNCHRONIZATION_ORDER],
    }));
    vi.stubGlobal('fetch', fetcher);
    const client = make();
    await client.createSnapshot();
    await client.fetchSnapshotPage('snapshot-id', 'Brand', 'row-id', 25);
    await client.fetchChangeFeed('40', '42', 50);
    expect(fetcher.mock.calls.map(c => c[0])).toEqual([
      'https://source.example/api/v1/reference-data/export/v2/snapshots',
      'https://source.example/api/v1/reference-data/export/v2/snapshots/snapshot-id/Brand?limit=25&cursor=row-id',
      'https://source.example/api/v1/reference-data/export/v2/changes?limit=50&after=40&through=42',
    ]);
    expect(fetcher.mock.calls[0][1].method).toBe('POST');
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
    expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer ' + token);
  });

  it('retries 429 and 503 and succeeds without resetting cursors', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(http(429))
      .mockResolvedValueOnce(http(503)).mockResolvedValueOnce(ok({ nextCursor: '17', through: '20', changes: [] }));
    vi.stubGlobal('fetch', fetcher);
    const client = new AutotechdocSyncClient({
      baseUrl: 'https://source.example/api/v1', token, maxRetries: 3,
    });
    expect((await client.fetchChangeFeed('17', '20')).nextCursor).toBe('17');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('immediately rejects revoked or improperly scoped B2B credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(http(403)));
    await expect(make().createSnapshot()).rejects.toThrow(UnauthorizedException);
  });

  it('returns a distinct snapshot-expiry signal on HTTP 410 without retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(http(410));
    vi.stubGlobal('fetch', fetcher);
    await expect(make().fetchSnapshotPage('expired-id', 'Brand')).rejects.toThrow(SnapshotExpiredError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects 400 bad requests without retrying and protects against short tokens', async () => {
    const fetcher = vi.fn().mockResolvedValue(http(400));
    vi.stubGlobal('fetch', fetcher);
    await expect(make().createSnapshot()).rejects.toThrow(BadRequestException);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const unconfigured = new AutotechdocSyncClient({ token: 'short' });
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.createSnapshot()).rejects.toThrow(ServiceUnavailableException);
  });

  it('requires HTTPS for machine keys outside loopback and rejects invalid credentials', () => {
    expect(() => new AutotechdocSyncClient({
      baseUrl: 'http://source.example/api/v1', token,
    })).toThrow(/requires HTTPS/u);
    expect(() => new AutotechdocSyncClient({
      baseUrl: 'https://source.example/api/v1?redirect=https://evil.example', token,
    })).toThrow(/clean base URL/u);
    expect(new AutotechdocSyncClient({
      baseUrl: 'http://127.0.0.1:4000/api/v1', token,
    }).isConfigured()).toBe(true);
    expect(new AutotechdocSyncClient({
      baseUrl: 'https://source.example/api/v1', token: 'x'.repeat(50),
    }).isConfigured()).toBe(false);
  });

  it('never falls back to v1 manifest, timestamp feed or /entities endpoints', () => {
    const client = make() as any;
    expect(client.fetchManifest).toBeUndefined();
    expect(client.fetchEntity).toBeUndefined();
  });
});
