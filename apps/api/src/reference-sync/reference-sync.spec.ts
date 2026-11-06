import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceSyncService, DEFAULT_CHECKPOINT_ID } from './reference-sync.service.js';
import { SnapshotExpiredError } from './autotechdoc-sync-client.js';
import { SYNCHRONIZATION_ORDER } from './reference-sync.types.js';

const expire = () => new Date(Date.now() + 3600_000).toISOString();
const snapshot = (id = 'snapshot-A', through = '12') => ({
  contractVersion: '2.0.0', productTypeSchemaContract: 3,
  snapshotId: id, through, expiresAt: expire(), recordCount: 0,
  entityTypes: [...SYNCHRONIZATION_ORDER],
});
const page = (s: ReturnType<typeof snapshot>, type: string, items: any[] = [],
  nextCursor: string | null = null) => ({
    contractVersion: '2.0.0', productTypeSchemaContract: 3,
    snapshotId: s.snapshotId, through: s.through, expiresAt: s.expiresAt,
    entityType: type, items, nextCursor, hasMore: nextCursor !== null, recordCount: 0,
});
const feed = (after: string, through = '15', changes: any[] = [], hasMore = false,
  nextCursor = changes.length ? changes[changes.length - 1].sequence : after) => ({
    contractVersion: '2.0.0', productTypeSchemaContract: 3,
    changes, nextCursor, hasMore, through,
});
const change = (sequence: string, id: string, operation: 'UPSERT' | 'ARCHIVE' = 'UPSERT') => ({
  sequence, entityType: 'Brand', entityId: id, operation, version: 1,
  recordedAt: new Date().toISOString(), data: operation === 'UPSERT'
    ? { id, code: id, name: 'Name ' + id, status: 'ACTIVE' }
    : { id, status: 'ARCHIVED', version: 2 },
});

/** Deterministic stateful database harness: exercises transaction/checkpoint API shape.
 * Disposable PostgreSQL E2E separately verifies actual transactional persistence. */
