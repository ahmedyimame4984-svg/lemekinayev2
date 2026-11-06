import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { MasterDataStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../src/database/database.service.js';
import { AutotechdocSyncClient } from '../src/reference-sync/autotechdoc-sync-client.js';
import { ReferenceDataUpserter } from '../src/reference-sync/reference-data-upserter.js';
import { ReferenceSyncService, DEFAULT_CHECKPOINT_ID } from '../src/reference-sync/reference-sync.service.js';
import { SYNCHRONIZATION_ORDER } from '../src/reference-sync/reference-sync.types.js';

// Explicit disposable database only: never read DATABASE_URL as a fallback.
const url = process.env.REFERENCE_SYNC_TEST_DATABASE_URL;
describe.skipIf(!url)('ATD-07 v2 HTTP contract against consumer PostgreSQL', () => {
  let db: PrismaClient;
  let sync: ReferenceSyncService;
  let snapshotId: string;
  let watermark = '4';
  let rows: Array<{ id: string; code: string; name: string; status: string; version: number }> = [];
  let changes: any[] = [];
  let created = 0;
  let failPage = false;
  const token = 'atd_live_' + 'x'.repeat(43);
  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const contract = () => ({
    contractVersion: '2.0.0', productTypeSchemaContract: 3,
    snapshotId, through: watermark, recordCount: rows.length,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    entityTypes: [...SYNCHRONIZATION_ORDER],
  });
  const makeSync = () => new ReferenceSyncService(db as unknown as DatabaseService,
    new AutotechdocSyncClient({ baseUrl: 'https://source.test/api/v1',
      token, maxRetries: 1 }), new ReferenceDataUpserter());

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 5 }) });
    await db.$connect();
    sync = makeSync();
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, options?: RequestInit) => {
      const target = new URL(String(input));
      expect(options?.headers).toMatchObject({ Authorization: 'Bearer ' + token });
      if (target.pathname.endsWith('/reference-data/export/v2/snapshots') &&
          options?.method === 'POST') {
        created++;
        return response(contract());
      }
      const parts = target.pathname.split('/');
      const index = parts.indexOf('snapshots');
      if (index >= 0 && parts[index + 1] === snapshotId) {
        const type = parts[index + 2];
        const cursor = target.searchParams.get('cursor');
        if (failPage && type === 'Brand' && cursor) {
          failPage = false;
          return response({ code: 'TEMP_UNAVAILABLE' }, 503);
        }
        const limit = Number(target.searchParams.get('limit') ?? '100');
        const items = type === 'Brand'
          ? rows.filter(row => !cursor || row.id > cursor).slice(0, limit) : [];
        const hasMore = type === 'Brand' && items.length > 0 &&
          rows.some(row => row.id > items[items.length - 1].id);
        return response({
          contractVersion: '2.0.0', productTypeSchemaContract: 3,
          snapshotId, through: watermark, expiresAt: contract().expiresAt,
          recordCount: rows.length, entityType: type, items, hasMore,
          nextCursor: hasMore ? items[items.length - 1].id : null,
        });
      }
      if (target.pathname.endsWith('/reference-data/export/v2/changes')) {
        const after = BigInt(target.searchParams.get('after') ?? '0');
        const through = BigInt(target.searchParams.get('through') ?? '6');
        const page = changes.filter(event =>
          BigInt(event.sequence) > after && BigInt(event.sequence) <= through);
        return response({
          contractVersion: '2.0.0', productTypeSchemaContract: 3,
          through: through.toString(), changes: page, hasMore: false,
          nextCursor: page.length ? page[page.length - 1].sequence : after.toString(),
        });
      }
      return response({ error: 'unsupported v1 or unknown path' }, 404);
    }));
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db?.$disconnect(); });

  it('persists frozen bootstrap identity, exact watermark and source-managed row', async () => {
    snapshotId = randomUUID();
    const id = randomUUID();
    rows = [{ id, code: 'ATD_' + id.replaceAll('-', ''),
      name: 'ATD07 bootstrap', status: 'ACTIVE', version: 1 }];
    const result = await sync.executeSnapshot();
    expect(result.cursorAfter).toBe('4');
    expect(await db.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    })).toMatchObject({
      snapshotId, snapshotThrough: '4', feedCursor: '4', snapshotStatus: 'COMPLETED',
    });
    expect(await db.referenceSyncImportedRecord.findUnique({
      where: { entityType_entityId: { entityType: 'Brand', entityId: id } },
    })).toMatchObject({ snapshotId, active: true });
    expect((await db.brand.findUniqueOrThrow({ where: { id } })).status)
      .toBe(MasterDataStatus.ACTIVE);

    const nextId = randomUUID();
    changes = [
      { sequence: '5', entityType: 'Brand', entityId: id, operation: 'ARCHIVE',
        version: 2, recordedAt: new Date().toISOString(),
        data: { id, status: 'ARCHIVED', version: 2 } },
      { sequence: '6', entityType: 'Brand', entityId: nextId, operation: 'UPSERT',
        version: 1, recordedAt: new Date().toISOString(),
        data: { id: nextId, code: 'ATD_' + nextId.replaceAll('-', ''),
          name: 'ATD07 increment', status: 'ACTIVE', version: 1 } },
    ];
    const delta = await sync.executeIncrementalSync();
    expect(delta.processedCount).toBe(2);
    expect((await db.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    })).feedCursor).toBe('6');
    expect((await db.brand.findUniqueOrThrow({ where: { id } })).status)
      .toBe(MasterDataStatus.ARCHIVED);
    expect((await db.brand.findUniqueOrThrow({ where: { id: nextId } })).status)
      .toBe(MasterDataStatus.ACTIVE);
    expect(await db.referenceSyncImportedRecord.findUnique({
      where: { entityType_entityId: { entityType: 'Brand', entityId: id } },
    })).toMatchObject({ active: false, lastSequence: '5' });
  });

  it('resumes a crashed multi-page import at the same snapshot ID after a new worker starts', async () => {
    snapshotId = randomUUID();
    watermark = '6';
    const ids = [randomUUID(), randomUUID()].sort();
    rows = ids.map(id => ({ id, code: 'ATD_' + id.replaceAll('-', ''),
      name: 'ATD07 restart', status: 'ACTIVE', version: 1 }));
    changes = [];
    await db.referenceSyncCheckpoint.update({
      where: { id: DEFAULT_CHECKPOINT_ID },
      data: { snapshotStatus: 'NOT_STARTED', batchThrough: null },
    });
    failPage = true;
    await expect(sync.executeSnapshot({ batchSize: 1 })).rejects.toThrow();
    const pending = await db.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    });
    expect(pending).toMatchObject({ snapshotStatus: 'IN_PROGRESS', snapshotId });
    const before = created;
    sync = makeSync();
    await sync.executeSnapshot({ batchSize: 1 });
    expect(created).toBe(before);
    expect((await db.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    })).feedCursor).toBe('6');
    expect(await db.brand.count({ where: { id: { in: ids } } })).toBe(2);
  });
});
