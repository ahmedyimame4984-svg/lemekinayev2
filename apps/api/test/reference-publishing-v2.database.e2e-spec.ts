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
        const through = BigInt(target.searchParams.get('through') ?? '8');
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
  it('keeps marketplace Article schema snapshots intact when a matching canonical v3 version is imported', async () => {
    const id = randomUUID();
    const categoryId = randomUUID();
    const productTypeId = randomUUID();
    const canonicalSchemaId = randomUUID();
    const upserter = new ReferenceDataUpserter();
    await db.$transaction(async tx => {
      await upserter.upsertRecord(tx, 'Category', {
        id: categoryId, code: 'ATD_' + id.replaceAll('-', '').slice(0, 15),
        slug: 'atd-' + id, name: 'ATD-07 schema fixture', status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'ProductType', {
        id: productTypeId, categoryId, code: 'PT_' + id.replaceAll('-', '').slice(0, 15),
        slug: 'pt-' + id, name: 'ATD-07 schema fixture', status: 'ACTIVE', version: 1,
      });
    });
    const actor = await db.user.findFirstOrThrow({
      where: { email: 'system-sync@lemekinaye.internal' },
    });
    const commercialId = randomUUID();
    const commercialSnapshot = {
      contractVersion: 3, marketplacePolicies: { minimumImageCount: 7 },
    };
    await db.productTypeSchemaVersion.create({
      data: {
        id: commercialId, productTypeId, schemaVersion: 1,
        schemaHash: 'a'.repeat(64), snapshot: commercialSnapshot,
        publishedById: actor.id,
      },
    });
    const canonical = {
      id: canonicalSchemaId, productTypeId, schemaVersion: 1,
      schemaHash: 'b'.repeat(64), snapshot: {
        contractVersion: 3, attributePolicy: 'SUGGESTED', attributes: [],
      },
      publishedAt: new Date().toISOString(),
    };
    await db.$transaction(async tx => {
      await upserter.upsertRecord(tx, 'ProductTypeSchemaVersion', canonical);
    });
    const intact = await db.productTypeSchemaVersion.findUniqueOrThrow({
      where: { id: commercialId },
    });
    expect(intact.snapshot).toEqual(commercialSnapshot);
    expect(intact.schemaHash).toBe('a'.repeat(64));
    expect(await db.referenceSyncCanonicalProductTypeSchema.findUniqueOrThrow({
      where: { id: canonicalSchemaId },
    })).toMatchObject({
      productTypeId, active: true, schemaHash: 'b'.repeat(64),
    });
    await db.$transaction(async tx => {
      await upserter.archiveRecord(tx, 'ProductTypeSchemaVersion', canonicalSchemaId);
    });
    expect((await db.referenceSyncCanonicalProductTypeSchema.findUniqueOrThrow({
      where: { id: canonicalSchemaId },
    })).active).toBe(false);
    expect((await db.productTypeSchemaVersion.findUniqueOrThrow({
      where: { id: commercialId },
    })).snapshot).toEqual(commercialSnapshot);
  });

  it('preserves a local assignment identity and seller-owned policy on canonical UPSERT and ARCHIVE', async () => {
    const upserter = new ReferenceDataUpserter();
    const fixture = randomUUID().replaceAll('-', '');
    const categoryId = randomUUID();
    const productTypeId = randomUUID();
    const attributeId = randomUUID();
    const localId = randomUUID();
    const canonicalId = randomUUID();
    await db.$transaction(async tx => {
      await upserter.upsertRecord(tx, 'Category', {
        id: categoryId, code: 'CAT_' + fixture.slice(0, 22),
        slug: 'cat-' + fixture, name: 'ATD-07 assignment fixture',
        status: 'ACTIVE', version: 1, level: 0,
      });
      await upserter.upsertRecord(tx, 'ProductType', {
        id: productTypeId, categoryId,
        code: 'PT_' + fixture.slice(0, 22),
        slug: 'pt-' + fixture, name: 'ATD-07 assignment fixture',
        status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'AttributeDefinition', {
        id: attributeId, code: 'ATTR_' + fixture.slice(0, 22),
        name: 'ATD-07 attribute', dataType: 'TEXT',
        scope: 'PRODUCT', status: 'ACTIVE', version: 1,
      });
      const actorId = await upserter.resolveActorId(tx);
      await tx.productTypeAttributeAssignment.create({
        data: {
          id: localId, productTypeId, attributeId,
          requirement: 'MANDATORY', searchable: true, sellerEditable: false,
          status: 'ACTIVE', version: 1,
          createdById: actorId, updatedById: actorId,
        },
      });
    });
    await db.referenceSyncCheckpoint.update({
      where: { id: DEFAULT_CHECKPOINT_ID },
      data: { snapshotStatus: 'COMPLETED', feedCursor: '6', batchThrough: null },
    });
    changes = [{
      sequence: '7', entityType: 'ProductTypeAttributeAssignment',
      entityId: canonicalId, operation: 'UPSERT', version: 1,
      recordedAt: new Date().toISOString(),
      data: {
        id: canonicalId, productTypeId, attributeId,
        displayOrder: 8, status: 'ACTIVE', version: 1,
      },
    }];
    await sync.executeIncrementalSync();
    const local = await db.productTypeAttributeAssignment.findUniqueOrThrow({
      where: { id: localId },
    });
    expect(local).toMatchObject({
      id: localId, requirement: 'MANDATORY', searchable: true,
      sellerEditable: false, displayOrder: 0, status: 'ACTIVE', origin: 'MANUAL',
    });
    const map = await db.referenceSyncImportedRecord.findUniqueOrThrow({
      where: {
        entityType_entityId: {
          entityType: 'ProductTypeAttributeAssignment', entityId: canonicalId,
        },
      },
    });
    expect(map.localEntityId).toBe(localId);

    changes = [{
      sequence: '8', entityType: 'ProductTypeAttributeAssignment',
      entityId: canonicalId, operation: 'ARCHIVE', version: 2,
      recordedAt: new Date().toISOString(),
      data: { id: canonicalId, status: 'ARCHIVED', version: 2 },
    }];
    await sync.executeIncrementalSync();
    expect(await db.productTypeAttributeAssignment.findUniqueOrThrow({
      where: { id: localId },
    })).toMatchObject({
      id: localId, status: 'ACTIVE', origin: 'MANUAL',
      requirement: 'MANDATORY', searchable: true, sellerEditable: false,
    });
    expect((await db.referenceSyncImportedRecord.findUniqueOrThrow({
      where: {
        entityType_entityId: {
          entityType: 'ProductTypeAttributeAssignment', entityId: canonicalId,
        },
      },
    })).active).toBe(false);
    expect((await db.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    })).feedCursor).toBe('8');

    // A separate *source-owned* assignment must still retire on withdrawal.
    const sourceOnlyAttrId = randomUUID();
    const sourceOnlyId = randomUUID();
    await db.$transaction(async tx => {
      await upserter.upsertRecord(tx, 'AttributeDefinition', {
        id: sourceOnlyAttrId, code: 'SRC_' + fixture.slice(0, 22),
        name: 'ATD-07 source-owned attribute', dataType: 'TEXT',
        scope: 'PRODUCT', status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'ProductTypeAttributeAssignment', {
        id: sourceOnlyId, productTypeId, attributeId: sourceOnlyAttrId,
        displayOrder: 3, status: 'ACTIVE', version: 1,
      });
      await upserter.archiveRecord(tx, 'ProductTypeAttributeAssignment', sourceOnlyId);
    });
    expect(await db.productTypeAttributeAssignment.findUniqueOrThrow({
      where: { id: sourceOnlyId },
    })).toMatchObject({
      origin: 'CANONICAL', status: 'ARCHIVED',
    });
  });


  it('stores and updates BEV multi-motor and drive-unit relationships in real PostgreSQL', async () => {
    const upserter = new ReferenceDataUpserter();
    const makeId = randomUUID();
    const modelId = randomUUID();
    const batteryId = randomUUID();
    const chargingId = randomUUID();
    const motorAId = randomUUID();
    const motorBId = randomUUID();
    const driveId = randomUUID();
    const configId = randomUUID();
    const code = (prefix: string, id: string) =>
      prefix + '_' + id.replaceAll('-', '').slice(0, 20);
    await db.$transaction(async tx => {
      await upserter.upsertRecord(tx, 'VehicleMake', {
        id: makeId, code: code('MAKE', makeId),
        name: 'ATD07 electric make', status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'VehicleModel', {
        id: modelId, makeId, code: code('MODEL', modelId),
        name: 'ATD07 electric model', status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'VehicleBatteryPack', {
        id: batteryId, code: code('PACK', batteryId),
        name: 'ATD07 battery', usableCapacityKwh: 74,
        status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'VehicleChargingSystem', {
        id: chargingId, code: code('CHARGE', chargingId),
        name: 'ATD07 CCS2', dcConnector: 'CCS2', maxDcPowerKw: 150,
        status: 'ACTIVE', version: 1,
      });
      for (const id of [motorAId, motorBId]) {
        await upserter.upsertRecord(tx, 'VehicleElectricMotor', {
          id, code: code('MOTOR', id), name: 'ATD07 traction motor',
          peakPowerKw: 160, status: 'ACTIVE', version: 1,
        });
      }
      await upserter.upsertRecord(tx, 'VehicleDriveUnit', {
        id: driveId, code: code('DRIVE', driveId),
        name: 'ATD07 reduction gear', gearCount: 1,
        status: 'ACTIVE', version: 1,
      });
      await upserter.upsertRecord(tx, 'VehicleConfiguration', {
        id: configId, identityCode: code('ATD07_BEV', configId),
        makeId, modelId, powertrainType: 'BEV',
        engineId: null, transmissionId: null,
        batteryPackId: batteryId, chargingSystemId: chargingId,
        status: 'ACTIVE', version: 1,
        electricMotors: [{
          electricMotorId: motorAId, position: 'REAR_AXLE',
          quantity: 2, functionRoles: ['TRACTION'],
        }],
        driveUnits: [{
          driveUnitId: driveId, position: 'REAR_AXLE',
          quantity: 1, functionRoles: ['TRACTION'],
        }],
      });
    });
    const before = await db.vehicleConfiguration.findUniqueOrThrow({
      where: { id: configId },
      include: { electricMotors: true, driveUnits: true },
    });
    expect(before).toMatchObject({
      powertrainType: 'BEV',
      engineId: null, transmissionId: null,
      batteryPackId: batteryId, chargingSystemId: chargingId,
    });
    expect(before.electricMotors).toHaveLength(1);
    expect(before.electricMotors[0]).toMatchObject({
      electricMotorId: motorAId, quantity: 2,
    });
    expect(before.driveUnits[0]).toMatchObject({ driveUnitId: driveId });

    // A canonical EV revision publishes the entire relation set. Replacements
    // must delete prior motors/drive units atomically, never append duplicates.
    await db.$transaction(async tx => {
      await upserter.upsertRecord(tx, 'VehicleConfiguration', {
        id: configId, identityCode: code('ATD07_BEV', configId),
        makeId, modelId, powertrainType: 'BEV',
        engineId: null, transmissionId: null,
        batteryPackId: batteryId, chargingSystemId: chargingId,
        status: 'ACTIVE', version: 2,
        electricMotors: [{
          electricMotorId: motorBId, position: 'FRONT_AXLE',
          quantity: 1, functionRoles: ['TRACTION'],
        }],
        driveUnits: [],
      });
    });
    const after = await db.vehicleConfiguration.findUniqueOrThrow({
      where: { id: configId },
      include: { electricMotors: true, driveUnits: true },
    });
    expect(after.electricMotors).toHaveLength(1);
    expect(after.electricMotors[0]).toMatchObject({
      electricMotorId: motorBId, quantity: 1,
    });
    expect(after.driveUnits).toHaveLength(0);
    expect(after.version).toBe(2);
    await db.$transaction(async tx => {
      await upserter.archiveRecord(tx, 'VehicleConfiguration', configId);
    });
    const retired = await db.vehicleConfiguration.findUniqueOrThrow({
      where: { id: configId },
      include: { electricMotors: true },
    });
    expect(retired.status).toBe(MasterDataStatus.ARCHIVED);
    expect(retired.electricMotors).toHaveLength(1);
  });

});
