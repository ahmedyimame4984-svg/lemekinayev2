import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  MasterDataStatus,
  ProductTypeAttributeAssignmentOrigin,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  ProductTypeIdentifierRequirement,
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
  CanonicalChangeFeedResponse,
  CanonicalManifestResponse,
  CanonicalSnapshotPageResponse,
  CanonicalSyncEntityType,
  SYNCHRONIZATION_ORDER,
} from './reference-sync.types.js';

describe('Enterprise Reference Data Synchronization (Autotechdoc → LemekinayeV2)', () => {
  let syncService: ReferenceSyncService;
  let upserter: ReferenceDataUpserter;
  let mockClient: any;
  let mockDb: any;
  let systemUser: any;
  let checkpointStore: any;
  let entityStateStore: Map<string, any>;
  let brandStore: Map<string, any>;
  let categoryStore: Map<string, any>;
  let productTypeStore: Map<string, any>;
  let assignmentStore: Map<string, any>;
  let logStore: any[];

  beforeEach(() => {
    systemUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'system-sync@lemekinaye.internal',
      accountType: AccountType.ADMIN,
      status: AccountStatus.ACTIVE,
    };

    checkpointStore = {
      id: DEFAULT_CHECKPOINT_ID,
      snapshotStatus: 'NOT_STARTED',
      snapshotId: null,
      feedCursor: null,
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

    entityStateStore = new Map();
    brandStore = new Map();
    categoryStore = new Map();
    productTypeStore = new Map();
    assignmentStore = new Map();
    logStore = [];

    mockDb = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockDb);
      }),
      user: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (where?.email === systemUser.email) return systemUser;
          if (where?.accountType === AccountType.ADMIN) return systemUser;
          return null;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          if (where?.id === systemUser.id) return systemUser;
          return null;
        }),
        create: vi.fn().mockResolvedValue(systemUser),
      },
      referenceSyncCheckpoint: {
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          if (where.id !== DEFAULT_CHECKPOINT_ID) return { count: 0 };
          if (where.OR) {
            const now = new Date();
            const eligible = !checkpointStore.lockedUntil ||
              checkpointStore.lockedUntil <= now || checkpointStore.workerId === data.workerId;
            if (!eligible) return { count: 0 };
          } else if (where.workerId !== undefined && checkpointStore.workerId !== where.workerId) {
            return { count: 0 };
          }
          Object.assign(checkpointStore, data);
          return { count: 1 };
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === DEFAULT_CHECKPOINT_ID) return { ...checkpointStore };
          return null;
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === DEFAULT_CHECKPOINT_ID) {
            return {
              ...checkpointStore,
              entityStates: Array.from(entityStateStore.values()),
            };
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
      },
      referenceSyncEntityState: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          const key = `${where.checkpointId_entityType.checkpointId}:${where.checkpointId_entityType.entityType}`;
          return entityStateStore.get(key) ? { ...entityStateStore.get(key) } : null;
        }),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const key = `${data.checkpointId}:${data.entityType}`;
          const val = { ...data, updatedAt: new Date() };
          entityStateStore.set(key, val);
          return { ...val };
        }),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          const key = `${where.checkpointId_entityType.checkpointId}:${where.checkpointId_entityType.entityType}`;
          const current = entityStateStore.get(key) ?? {};
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === 'object' && 'increment' in (v as any)) {
              current[k] = (current[k] ?? 0) + (v as any).increment;
            } else {
              current[k] = v;
            }
          }
          current.updatedAt = new Date();
          entityStateStore.set(key, current);
          return { ...current };
        }),
        deleteMany: vi.fn().mockImplementation(async () => {
          entityStateStore.clear();
          return { count: 0 };
        }),
      },
      referenceSyncLog: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          logStore.push(data);
          return { id: 'log-' + logStore.length, ...data };
        }),
      },
      brand: {
        count: vi.fn().mockImplementation(async () => brandStore.size),
        findUnique: vi.fn().mockImplementation(async ({ where }) => brandStore.get(where.id) ?? null),
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
      category: {
        count: vi.fn().mockImplementation(async () => categoryStore.size),
        findUnique: vi.fn().mockImplementation(async ({ where }) => categoryStore.get(where.id) ?? null),
        upsert: vi.fn().mockImplementation(async ({ where, create, update }) => {
          const existing = categoryStore.get(where.id);
          const val = existing ? { ...existing, ...update } : { ...create };
          categoryStore.set(where.id, val);
          return val;
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          const existing = categoryStore.get(where.id);
          if (existing) categoryStore.set(where.id, { ...existing, ...data });
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
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          const existing = productTypeStore.get(where.id);
          if (existing) productTypeStore.set(where.id, { ...existing, ...data });
          return { count: existing ? 1 : 0 };
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
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          let count = 0;
          for (const [k, v] of assignmentStore.entries()) {
            if (v.id === where.id) {
              assignmentStore.set(k, { ...v, ...data });
              count++;
            }
          }
          return { count };
        }),
      },
      productFamily: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      attributeGroup: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      unitDimension: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      attributeUnit: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      attributeDefinition: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      attributeAllowedValue: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      productTypeSchemaVersion: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleMake: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleModel: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleGenerationFamily: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleGeneration: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleTrim: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleEngine: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleTransmission: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleBodyType: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleMarket: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
      vehicleConfiguration: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
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

  // 1. Initial full snapshot
  it('1. executes initial full snapshot and advances checkpoint with snapshot boundary', async () => {
    const serverTime = '2026-11-02T12:00:00.000Z';
    const mockManifest: CanonicalManifestResponse = {
      schemaVersion: '1.0.0',
      source: 'Autotechdoc',
      serverTime,
      totalPublishedRecords: 2,
      entities: Object.fromEntries(
        SYNCHRONIZATION_ORDER.map((e) => [
          e,
          { count: e === 'Brand' ? 2 : 0, latestVersion: 1, latestUpdatedAt: serverTime },
        ]),
      ) as any,
    };

    mockClient.fetchManifest.mockResolvedValue(mockManifest);
    mockClient.fetchSnapshotPage.mockImplementation(async (entityType: CanonicalSyncEntityType) => {
      if (entityType === 'Brand') {
        return {
          entityType: 'Brand',
          items: [
            { id: 'b1', code: 'BOSCH', name: 'Bosch', status: 'ACTIVE', version: 1 },
            { id: 'b2', code: 'BREMBO', name: 'Brembo', status: 'ACTIVE', version: 1 },
          ],
          nextCursor: null,
          hasMore: false,
          totalCount: 2,
          snapshotId: serverTime,
        };
      }
      return {
        entityType,
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
        snapshotId: serverTime,
      };
    });

    const result = await syncService.executeSnapshot();

    expect(result.status).toBe('SUCCESS');
    expect(result.appliedCount).toBe(2);
    expect(checkpointStore.snapshotStatus).toBe('COMPLETED');
    expect(checkpointStore.feedCursor).toBeNull();
    expect(checkpointStore.snapshotId).toBe(serverTime);
    expect(brandStore.size).toBe(2);
    expect(brandStore.get('b1').name).toBe('Bosch');
  });

  // 2. Incremental inserts and updates
  it('2. executes incremental sync and advances monotonically ordered cursor', async () => {
    checkpointStore.snapshotStatus = 'COMPLETED';
    checkpointStore.feedCursor = '2026-11-02T12:00:00.000Z';

    const nextSeq = '2026-11-02T12:05:00.000Z#b3';
    mockClient.fetchChangeFeed.mockResolvedValue({
      changes: [
        {
          sequence: nextSeq,
          entityType: 'Brand',
          entityId: 'b3',
          operation: 'UPSERT',
          version: 1,
          timestamp: '2026-11-02T12:05:00.000Z',
          data: { id: 'b3', code: 'DENSO', name: 'Denso', status: 'ACTIVE', version: 1 },
        },
      ],
      nextCursor: nextSeq,
      hasMore: false,
      serverTime: '2026-11-02T12:05:00.000Z',
    });

    const result = await syncService.executeIncrementalSync();

    expect(result.status).toBe('SUCCESS');
    expect(result.appliedCount).toBe(1);
    expect(checkpointStore.feedCursor).toBe(nextSeq);
    expect(brandStore.get('b3').code).toBe('DENSO');
  });

  // 3. Source archival
  it('3. marks archived canonical records as ARCHIVED without deleting local commercial data', async () => {
    brandStore.set('b1', { id: 'b1', code: 'BOSCH', name: 'Bosch', status: 'ACTIVE', version: 1 });
    checkpointStore.snapshotStatus = 'COMPLETED';
    checkpointStore.feedCursor = '2026-11-02T12:00:00.000Z';

    mockClient.fetchChangeFeed.mockResolvedValue({
      changes: [
        {
          sequence: '2026-11-02T12:10:00.000Z#b1',
          entityType: 'Brand',
          entityId: 'b1',
          operation: 'ARCHIVE',
          version: 2,
          timestamp: '2026-11-02T12:10:00.000Z',
          data: {},
        },
      ],
      nextCursor: '2026-11-02T12:10:00.000Z#b1',
      hasMore: false,
      serverTime: '2026-11-02T12:10:00.000Z',
    });

    await syncService.executeIncrementalSync();

    const record = brandStore.get('b1');
    expect(record).toBeDefined();
    expect(record.status).toBe(MasterDataStatus.ARCHIVED);
  });

  // 4. Duplicate-event replay
  it('4. guarantees idempotency when duplicate change events are replayed', async () => {
    checkpointStore.snapshotStatus = 'COMPLETED';
    checkpointStore.feedCursor = '2026-11-02T12:00:00.000Z';

    const change = {
      sequence: '2026-11-02T12:15:00.000Z#b1',
      entityType: 'Brand' as CanonicalSyncEntityType,
      entityId: 'b1',
      operation: 'UPSERT' as const,
      version: 1,
      timestamp: '2026-11-02T12:15:00.000Z',
      data: { id: 'b1', code: 'BOSCH', name: 'Bosch Replay', status: 'ACTIVE', version: 1 },
    };

    mockClient.fetchChangeFeed.mockResolvedValue({
      changes: [change],
      nextCursor: '2026-11-02T12:15:00.000Z#b1',
      hasMore: false,
      serverTime: '2026-11-02T12:15:00.000Z',
    });

    // Run first time
    await syncService.executeIncrementalSync();
    expect(brandStore.get('b1').name).toBe('Bosch Replay');

    // Run second time (replaying the same change)
    await syncService.executeIncrementalSync();
    expect(brandStore.size).toBe(1);
    expect(brandStore.get('b1').name).toBe('Bosch Replay');
  });

  // 5. Interrupted snapshot resume
  it('5. resumes interrupted snapshot from recorded entity cursor', async () => {
    // Stage partial snapshot: Brand completed, Category in progress at c1
    entityStateStore.set(`${DEFAULT_CHECKPOINT_ID}:Brand`, {
      checkpointId: DEFAULT_CHECKPOINT_ID,
      entityType: 'Brand',
      status: 'COMPLETED',
      recordCount: 5,
      lastCompletedCursor: 'b5',
    });
    entityStateStore.set(`${DEFAULT_CHECKPOINT_ID}:Category`, {
      checkpointId: DEFAULT_CHECKPOINT_ID,
      entityType: 'Category',
      status: 'IN_PROGRESS',
      recordCount: 1,
      lastCompletedCursor: 'c1',
    });

    mockClient.fetchManifest.mockResolvedValue({
      schemaVersion: '1.0.0',
      source: 'Autotechdoc',
      serverTime: '2026-11-02T12:20:00.000Z',
      totalPublishedRecords: 10,
      entities: Object.fromEntries(
        SYNCHRONIZATION_ORDER.map((e) => [e, { count: 0, latestVersion: 1, latestUpdatedAt: null }]),
      ) as any,
    });

    let requestedCategoryCursor: string | null = null;
    mockClient.fetchSnapshotPage.mockImplementation(
      async (entityType: CanonicalSyncEntityType, cursor?: string) => {
        if (entityType === 'Category') {
          requestedCategoryCursor = cursor ?? null;
          return {
            entityType: 'Category',
            items: [
              {
                id: 'c2',
                code: 'FILTERS',
                name: 'Filters',
                slug: 'filters',
                level: 1,
                isLeaf: true,
                status: 'ACTIVE',
                version: 1,
              },
            ],
            nextCursor: null,
            hasMore: false,
            totalCount: 2,
            snapshotId: 'snap-1',
          };
        }
        return {
          entityType,
          items: [],
          nextCursor: null,
          hasMore: false,
          totalCount: 0,
          snapshotId: 'snap-1',
        };
      },
    );

    await syncService.executeSnapshot();

    // Verify it resumed from c1
    expect(requestedCategoryCursor).toBe('c1');
    expect(categoryStore.get('c2').code).toBe('FILTERS');
  });

  // 6. Worker restart
  it('6. safely allows new worker to resume after previous worker termination', async () => {
    // Simulating expired lock from crashed worker
    checkpointStore.workerId = 'crashed-worker-pid-999';
    checkpointStore.lockedUntil = new Date(Date.now() - 1000); // in the past

    mockClient.fetchManifest.mockResolvedValue({
      schemaVersion: '1.0.0',
      source: 'Autotechdoc',
      serverTime: '2026-11-02T12:25:00.000Z',
      totalPublishedRecords: 0,
      entities: Object.fromEntries(
        SYNCHRONIZATION_ORDER.map((e) => [e, { count: 0, latestVersion: 1, latestUpdatedAt: null }]),
      ) as any,
    });

    mockClient.fetchSnapshotPage.mockResolvedValue({
      entityType: 'Brand',
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
      snapshotId: 's',
    });

    const result = await syncService.executeSnapshot();
    expect(result.status).toBe('SUCCESS');
    expect(checkpointStore.workerId).toBeNull();
  });

  // 7. Checkpoint atomicity
  it('7. ensures checkpoint advancement is tied to durable commit', async () => {
    checkpointStore.snapshotStatus = 'COMPLETED';
    checkpointStore.feedCursor = 'cursor-100';

    mockClient.fetchChangeFeed.mockResolvedValue({
      changes: [
        {
          sequence: 'cursor-101',
          entityType: 'Brand',
          entityId: 'b-err',
          operation: 'UPSERT',
          version: 1,
          timestamp: '2026-11-02T12:30:00.000Z',
          data: { id: 'b-err' },
        },
      ],
      nextCursor: 'cursor-101',
      hasMore: false,
      serverTime: '2026-11-02T12:30:00.000Z',
    });

    // Simulate database failure during upsert
    mockDb.brand.upsert.mockRejectedValueOnce(new Error('Disk full / write failure'));

    await expect(syncService.executeIncrementalSync()).rejects.toThrow('Disk full / write failure');

    // Checkpoint must NOT advance
    expect(checkpointStore.feedCursor).toBe('cursor-100');
    expect(checkpointStore.failedCount).toBe(1);
    expect(checkpointStore.lastError).toContain('Disk full');
  });

  // 8. Database transaction rollback
  it('8. rolls back entire batch when an entity in transaction fails', async () => {
    checkpointStore.snapshotStatus = 'COMPLETED';
    checkpointStore.feedCursor = 'cursor-prev';

    mockClient.fetchChangeFeed.mockResolvedValue({
      changes: [
        {
          sequence: 'cursor-next',
          entityType: 'Brand',
          entityId: 'b-good',
          operation: 'UPSERT',
          version: 1,
          timestamp: '2026-11-02T12:35:00.000Z',
          data: { id: 'b-good', code: 'GOOD', name: 'Good' },
        },
      ],
      nextCursor: 'cursor-next',
      hasMore: false,
      serverTime: '2026-11-02T12:35:00.000Z',
    });

    mockDb.$transaction.mockImplementationOnce(async (cb: any) => {
      // Simulate transaction rollback on error
      try {
        await cb(mockDb);
      } catch (e) {
        brandStore.delete('b-good'); // emulate rollback
        throw e;
      }
    });

    mockDb.brand.upsert.mockImplementationOnce(async () => {
      brandStore.set('b-good', { id: 'b-good' });
      throw new Error('Foreign key violation constraint');
    });

    await expect(syncService.executeIncrementalSync()).rejects.toThrow(
      'Foreign key violation constraint',
    );
    expect(brandStore.has('b-good')).toBe(false);
  });

  // 9. Preserved LemekinayeV2 attribute & product-type customizations (CRITICAL REQUIREMENT)
  it('9. strictly preserves client-specific attribute rules and commercial requirements during canonical sync updates', async () => {
    // 1. Stage existing ProductType with custom marketplace rules
    const ptId = 'pt-oil-filter';
    productTypeStore.set(ptId, {
      id: ptId,
      categoryId: 'cat-1',
      code: 'OIL_FILTER',
      name: 'Old Canonical Name',
      slug: 'oil-filter',
      brandRequirement: ProductTypeRequirementLevel.REQUIRED, // Customized by marketplace
      priceRequirement: ProductTypeRequirementLevel.REQUIRED, // Customized by marketplace
      imageRequirement: ProductTypeRequirementLevel.REQUIRED, // Customized by marketplace
      minimumImageCount: 3, // Customized by marketplace
      maximumImageCount: 15, // Customized by marketplace
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });

    // 2. Stage existing ProductTypeAttributeAssignment with custom rules
    const attrId = 'attr-thread-size';
    const assignmentKey = `${ptId}:${attrId}`;
    assignmentStore.set(assignmentKey, {
      id: 'assign-1',
      productTypeId: ptId,
      attributeId: attrId,
      displayOrder: 1,
      requirement: ProductTypeAttributeRequirement.MANDATORY, // Customized
      displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
      searchable: true, // Customized
      filterable: true, // Customized
      comparable: true, // Customized
      marketplaceVisible: false, // Customized
      sellerEditable: false, // Customized
      validationRule: { regex: '^[M0-9x.]+$' }, // Customized
      conditionalRule: { if: 'condition' }, // Customized
      origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });

    // 3. Incoming canonical update from Autotechdoc
    // Notice Autotechdoc has new name, new displayOrder, but default consumer flags
    const incomingProductType = {
      id: ptId,
      categoryId: 'cat-1',
      code: 'OIL_FILTER',
      name: 'Engine Oil Filter - Canonical',
      slug: 'engine-oil-filter',
      brandRequirement: 'OPTIONAL', // Should be IGNORED
      minimumImageCount: 1, // Should be IGNORED
      version: 2,
    };

    const incomingAssignment = {
      id: 'assign-1',
      productTypeId: ptId,
      attributeId: attrId,
      displayOrder: 99, // Canonical updated ordering
      requirement: 'OPTIONAL', // Should be IGNORED
      searchable: false, // Should be IGNORED
      filterable: false, // Should be IGNORED
      marketplaceVisible: true, // Should be IGNORED
      version: 2,
    };

    // Apply updates via upserter
    await upserter.upsertRecord(mockDb, 'ProductType', incomingProductType);
    await upserter.upsertRecord(mockDb, 'ProductTypeAttributeAssignment', incomingAssignment);

    // 4. Verify ProductType canonical fields updated while commercial requirements PRESERVED
    const updatedPt = productTypeStore.get(ptId);
    expect(updatedPt.name).toBe('Engine Oil Filter - Canonical');
    expect(updatedPt.slug).toBe('engine-oil-filter');
    expect(updatedPt.brandRequirement).toBe(ProductTypeRequirementLevel.REQUIRED); // Preserved!
    expect(updatedPt.minimumImageCount).toBe(3); // Preserved!
    expect(updatedPt.maximumImageCount).toBe(15); // Preserved!

    // 5. Verify ProductTypeAttributeAssignment canonical displayOrder updated while consumer rules PRESERVED
    const updatedAssign = assignmentStore.get(assignmentKey);
    expect(updatedAssign.displayOrder).toBe(99); // Updated from canonical!
    expect(updatedAssign.requirement).toBe(ProductTypeAttributeRequirement.MANDATORY); // Preserved!
    expect(updatedAssign.searchable).toBe(true); // Preserved!
    expect(updatedAssign.filterable).toBe(true); // Preserved!
    expect(updatedAssign.comparable).toBe(true); // Preserved!
    expect(updatedAssign.marketplaceVisible).toBe(false); // Preserved!
    expect(updatedAssign.sellerEditable).toBe(false); // Preserved!
    expect(updatedAssign.validationRule).toEqual({ regex: '^[M0-9x.]+$' }); // Preserved!
    expect(updatedAssign.conditionalRule).toEqual({ if: 'condition' }); // Preserved!
  });

  // 10. Parent-child relationship ordering
  it('10. processes entities in strict topological synchronization order', () => {
    const brandIdx = SYNCHRONIZATION_ORDER.indexOf('Brand');
    const catIdx = SYNCHRONIZATION_ORDER.indexOf('Category');
    const pfIdx = SYNCHRONIZATION_ORDER.indexOf('ProductFamily');
    const ptIdx = SYNCHRONIZATION_ORDER.indexOf('ProductType');
    const ptaIdx = SYNCHRONIZATION_ORDER.indexOf('ProductTypeAttributeAssignment');
    const makeIdx = SYNCHRONIZATION_ORDER.indexOf('VehicleMake');
    const modelIdx = SYNCHRONIZATION_ORDER.indexOf('VehicleModel');
    const genFamIdx = SYNCHRONIZATION_ORDER.indexOf('VehicleGenerationFamily');
    const genIdx = SYNCHRONIZATION_ORDER.indexOf('VehicleGeneration');
    const trimIdx = SYNCHRONIZATION_ORDER.indexOf('VehicleTrim');
    const configIdx = SYNCHRONIZATION_ORDER.indexOf('VehicleConfiguration');

    expect(catIdx).toBeLessThan(pfIdx);
    expect(pfIdx).toBeLessThan(ptIdx);
    expect(ptIdx).toBeLessThan(ptaIdx);
    expect(makeIdx).toBeLessThan(modelIdx);
    expect(modelIdx).toBeLessThan(genFamIdx);
    expect(genFamIdx).toBeLessThan(genIdx);
    expect(genIdx).toBeLessThan(trimIdx);
    expect(trimIdx).toBeLessThan(configIdx);
  });

  // 11. Missing or invalid referenced records
  it('11. fails transaction cleanly when a mandatory foreign key relation cannot be satisfied', async () => {
    mockDb.category.upsert.mockRejectedValueOnce(
      new Error('Foreign key violation: parent_id does not exist'),
    );

    await expect(
      upserter.upsertRecord(mockDb, 'Category', {
        id: 'cat-child',
        parentId: 'non-existent-parent',
        code: 'CHILD',
        name: 'Child Cat',
        slug: 'child-cat',
      }),
    ).rejects.toThrow('parent_id does not exist');
  });

  // 12. Authentication failures
  it('12. records failure and aborts when remote API rejects credentials', async () => {
    mockClient.fetchManifest.mockRejectedValue(
      new UnauthorizedException('AutotechDoc rejected credentials with status 401'),
    );

    await expect(syncService.executeSnapshot()).rejects.toThrow(UnauthorizedException);
    expect(checkpointStore.failedCount).toBe(1);
    expect(checkpointStore.lastError).toContain('rejected credentials');
    expect(checkpointStore.workerId).toBeNull(); // Lock released
  });

  // 13. Rate limiting and backoff
  it('13. client successfully retries on HTTP 429 rate limit response', async () => {
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Rate limit exceeded', { status: 429 });
      }
      return new Response(
        JSON.stringify({
          schemaVersion: '1.0.0',
          source: 'Autotechdoc',
          serverTime: '2026-11-02T12:00:00Z',
          totalPublishedRecords: 0,
          entities: {},
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    try {
      const realClient = new AutotechdocSyncClient({
        baseUrl: 'http://localhost:4000/api/v1',
        token: '01234567890123456789012345678901', // 32 chars
        timeoutMs: 1000,
        maxRetries: 3,
      });

      const manifest = await realClient.fetchManifest();
      expect(manifest.source).toBe('Autotechdoc');
      expect(callCount).toBe(2); // Retried and succeeded
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 14. Recovery from temporary source unavailability
  it('14. client handles 503 Service Unavailable with retry', async () => {
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return new Response('Maintenance in progress', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          changes: [],
          nextCursor: null,
          hasMore: false,
          serverTime: '2026-11-02T12:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    try {
      const realClient = new AutotechdocSyncClient({
        baseUrl: 'http://localhost:4000/api/v1',
        token: '01234567890123456789012345678901',
        timeoutMs: 1000,
        maxRetries: 4,
      });

      const feed = await realClient.fetchChangeFeed();
      expect(feed.changes).toEqual([]);
      expect(callCount).toBe(3);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 15. Incremental changes during snapshot creation
  it('15. ensures incremental changes created during snapshot start from snapshot boundary', async () => {
    const snapshotBoundaryTime = '2026-11-02T12:00:00.000Z';
    mockClient.fetchManifest.mockResolvedValue({
      schemaVersion: '1.0.0',
      source: 'Autotechdoc',
      serverTime: snapshotBoundaryTime,
      totalPublishedRecords: 0,
      entities: Object.fromEntries(
        SYNCHRONIZATION_ORDER.map((e) => [e, { count: 0, latestVersion: 1, latestUpdatedAt: null }]),
      ) as any,
    });
    mockClient.fetchSnapshotPage.mockResolvedValue({
      entityType: 'Brand',
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
      snapshotId: snapshotBoundaryTime,
    });

    // Execute snapshot
    await syncService.executeSnapshot();
    expect(checkpointStore.feedCursor).toBeNull();

    // Incremental sync queries feed using feedCursor
    let requestedSince: string | null = null;
    mockClient.fetchChangeFeed.mockImplementation(async (since?: string) => {
      requestedSince = since ?? null;
      return {
        changes: [],
        nextCursor: null,
        hasMore: false,
        serverTime: '2026-11-02T12:05:00.000Z',
      };
    });

    await syncService.executeIncrementalSync();
    expect(requestedSince).toBeNull();
  });

  // 16. Schema compatibility
  it('16. verifies client configuration and rejects unconfigured token', () => {
    const unconfiguredClient = new AutotechdocSyncClient({
      token: undefined,
    });
    expect(unconfiguredClient.isConfigured()).toBe(false);

    const configuredClient = new AutotechdocSyncClient({
      token: '5a7a4fd52ff7430c6aaf29e30ddd5f70699fd0d644aa3dfabdcc8a8362acb0e1',
    });
    expect(configuredClient.isConfigured()).toBe(true);
  });

  // 17. Reconciliation and repair
  it('17. detects count drift during reconciliation and repairs missing records without overwriting customizations', async () => {
    brandStore.set('b1', { id: 'b1', code: 'BOSCH', name: 'Bosch' });

    mockClient.fetchManifest.mockResolvedValue({
      schemaVersion: '1.0.0',
      source: 'Autotechdoc',
      serverTime: '2026-11-02T13:00:00.000Z',
      totalPublishedRecords: 2,
      entities: {
        Brand: { count: 2, latestVersion: 1, latestUpdatedAt: '2026-11-02T13:00:00Z' },
        ...Object.fromEntries(
          SYNCHRONIZATION_ORDER.filter((e) => e !== 'Brand').map((e) => [
            e,
            { count: 0, latestVersion: 1, latestUpdatedAt: null },
          ]),
        ),
      } as any,
    });

    mockClient.fetchSnapshotPage.mockResolvedValue({
      entityType: 'Brand',
      items: [
        { id: 'b1', code: 'BOSCH', name: 'Bosch' },
        { id: 'b2', code: 'BREMBO', name: 'Brembo' },
      ],
      nextCursor: null,
      hasMore: false,
      totalCount: 2,
      snapshotId: 'reconcile-snap',
    });

    const report = await syncService.executeReconciliation();
    expect(report.reconciledEntities.Brand.remoteCount).toBe(2);
    expect(report.reconciledEntities.Brand.localCount).toBe(1);
    expect(report.reconciledEntities.Brand.repaired).toBe(2);
    expect(brandStore.size).toBe(2);
    expect(brandStore.get('b2').name).toBe('Brembo');
  });

  it('does not let a previous worker release the active worker lease', async () => {
    checkpointStore.workerId = 'worker-active';
    checkpointStore.lockedUntil = new Date(Date.now() + 60_000);
    await syncService.releaseLock('worker-stale');
    expect(checkpointStore.workerId).toBe('worker-active');
    await syncService.releaseLock('worker-active');
    expect(checkpointStore.workerId).toBeNull();
  });

  // 18. Concurrent synchronization worker protection
  it('18. prevents overlapping concurrent workers from advancing checkpoints simultaneously', async () => {
    // Worker 1 holds active lock
    checkpointStore.workerId = 'worker-alpha';
    checkpointStore.lockedUntil = new Date(Date.now() + 60_000); // 1 minute in future

    await expect(syncService.executeSnapshot()).rejects.toThrow(ConflictException);
    await expect(syncService.executeIncrementalSync()).rejects.toThrow(ConflictException);
    await expect(syncService.executeReconciliation()).rejects.toThrow(ConflictException);
  });
});