function harness() {
  const cp: any = {
    id: DEFAULT_CHECKPOINT_ID, snapshotStatus: 'NOT_STARTED', snapshotId: null,
    snapshotThrough: null, snapshotExpiresAt: null, batchThrough: null, feedCursor: null,
    scheduleEnabled: true, intervalMinutes: 5, lastSnapshotAt: null, lastIncrementalAt: null,
    lastSuccessAt: null, lastFailureAt: null, lastError: null, appliedCount: 0,
    skippedCount: 0, failedCount: 0, workerId: null, lockedUntil: null,
  };
  const entityStates = new Map<string, any>();
  const imported = new Map<string, any>();
  const local = new Map<string, any>();
  const logs: any[] = [];
  const mutate = (row: any, data: any) => {
    for (const [k, v] of Object.entries(data)) {
      row[k] = typeof v === 'object' && v !== null && 'increment' in v
        ? (row[k] ?? 0) + (v as any).increment : v;
    }
    return { ...row };
  };
  const db: any = {};
  db.$transaction = vi.fn(async (fn: (tx: any) => Promise<any>) => fn(db));
  db.referenceSyncCheckpoint = {
    findUnique: vi.fn(async () => ({ ...cp })),
    findUniqueOrThrow: vi.fn(async () => ({
      ...cp, entityStates: [...entityStates.values()],
    })),
    upsert: vi.fn(async () => ({ ...cp })),
    update: vi.fn(async ({ data }: any) => mutate(cp, data)),
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (where.OR && cp.workerId && cp.lockedUntil > new Date() &&
          cp.workerId !== data.workerId) return { count: 0 };
      if (where.workerId && where.workerId !== cp.workerId) return { count: 0 };
      if (where.lockedUntil?.gt && cp.lockedUntil <= where.lockedUntil.gt) return { count: 0 };
      mutate(cp, data);
      return { count: 1 };
    }),
  };
  db.referenceSyncEntityState = {
    findUnique: vi.fn(async ({ where }: any) =>
      entityStates.get(where.checkpointId_entityType.entityType) ?? null),
    create: vi.fn(async ({ data }: any) => {
      const value = { ...data, lastCompletedCursor: null, recordCount: 0, updatedAt: new Date() };
      entityStates.set(data.entityType, value);
      return { ...value };
    }),
    update: vi.fn(async ({ where, data }: any) =>
      mutate(entityStates.get(where.checkpointId_entityType.entityType), data)),
    deleteMany: vi.fn(async () => { entityStates.clear(); return { count: 0 }; }),
  };
  db.referenceSyncImportedRecord = {
    findMany: vi.fn(async ({ where, take }: any) => [...imported.values()]
      .filter(x => x.entityType === where.entityType && x.active &&
        x.snapshotId !== where.OR[0].snapshotId.not).slice(0, take)
      .map(x => ({ entityId: x.entityId }))),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const key = where.entityType_entityId.entityType + ':' + where.entityType_entityId.entityId;
      const next = imported.has(key) ? { ...imported.get(key), ...update } : { ...create };
      imported.set(key, next);
      return next;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const key = where.entityType_entityId.entityType + ':' + where.entityType_entityId.entityId;
      const next = { ...imported.get(key), ...data };
      imported.set(key, next);
      return next;
    }),
  };
  db.referenceSyncLog = { create: vi.fn(async ({ data }: any) => { logs.push(data); return data; }) };
  const client: any = {
    isConfigured: vi.fn(() => true),
    createSnapshot: vi.fn(async () => snapshot()),
    fetchSnapshotPage: vi.fn(async (id: string, type: string) => page(snapshot(id, cp.snapshotThrough ?? '12'), type)),
    fetchChangeFeed: vi.fn(async (after: string) => feed(after)),
  };
  const upserter: any = {
    upsertRecord: vi.fn(async (_tx: any, type: string, data: any) => {
      local.set(type + ':' + data.id, { ...data }); return 'APPLIED';
    }),
    archiveRecord: vi.fn(async (_tx: any, type: string, id: string) => {
      const key = type + ':' + id;
      if (local.has(key)) local.set(key, { ...local.get(key), status: 'ARCHIVED' });
    }),
  };
  const sync = new ReferenceSyncService(db, client, upserter);
  return { cp, db, client, sync, upserter, entityStates, imported, local, logs };
}

