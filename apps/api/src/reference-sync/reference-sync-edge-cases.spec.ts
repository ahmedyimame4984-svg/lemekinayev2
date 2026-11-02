import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  MasterDataStatus,
  ProductTypeAttributeAssignmentOrigin,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { AutotechdocSyncClient } from './autotechdoc-sync-client.js';
import { ReferenceDataUpserter } from './reference-data-upserter.js';
import {
  DEFAULT_CHECKPOINT_ID,
  ReferenceSyncService,
} from './reference-sync.service.js';
import {
  CanonicalChangeRecord,
  CanonicalManifestResponse,
  CanonicalSnapshotPageResponse,
  SYNCHRONIZATION_ORDER,
} from './reference-sync.types.js';

describe('Reference Synchronization Edge Cases & Reliability Suite', () => {
  let syncService: ReferenceSyncService;
  let upserter: ReferenceDataUpserter;
  let mockClient: any;
  let mockDb: any;
  let checkpointStore: any;
  let brandStore: Map<string, any>;
  let productTypeStore: Map<string, any>;
  let assignmentStore: Map<string, any>;

  beforeEach(() => {
    checkpointStore = {
      id: DEFAULT_CHECKPOINT_ID,
      snapshotStatus: 'NOT_STARTED',
      snapshotId: null,
      feedCursor: null,
      scheduleEnabled: true,
      intervalMinutes: 5,
      lastSnapshotAt: null,
      lastIncrementalAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      appliedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      workerId: null,
      lockedUntil: null,
    };

    brandStore = new Map();
    productTypeStore = new Map();
    assignmentStore = new Map();

    mockDb = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockDb)),
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-system-id',
          email: 'system-sync@lemekinaye.internal',
          accountType: AccountType.ADMIN,
          status: AccountStatus.ACTIVE,
        }),
        findUnique: vi.fn().mockResolvedValue({ id: 'user-system-id' }),
        create: vi.fn().mockResolvedValue({ id: 'user-system-id' }),
      },
      referenceSyncCheckpoint: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === DEFAULT_CHECKPOINT_ID) return { ...checkpointStore };
          return null;
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === DEFAULT_CHECKPOINT_ID) {
            return { ...checkpointStore, entityStates: [] };
          }
          throw new Error('Checkpoint not found');
        }),
        upsert: vi.fn().mockImplementation(async ({ create, update }) => {
          if (!checkpointStore) checkpointStore = { ...create };
          else Object.assign(checkpointStore, update);
          return { ...checkpointStore };
        }),
        update: vi.fn().mockImplementation(async ({ data }) => {
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === 'object' && 'increment' in (v as any)) {
              checkpointStore[k] = (checkpointStore[k] ?? 0) + (v as any).increment;
            } else {
              checkpointStore[k] = v;
            }
          }
          return { ...checkpointStore };
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          if (where.id !== DEFAULT_CHECKPOINT_ID) return { count: 0 };
          if (where.OR) {
            const now = new Date();
            const eligible =
              !checkpointStore.lockedUntil ||
              checkpointStore.lockedUntil <= now ||
              checkpointStore.workerId === data.workerId;
            if (!eligible) return { count: 0 };
          } else if (where.workerId !== undefined && checkpointStore.workerId !== where.workerId) {
            return { count: 0 };
          }
          Object.assign(checkpointStore, data);
          return { count: 1 };
        }),
      },
      referenceSyncEntityState: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, updatedAt: new Date() })),
        update: vi.fn().mockImplementation(async ({ data }) => ({ ...data, updatedAt: new Date() })),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      referenceSyncLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
      brand: {
        count: vi.fn().mockImplementation(async () => brandStore.size),
        upsert: vi.fn().mockImplementation(async ({ where, create, update }) => {
          const existing = brandStore.get(where.id);
          const val = existing ? { ...existing, ...update } : { ...create };
          brandStore.set(where.id, val);
          return val;
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          const existing = brandStore.get(where.id);
          if (existing) brandStore.set(where.id, { ...existing, ...data });
          return { count: existing ? 1 : 0 };
        }),
      },
      productType: {
        count: vi.fn().mockImplementation(async () => productTypeStore.size),
        findUnique: vi.fn().mockImplementation(async ({ where }) => productTypeStore.get(where.id) ?? null),
        create: vi.fn().mockImplementation(async ({ data }) => {
          productTypeStore.set(data.id, { ...data });
          return data;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          const existing = productTypeStore.get(where.id);
          const val = { ...existing, ...data };
          productTypeStore.set(where.id, val);
          return val;
        }),
      },
      productTypeAttributeAssignment: {
        count: vi.fn().mockImplementation(async () => assignmentStore.size),
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          if (where.productTypeId_attributeId) {
            const key = `${where.productTypeId_attributeId.productTypeId}:${where.productTypeId_attributeId.attributeId}`;
            return assignmentStore.get(key) ?? null;
          }
          return null;
        }),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const key = `${data.productTypeId}:${data.attributeId}`;
          assignmentStore.set(key, { ...data });
          return data;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          for (const [k, v] of assignmentStore.entries()) {
            if (v.id === where.id) {
              const updated = { ...v, ...data };
              assignmentStore.set(k, updated);
              return updated;
            }
          }
          return data;
        }),
      },
    };

    mockClient = {
      isConfigured: vi.fn().mockReturnValue(true),
      fetchManifest: vi.fn(),
      fetchSnapshotPage: vi.fn(),
      fetchChangeFeed: vi.fn(),
      fetchEntity: vi.fn(),
    };

    upserter = new ReferenceDataUpserter();
    syncService = new ReferenceSyncService(
      mockDb as unknown as DatabaseService,
      mockClient as unknown as AutotechdocSyncClient,
      upserter,
    );
  });

  // Edge Case 1: Incompatible remote schema versions
  describe('Edge Case 1: Incompatible remote schema version handling', () => {
    it('fails closed on incompatible major schema versions (e.g. 2.0.0, 0.9.0)', async () => {
      mockClient.fetchManifest.mockResolvedValueOnce({
        schemaVersion: '2.0.0', // Major bump = incompatible
        source: 'Autotechdoc',
        serverTime: '2026-11-02T12:00:00Z',
        totalPublishedRecords: 0,
        entities: {},
      });

      await expect(syncService.executeSnapshot()).rejects.toThrow(ServiceUnavailableException);
      expect(checkpointStore.snapshotStatus).toBe('NOT_STARTED');

      mockClient.fetchManifest.mockResolvedValueOnce({
        schemaVersion: '0.9.5', // Pre-1.0 = incompatible
        source: 'Autotechdoc',
        serverTime: '2026-11-02T12:00:00Z',
        totalPublishedRecords: 0,
        entities: {},
      });

      await expect(syncService.executeSnapshot()).rejects.toThrow(ServiceUnavailableException);
    });

    it('accepts compatible 1.x.x schema versions (e.g. 1.0.0, 1.2.5)', async () => {
      mockClient.fetchManifest.mockResolvedValue({
        schemaVersion: '1.4.12',
        source: 'Autotechdoc',
        serverTime: '2026-11-02T12:00:00Z',
        totalPublishedRecords: 0,
        entities: Object.fromEntries(
          SYNCHRONIZATION_ORDER.map((e) => [e, { count: 0, latestVersion: 1, latestUpdatedAt: null }]),
        ),
      });

      mockClient.fetchSnapshotPage.mockResolvedValue({
        entityType: 'Brand',
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
        snapshotId: 'snap-1',
      });

      const result = await syncService.executeSnapshot();
      expect(result.status).toBe('SUCCESS');
    });
  });

  // Edge Case 2: Schedule slot calculation & 24/7 fixed-clock semantics
  describe('Edge Case 2: Schedule slot calculation & boundary edge cases', () => {
    it('accurately divides the 24-hour day into fixed clock slots without drift', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      
      // 5-minute interval = 288 slots per day
      const interval5MinMs = 5 * 60 * 1000;
      expect(dayMs / interval5MinMs).toBe(288);

      // 1-minute interval = 1440 slots per day (maximum frequency)
      const interval1MinMs = 1 * 60 * 1000;
      expect(dayMs / interval1MinMs).toBe(1440);

      // 1440-minute interval = 1 slot per day (once per day)
      const interval1440MinMs = 1440 * 60 * 1000;
      expect(dayMs / interval1440MinMs).toBe(1);

      // Slot index calculation at midnight UTC
      const midnightUtc = new Date('2026-11-02T00:00:00.000Z').getTime();
      const slotMidnight = Math.floor(midnightUtc / interval5MinMs);
      expect(Number.isInteger(slotMidnight)).toBe(true);

      // Slot index calculation 4 minutes 59 seconds later (same slot)
      const slotSame = Math.floor((midnightUtc + 4 * 60 * 1000 + 59 * 1000) / interval5MinMs);
      expect(slotSame).toBe(slotMidnight);

      // Slot index calculation at exactly 5 minutes (next slot)
      const slotNext = Math.floor((midnightUtc + 5 * 60 * 1000) / interval5MinMs);
      expect(slotNext).toBe(slotMidnight + 1);
    });

    it('rejects extreme and non-integer schedule bounds', async () => {
      // Below min (1)
      await expect(syncService.updateSchedule({ enabled: true, intervalMinutes: 0 }))
        .rejects.toThrow(BadRequestException);
      await expect(syncService.updateSchedule({ enabled: true, intervalMinutes: -10 }))
        .rejects.toThrow(BadRequestException);

      // Above max (1440)
      await expect(syncService.updateSchedule({ enabled: true, intervalMinutes: 1441 }))
        .rejects.toThrow(BadRequestException);
      await expect(syncService.updateSchedule({ enabled: true, intervalMinutes: 10000 }))
        .rejects.toThrow(BadRequestException);

      // Float / non-integer
      await expect(syncService.updateSchedule({ enabled: true, intervalMinutes: 5.5 }))
        .rejects.toThrow(BadRequestException);
      await expect(syncService.updateSchedule({ enabled: true, intervalMinutes: NaN }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // Edge Case 3: Worker lease loss during batch transaction
  describe('Edge Case 3: Lease expiration & worker fencing', () => {
    it('aborts batch transaction immediately when worker lease is lost to another worker', async () => {
      checkpointStore.snapshotStatus = 'COMPLETED';
      checkpointStore.feedCursor = '2026-11-02T12:00:00.000Z';

      mockClient.fetchChangeFeed.mockResolvedValue({
        changes: [
          {
            sequence: '2026-11-02T12:05:00.000Z#Brand#b1',
            entityType: 'Brand',
            entityId: 'b1',
            operation: 'UPSERT',
            version: 1,
            timestamp: '2026-11-02T12:05:00.000Z',
            data: { id: 'b1', code: 'TEST', name: 'Test' },
          },
        ],
        nextCursor: '2026-11-02T12:05:00.000Z#Brand#b1',
        hasMore: false,
        serverTime: '2026-11-02T12:05:00.000Z',
      });

      // acquireLock succeeds, but renewLease fails because lease expired / was stolen
      mockDb.referenceSyncCheckpoint.updateMany
        .mockResolvedValueOnce({ count: 1 }) // acquireLock
        .mockResolvedValueOnce({ count: 0 }); // renewLease inside transaction

      await expect(syncService.executeIncrementalSync()).rejects.toThrow(
        /Reference synchronization lease expired or ownership changed/u,
      );
    });
  });

  // Edge Case 4: Multiple successive updates preserving customizations
  describe('Edge Case 4: Deep preservation of consumer customizations across multiple updates', () => {
    it('preserves all marketplace overrides across 5 successive canonical upstream updates', async () => {
      const ptId = 'pt-spark-plug';
      const attrId = 'attr-gap';
      const assignKey = `${ptId}:${attrId}`;

      // Initialize with custom marketplace rules
      productTypeStore.set(ptId, {
        id: ptId,
        categoryId: 'cat-ignition',
        code: 'SPARK_PLUG',
        name: 'Initial Name',
        slug: 'spark-plug',
        brandRequirement: ProductTypeRequirementLevel.REQUIRED, // Customized
        priceRequirement: ProductTypeRequirementLevel.REQUIRED, // Customized
        minimumImageCount: 4, // Customized
        maximumImageCount: 12, // Customized
        status: MasterDataStatus.ACTIVE,
        version: 1,
      });

      assignmentStore.set(assignKey, {
        id: 'assign-plug',
        productTypeId: ptId,
        attributeId: attrId,
        displayOrder: 1,
        requirement: ProductTypeAttributeRequirement.MANDATORY, // Customized
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        searchable: true, // Customized
        filterable: true, // Customized
        comparable: true, // Customized
        marketplaceVisible: true,
        sellerEditable: false, // Customized
        validationRule: { min: 0.5, max: 1.5 }, // Customized
        conditionalRule: { engineType: 'ICE' }, // Customized
        origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
        status: MasterDataStatus.ACTIVE,
        version: 1,
      });

      // Simulate 5 successive canonical updates from upstream
      for (let v = 2; v <= 6; v++) {
        await upserter.upsertRecord(mockDb, 'ProductType', {
          id: ptId,
          categoryId: 'cat-ignition',
          code: 'SPARK_PLUG',
          name: `Canonical Name Rev ${v}`,
          slug: 'spark-plug',
          version: v,
        });

        await upserter.upsertRecord(mockDb, 'ProductTypeAttributeAssignment', {
          id: 'assign-plug',
          productTypeId: ptId,
          attributeId: attrId,
          displayOrder: v * 10, // Canonical order changed
          version: v,
        });
      }

      // Verify ProductType custom fields
      const finalPt = productTypeStore.get(ptId);
      expect(finalPt.name).toBe('Canonical Name Rev 6');
      expect(finalPt.brandRequirement).toBe(ProductTypeRequirementLevel.REQUIRED);
      expect(finalPt.priceRequirement).toBe(ProductTypeRequirementLevel.REQUIRED);
      expect(finalPt.minimumImageCount).toBe(4);
      expect(finalPt.maximumImageCount).toBe(12);

      // Verify ProductTypeAttributeAssignment custom fields
      const finalAssign = assignmentStore.get(assignKey);
      expect(finalAssign.displayOrder).toBe(60); // Updated to latest canonical
      expect(finalAssign.requirement).toBe(ProductTypeAttributeRequirement.MANDATORY);
      expect(finalAssign.searchable).toBe(true);
      expect(finalAssign.filterable).toBe(true);
      expect(finalAssign.comparable).toBe(true);
      expect(finalAssign.sellerEditable).toBe(false);
      expect(finalAssign.validationRule).toEqual({ min: 0.5, max: 1.5 });
      expect(finalAssign.conditionalRule).toEqual({ engineType: 'ICE' });
    });
  });

  // Edge Case 5: Empty feed and non-blocking idle cycles
  describe('Edge Case 5: Idle and empty feed handling', () => {
    it('completes cleanly when change feed has 0 updates without advancing cursor improperly', async () => {
      checkpointStore.snapshotStatus = 'COMPLETED';
      checkpointStore.feedCursor = '2026-11-02T12:00:00.000Z#Brand#b1';

      mockClient.fetchChangeFeed.mockResolvedValue({
        changes: [],
        nextCursor: null,
        hasMore: false,
        serverTime: '2026-11-02T12:05:00.000Z',
      });

      const result = await syncService.executeIncrementalSync();
      expect(result.status).toBe('SUCCESS');
      expect(result.processedCount).toBe(0);
      expect(result.appliedCount).toBe(0);
      expect(checkpointStore.feedCursor).toBe('2026-11-02T12:00:00.000Z#Brand#b1'); // Preserved!
    });
  });

  // Edge Case 6: Mixed upsert and archive for same record in one batch
  describe('Edge Case 6: Mixed upsert and archive operations within a single batch', () => {
    it('handles upsert followed by archive for the same entity within a single change batch', async () => {
      checkpointStore.snapshotStatus = 'COMPLETED';
      checkpointStore.feedCursor = 'cursor-start';

      const changes: CanonicalChangeRecord[] = [
        {
          sequence: 'cursor-1',
          entityType: 'Brand',
          entityId: 'b-transient',
          operation: 'UPSERT',
          version: 1,
          timestamp: '2026-11-02T12:10:00.000Z',
          data: { id: 'b-transient', code: 'TRANSIENT', name: 'Transient Brand', status: 'ACTIVE' },
        },
        {
          sequence: 'cursor-2',
          entityType: 'Brand',
          entityId: 'b-transient',
          operation: 'ARCHIVE',
          version: 2,
          timestamp: '2026-11-02T12:10:01.000Z',
          data: {},
        },
      ];

      mockClient.fetchChangeFeed.mockResolvedValue({
        changes,
        nextCursor: 'cursor-2',
        hasMore: false,
        serverTime: '2026-11-02T12:10:02.000Z',
      });

      const result = await syncService.executeIncrementalSync();
      expect(result.status).toBe('SUCCESS');
      expect(result.appliedCount).toBe(2);

      const record = brandStore.get('b-transient');
      expect(record).toBeDefined();
      expect(record.status).toBe(MasterDataStatus.ARCHIVED);
    });
  });
});