describe('ATD-07 v2 consumer: frozen snapshots, journal replay and recovery', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  it('preserves the configurable five-minute schedule and enforces bounds', async () => {
    expect(await h.sync.getSchedule()).toEqual({ enabled: true, intervalMinutes: 5 });
    await h.sync.updateSchedule({ enabled: true, intervalMinutes: 10 });
    expect((await h.sync.getStatus()).intervalMinutes).toBe(10);
    await expect(h.sync.updateSchedule({ enabled: true, intervalMinutes: 0 })).rejects.toThrow();
  });

  it('creates exactly one immutable snapshot and starts incremental replay at its through', async () => {
    const s = snapshot('s-initial', '27');
    h.client.createSnapshot.mockResolvedValue(s);
    h.client.fetchSnapshotPage.mockImplementation(async (_id: string, type: string) =>
      page(s, type, type === 'Brand' ? [{ id: 'b1', code: 'BMW', name: 'BMW' }] : []));
    const result = await h.sync.executeSnapshot();
    expect(result.cursorAfter).toBe('27');
    expect(h.cp.feedCursor).toBe('27');
    expect(h.cp.snapshotId).toBe('s-initial');
    expect(h.cp.snapshotStatus).toBe('COMPLETED');
    expect(h.imported.get('Brand:b1').active).toBe(true);
    expect(h.client.fetchSnapshotPage).toHaveBeenCalledTimes(SYNCHRONIZATION_ORDER.length);
  });

  it('keeps one snapshot across pages and resumes after restart without a new source snapshot', async () => {
    const s = snapshot('frozen', '9');
    h.cp.snapshotId = s.snapshotId;
    h.cp.snapshotStatus = 'IN_PROGRESS';
    h.cp.snapshotThrough = s.through;
    h.cp.snapshotExpiresAt = new Date(s.expiresAt);
    h.entityStates.set('Brand', {
      checkpointId: DEFAULT_CHECKPOINT_ID, entityType: 'Brand',
      status: 'IN_PROGRESS', recordCount: 1, lastCompletedCursor: 'b1',
    });
    h.client.fetchSnapshotPage.mockImplementation(async (id: string, type: string, cursor: string | null) => {
      expect(id).toBe('frozen');
      if (type === 'Brand') expect(cursor).toBe('b1');
      return page(s, type, type === 'Brand' ? [{ id: 'b2' }] : []);
    });
    await h.sync.executeSnapshot();
    expect(h.client.createSnapshot).not.toHaveBeenCalled();
    expect(h.cp.feedCursor).toBe('9');
    expect(h.entityStates.get('Brand').recordCount).toBe(2);
  });

  it('restarts only an expired pending snapshot when the source returns 410', async () => {
    const a = snapshot('old', '12'), b = snapshot('new', '18');
    h.client.createSnapshot.mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    h.client.fetchSnapshotPage.mockImplementation(async (id: string, type: string) => {
      if (id === 'old') throw new SnapshotExpiredError();
      return page(b, type);
    });
    await h.sync.executeSnapshot();
    expect(h.client.createSnapshot).toHaveBeenCalledTimes(2);
    expect(h.cp.snapshotId).toBe('new');
    expect(h.cp.feedCursor).toBe('18');
  });

  it('rejects incompatible Product Type versions and source entity-order changes', async () => {
    h.client.createSnapshot.mockResolvedValueOnce({ ...snapshot(), productTypeSchemaContract: 2 });
    await expect(h.sync.executeSnapshot()).rejects.toThrow(ServiceUnavailableException);
    h.client.createSnapshot.mockResolvedValueOnce({
      ...snapshot(), entityTypes: [...SYNCHRONIZATION_ORDER].reverse(),
    });
    await expect(h.sync.executeSnapshot()).rejects.toThrow(ServiceUnavailableException);
  });

  it('fails closed on a page belonging to another frozen snapshot', async () => {
    h.client.fetchSnapshotPage.mockImplementation(async (_id: string, type: string) =>
      page(snapshot('wrong', '12'), type));
    await expect(h.sync.executeSnapshot()).rejects.toThrow(ServiceUnavailableException);
    expect(h.cp.feedCursor).toBeNull();
  });

  it('archives only previously imported source records absent from a completed snapshot', async () => {
    h.imported.set('Brand:retired', {
      checkpointId: DEFAULT_CHECKPOINT_ID, entityType: 'Brand',
      entityId: 'retired', snapshotId: 'previous', active: true,
    });
    h.local.set('Brand:retired', { id: 'retired', status: 'ACTIVE' });
    await h.sync.executeSnapshot();
    expect(h.local.get('Brand:retired').status).toBe('ARCHIVED');
    expect(h.imported.get('Brand:retired').active).toBe(false);
    expect(h.upserter.archiveRecord).toHaveBeenCalledWith(h.db, 'Brand', 'retired');
  });

  it('applies committed journal changes and checkpoint atomically with a frozen through', async () => {
    h.cp.snapshotStatus = 'COMPLETED';
    h.cp.feedCursor = '12';
    h.client.fetchChangeFeed
      .mockResolvedValueOnce(feed('12', '20', [change('13', 'a')], true))
      .mockResolvedValueOnce(feed('13', '20', [change('16', 'b')]));
    const result = await h.sync.executeIncrementalSync();
    expect(h.client.fetchChangeFeed).toHaveBeenNthCalledWith(1, '12', null, 100);
    expect(h.client.fetchChangeFeed).toHaveBeenNthCalledWith(2, '13', '20', 100);
    expect(result.processedCount).toBe(2);
    expect(h.cp.feedCursor).toBe('16');
    expect(h.cp.batchThrough).toBeNull();
    expect(h.local.has('Brand:a')).toBe(true);
    expect(h.local.has('Brand:b')).toBe(true);
  });

  it('resumes a committed partial journal batch at the same through after restart', async () => {
    h.cp.snapshotStatus = 'COMPLETED';
    h.cp.feedCursor = '15';
    h.cp.batchThrough = '20';
    h.client.fetchChangeFeed.mockResolvedValue(feed('15', '20', [change('17', 'recover')]));
    await h.sync.executeIncrementalSync();
    expect(h.client.fetchChangeFeed).toHaveBeenCalledWith('15', '20', 100);
    expect(h.cp.feedCursor).toBe('17');
    expect(h.cp.batchThrough).toBeNull();
  });

  it('accepts sequence gaps for filtered legacy schemas but rejects cursor regression', async () => {
    h.cp.snapshotStatus = 'COMPLETED';
    h.cp.feedCursor = '3';
    h.client.fetchChangeFeed.mockResolvedValueOnce(feed('3', '10', [], true, '7'))
      .mockResolvedValueOnce(feed('7', '10', [], false, '7'));
    await h.sync.executeIncrementalSync();
    expect(h.cp.feedCursor).toBe('7');
    h.client.fetchChangeFeed.mockResolvedValueOnce(feed('7', '10', [], true, '7'));
    await expect(h.sync.executeIncrementalSync()).rejects.toThrow(ServiceUnavailableException);
  });

  it('does not advance checkpoint when an upsert fails within a page', async () => {
    h.cp.snapshotStatus = 'COMPLETED';
    h.cp.feedCursor = '20';
    h.client.fetchChangeFeed.mockResolvedValue(feed('20', '30', [change('21', 'bad')]));
    h.upserter.upsertRecord.mockRejectedValueOnce(new Error('foreign key unavailable'));
    await expect(h.sync.executeIncrementalSync()).rejects.toThrow('foreign key unavailable');
    expect(h.cp.feedCursor).toBe('20');
  });

  it('upserts and archives the same identity in sequence without hard deletion', async () => {
    h.cp.snapshotStatus = 'COMPLETED'; h.cp.feedCursor = '0';
    h.client.fetchChangeFeed.mockResolvedValue(feed('0', '5',
      [change('1', 'transient'), change('2', 'transient', 'ARCHIVE')]));
    await h.sync.executeIncrementalSync();
    expect(h.local.get('Brand:transient').status).toBe('ARCHIVED');
    expect(h.imported.get('Brand:transient').active).toBe(false);
  });

  it('rejects reordered or unsupported changes without advancing the cursor', async () => {
    h.cp.snapshotStatus = 'COMPLETED'; h.cp.feedCursor = '0';
    h.client.fetchChangeFeed.mockResolvedValue(feed('0', '5',
      [change('2', 'a'), change('1', 'b')], false, '2'));
    await expect(h.sync.executeIncrementalSync()).rejects.toThrow(ServiceUnavailableException);
    expect(h.cp.feedCursor).toBe('0');
  });

  it('migrates a legacy timestamp checkpoint by starting a safe fresh snapshot', async () => {
    h.cp.snapshotStatus = 'COMPLETED';
    h.cp.feedCursor = '2026-11-02T12:00:00.000Z';
    const result = await h.sync.executeIncrementalSync();
    expect(result.syncType).toBe('SNAPSHOT');
    expect(h.cp.feedCursor).toBe('12');
    expect(h.client.fetchChangeFeed).not.toHaveBeenCalled();
  });

  it('refuses overlapping workers and prevents a stale worker from releasing the lease', async () => {
    h.cp.lockedUntil = new Date(Date.now() + 3600_000);
    h.cp.workerId = 'another-worker';
    await expect(h.sync.executeIncrementalSync()).rejects.toThrow(ConflictException);
    await h.sync.releaseLock('stale-worker');
    expect(h.cp.workerId).toBe('another-worker');
  });

  it('performs reconciliation with a fresh frozen snapshot, not a v1 manifest', async () => {
    h.cp.snapshotStatus = 'COMPLETED'; h.cp.feedCursor = '9';
    const result = await h.sync.executeReconciliation();
    expect(result.reconciledEntities.Brand.remoteCount).toBe(0);
    expect(h.client.createSnapshot).toHaveBeenCalledTimes(1);
    expect(h.cp.feedCursor).toBe('12');
  });
});
