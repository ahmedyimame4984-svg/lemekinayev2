import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { DatabaseService } from '../src/database/database.service.js';
import { AutotechdocSyncClient } from '../src/reference-sync/autotechdoc-sync-client.js';
import { ReferenceDataUpserter } from '../src/reference-sync/reference-data-upserter.js';
import { DEFAULT_CHECKPOINT_ID, ReferenceSyncService } from '../src/reference-sync/reference-sync.service.js';
import { SYNCHRONIZATION_ORDER, type CanonicalSyncEntityType } from '../src/reference-sync/reference-sync.types.js';

/**
 * REAL two-database producer/consumer acceptance.
 *
 * Disabled in ordinary CI by design. Turning it on requires a running
 * AutotechDoc producer with an issued TEST machine key, TWO migrated disposable
 * databases, and approved canonical fixtures. Never reuse production URLs.
 *
 * It uses actual producer HTTP rather than global.fetch stubs. Source database
 * access is READ ONLY by default. An explicit disposable-CI-only opt-in
 * exercises source journal mutation and archival; no production DB is allowed.
 */
const enabled = process.env.ATD_LIVE_TWO_DB_ACCEPTANCE === '1';
const producerUrl = process.env.ATD_LIVE_PRODUCER_BASE_URL;
const producerToken = process.env.ATD_LIVE_PRODUCER_B2B_KEY;
const sourceUrl = process.env.ATD_LIVE_SOURCE_DATABASE_URL;
const consumerUrl = process.env.REFERENCE_SYNC_TEST_DATABASE_URL;

const DELEGATES: Record<CanonicalSyncEntityType, string> = {
  Brand: 'brand',
  Category: 'category',
  ProductFamily: 'productFamily',
  AttributeGroup: 'attributeGroup',
  UnitDimension: 'unitDimension',
  AttributeUnit: 'attributeUnit',
  AttributeOptionSet: 'attributeOptionSet',
  AttributeOptionValue: 'attributeOptionValue',
  AttributeDefinition: 'attributeDefinition',
  AttributeAllowedValue: 'attributeAllowedValue',
  ProductType: 'productType',
  ProductTypeAttributeAssignment: 'productTypeAttributeAssignment',
  ProductTypeSchemaVersion: 'referenceSyncCanonicalProductTypeSchema',
  VehicleMake: 'vehicleMake',
  VehicleModel: 'vehicleModel',
  VehicleModelDerivative: 'vehicleModelDerivative',
  VehicleGenerationFamily: 'vehicleGenerationFamily',
  VehicleGeneration: 'vehicleGeneration',
  VehicleTrim: 'vehicleTrim',
  VehicleEngine: 'vehicleEngine',
  VehicleTransmission: 'vehicleTransmission',
  VehicleBodyType: 'vehicleBodyType',
  VehicleMarket: 'vehicleMarket',
  VehicleBatteryPack: 'vehicleBatteryPack',
  VehicleChargingSystem: 'vehicleChargingSystem',
  VehicleElectricMotor: 'vehicleElectricMotor',
  VehicleDriveUnit: 'vehicleDriveUnit',
  VehicleConfiguration: 'vehicleConfiguration',
  VehicleConfigurationMarketApplicability: 'vehicleConfigurationMarketApplicability',
};

type TechnicalLink = {
  electricMotorId?: string;
  driveUnitId?: string;
  position?: string;
  quantity?: number;
  functionRoles?: string[];
};

function technicalLinkSignatures(
  links: TechnicalLink[],
  idKey: 'electricMotorId' | 'driveUnitId',
): string[] {
  return links.map(link => JSON.stringify([
    link[idKey],
    link.position ?? 'UNKNOWN',
    link.quantity ?? 1,
    [...(link.functionRoles ?? [])].sort(),
  ])).sort();
}

function disposableLocalDatabase(value: string | undefined, label: string): string {
  if (!value) throw new Error(label + ' must be explicitly set for live acceptance');
  const parsed = new URL(value);
  const dbName = decodeURIComponent(parsed.pathname.slice(1));
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !/(?:^|[_-])(test|ci|disposable)(?:[_-]|$)/iu.test(dbName)) {
    throw new Error(label + ' must be a loopback PostgreSQL TEST/CI/disposable database');
  }
  return value;
}

describe.skipIf(!enabled)('ATD-06/07 LIVE producer HTTP + TWO PostgreSQL databases', () => {
  let source: PrismaClient;
  let consumer: PrismaClient;
  let remote: AutotechdocSyncClient;
  let sync: ReferenceSyncService;

  beforeAll(async () => {
    const actualSource = disposableLocalDatabase(sourceUrl, 'ATD_LIVE_SOURCE_DATABASE_URL');
    const actualConsumer = disposableLocalDatabase(consumerUrl, 'REFERENCE_SYNC_TEST_DATABASE_URL');
    if (new URL(actualSource).pathname === new URL(actualConsumer).pathname &&
        new URL(actualSource).host === new URL(actualConsumer).host) {
      throw new Error('Source and consumer MUST use physically separate databases');
    }
    if (!producerUrl || !producerToken) {
      throw new Error('Running producer URL and scoped TEST B2B machine key are required');
    }
    const apiUrl = new URL(producerUrl);
    if (apiUrl.protocol !== 'http:' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname) ||
        !apiUrl.pathname.endsWith('/api/v1')) {
      throw new Error('Live two-database acceptance is restricted to a localhost producer API');
    }
    source = new PrismaClient({ adapter: new PrismaPg({ connectionString: actualSource, max: 2 }) });
    consumer = new PrismaClient({ adapter: new PrismaPg({ connectionString: actualConsumer, max: 5 }) });
    await source.$connect();
    await consumer.$connect();

    const readName = async (database: PrismaClient) => {
      const rows = await database.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
      return rows[0]?.name;
    };
    if ((await readName(source)) === (await readName(consumer))) {
      throw new Error('Both Prisma connections resolved to the SAME database');
    }
    // Guard existing consumer data and operational checkpoints. This test must
    // never overwrite an operator's currently running synchronization.
    if (await consumer.referenceSyncCheckpoint.count()) {
      throw new Error('Use a fresh, empty disposable consumer database for live acceptance');
    }
    remote = new AutotechdocSyncClient({
      baseUrl: producerUrl, token: producerToken, maxRetries: 1,
    });
    if (!remote.isConfigured()) throw new Error('Invalid TEST B2B key format');
    sync = new ReferenceSyncService(consumer as unknown as DatabaseService,
      remote, new ReferenceDataUpserter());
  }, 60_000);

  afterAll(async () => {
    await consumer?.$disconnect();
    await source?.$disconnect();
  });

  it('fails closed on an invalid B2B key without touching consumer checkpoints', async () => {
    const unauthorized = new AutotechdocSyncClient({
      baseUrl: producerUrl, token: 'atd_live_' + 'A'.repeat(43), maxRetries: 1,
    });
    await expect(unauthorized.createSnapshot()).rejects.toThrow();
    expect(await consumer.referenceSyncCheckpoint.count()).toBe(0);
  }, 30_000);

  it('imports and verifies every frozen published identity, relationships, EV and schema v3', async () => {
    const result = await sync.executeSnapshot({ batchSize: 100 });
    expect(result.status).toBe('SUCCESS');
    const checkpoint = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    });
    expect(checkpoint.snapshotId).toBeTruthy();
    expect(checkpoint.feedCursor).toBe(checkpoint.snapshotThrough);
    const records = await consumer.referenceSyncImportedRecord.count({
      where: { checkpointId: DEFAULT_CHECKPOINT_ID,
        snapshotId: checkpoint.snapshotId!, active: true },
    });
    expect(records).toBe(checkpoint.snapshotRecordCount);
    expect(records).toBeGreaterThan(0);

    const observed = new Map<CanonicalSyncEntityType, number>();
    let sourceTotal = 0;
    let bevConfigurations = 0;
    let completeBevConfigurations = 0;
    let verifiedSuggestedSchemas = 0;
    for (const entityType of SYNCHRONIZATION_ORDER) {
      let cursor: string | undefined;
      let observedCount = 0;
      for (let pageIndex = 0; pageIndex < 2000; pageIndex++) {
        const page = await remote.fetchSnapshotPage(checkpoint.snapshotId!, entityType, cursor, 250);
        expect(page.through).toBe(checkpoint.snapshotThrough);
        expect(page.snapshotId).toBe(checkpoint.snapshotId);
        for (const item of page.items) {
          const record = item as Record<string, any>;
          const imported = await consumer.referenceSyncImportedRecord.findUniqueOrThrow({
            where: { entityType_entityId: { entityType, entityId: record.id } },
          });
          expect(imported.active).toBe(true);
          const delegate = (consumer as any)[DELEGATES[entityType]];
          const local = await delegate.findUnique({ where: {
            id: imported.localEntityId ?? record.id,
          } }) as Record<string, any> | null;
          expect(local).not.toBeNull();
          if (entityType === 'ProductTypeSchemaVersion') {
            expect(record.snapshot?.contractVersion).toBe(3);
            expect(record.snapshot?.attributePolicy).toBe('SUGGESTED');
            expect(local?.snapshot).toEqual(record.snapshot);
            expect(local?.schemaHash).toBe(record.schemaHash);
            expect(local?.active).toBe(true);
            verifiedSuggestedSchemas++;
          } else {
            expect(local?.status).toBe('ACTIVE');
            for (const relation of ({
              AttributeUnit: ['dimensionId'],
              AttributeOptionValue: ['optionSetId'],
              AttributeDefinition: ['optionSetId', 'unitDimensionId', 'defaultUnitId'],
              VehicleModelDerivative: ['modelId'],
              VehicleGeneration: ['derivativeId'],
              VehicleConfigurationMarketApplicability: ['configurationId', 'marketId', 'role'],
              VehicleConfiguration: ['makeId', 'modelId', 'batteryPackId', 'chargingSystemId'],
            } as Record<string, string[]>)[entityType] ?? []) {
              expect(local?.[relation]).toEqual(record[relation]);
            }
          }
          if (entityType === 'VehicleConfiguration') {
            // Verify actual imported technical junctions, not just parent IDs.
            // A source motor/drive revision must replace its complete local set.
            const sourceMotors: TechnicalLink[] = Array.isArray(record.electricMotors)
              ? record.electricMotors : [];
            const sourceDrives: TechnicalLink[] = Array.isArray(record.driveUnits)
              ? record.driveUnits : [];
            const localMotors = await consumer.vehicleConfigurationElectricMotor.findMany({
              where: { configurationId: record.id },
              select: {
                electricMotorId: true, position: true, quantity: true, functionRoles: true,
              },
            });
            const localDrives = await consumer.vehicleConfigurationDriveUnit.findMany({
              where: { configurationId: record.id },
              select: {
                driveUnitId: true, position: true, quantity: true, functionRoles: true,
              },
            });
            expect(technicalLinkSignatures(localMotors, 'electricMotorId'))
              .toEqual(technicalLinkSignatures(sourceMotors, 'electricMotorId'));
            expect(technicalLinkSignatures(localDrives, 'driveUnitId'))
              .toEqual(technicalLinkSignatures(sourceDrives, 'driveUnitId'));
            if (record.powertrainType === 'BEV') {
              bevConfigurations++;
              expect(local?.powertrainType).toBe('BEV');
              expect(local?.engineId).toBeNull();
              expect(local?.transmissionId).toBeNull();
              if (sourceMotors.length && sourceDrives.length &&
                  record.batteryPackId && record.chargingSystemId) {
                completeBevConfigurations++;
              }
            }
          }
          observedCount++;
        }
        if (!page.hasMore) break;
        if (!page.nextCursor || pageIndex === 1999) {
          throw new Error('Source snapshot did not finish deterministic pagination');
        }
        cursor = page.nextCursor;
      }
      sourceTotal += observedCount;
      observed.set(entityType, observedCount);
    }
    expect(sourceTotal).toBe(checkpoint.snapshotRecordCount);

    // A successful acceptance run requires intentionally seeded, approved
    // reference/EV/v3 fixtures. Empty tables cannot prove these contract paths.
    for (const required of [
      'UnitDimension', 'AttributeOptionSet', 'AttributeOptionValue',
      'VehicleModelDerivative', 'VehicleConfigurationMarketApplicability',
      'VehicleConfiguration', 'ProductTypeSchemaVersion',
      'VehicleElectricMotor', 'VehicleDriveUnit',
      'VehicleBatteryPack', 'VehicleChargingSystem',
    ] as const) {
      expect(observed.get(required), 'Missing approved source test fixture: ' + required)
        .toBeGreaterThan(0);
    }
    expect(verifiedSuggestedSchemas, 'No published Product Type v3 schema fixture')
      .toBeGreaterThan(0);
    expect(bevConfigurations, 'No published BEV configuration fixture')
      .toBeGreaterThan(0);
    expect(completeBevConfigurations,
      'No published BEV with battery, charging, electric motor and drive-unit junctions')
      .toBeGreaterThan(0);
  }, 180_000);

  it.skipIf(process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1')(
    'imports real producer PostgreSQL journal revisions and archives over B2B HTTP', async () => {
      // The source and consumer were already verified as separate, local, test-only
      // databases in beforeAll. Mutations are allowed only for the specially
      // seeded transport fixture and are never part of normal consumer behavior.
      const fixture = await source.brand.findFirst({
        where: { name: 'B2B transport fixture', status: 'ACTIVE' },
        select: { id: true, version: true },
      });
      expect(fixture, 'Missing disposable producer revision fixture').not.toBeNull();
      const brandId = fixture!.id;
      const before = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });

      await source.brand.update({
        where: { id: brandId },
        data: { name: 'B2B fixture updated over live journal', version: { increment: 1 } },
      });
      const revised = await sync.executeIncrementalSync({ batchSize: 10 });
      expect(revised.status).toBe('SUCCESS');
      expect(revised.processedCount).toBeGreaterThan(0);
      expect((await consumer.brand.findUniqueOrThrow({ where: { id: brandId } })))
        .toMatchObject({ name: 'B2B fixture updated over live journal', status: 'ACTIVE' });
      expect(BigInt(revised.cursorAfter!)).toBeGreaterThan(BigInt(before.feedCursor!));

      await source.brand.update({
        where: { id: brandId },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });
      const archived = await sync.executeIncrementalSync({ batchSize: 10 });
      expect(archived.status).toBe('SUCCESS');
      expect(archived.processedCount).toBeGreaterThan(0);
      expect(BigInt(archived.cursorAfter!)).toBeGreaterThan(BigInt(revised.cursorAfter!));
      expect((await consumer.brand.findUniqueOrThrow({ where: { id: brandId } })).status)
        .toBe('ARCHIVED');
      expect(await consumer.referenceSyncImportedRecord.findUniqueOrThrow({
        where: { entityType_entityId: { entityType: 'Brand', entityId: brandId } },
      })).toMatchObject({ active: false, lastSequence: archived.cursorAfter });
    }, 180_000,
  );

  it('replays the live feed, restarts the consumer service and reconciles a new snapshot', async () => {
    const initial = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    });
    const first = await sync.executeIncrementalSync({ batchSize: 20 });
    expect(first.status).toBe('SUCCESS');
    const after = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    });
    expect(BigInt(after.feedCursor!)).toBeGreaterThanOrEqual(BigInt(initial.feedCursor!));

    // A fresh service instance reuses the same durable PostgreSQL checkpoint.
    sync = new ReferenceSyncService(consumer as unknown as DatabaseService,
      remote, new ReferenceDataUpserter());
    const replay = await sync.executeIncrementalSync({ batchSize: 20 });
    expect(replay.status).toBe('SUCCESS');
    const reconciled = await sync.executeReconciliation();
    expect(Object.keys(reconciled.reconciledEntities)).toHaveLength(SYNCHRONIZATION_ORDER.length);
    expect((await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
    })).snapshotStatus).toBe('COMPLETED');
  }, 180_000);

  it.skipIf(process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1')(
    'rejects revoked, expired and wrong-scope machine keys through real source HTTP', async () => {
      // Only the CI-issued B2B key is modified. This opt-in is restricted by
      // beforeAll to two separate disposable, loopback PostgreSQL databases.
      const keyHash = createHash('sha256').update(producerToken!).digest('hex');
      const original = await source.$queryRaw<Array<{
        id: string; client_id: string; created_by_id: string;
      }>>`
        SELECT "id", "client_id", "created_by_id"
        FROM "b2b_api_keys" WHERE "key_hash" = ${keyHash}
      `;
      expect(original).toHaveLength(1);
      const owner = original[0];

      // The read-only key can read journal pages but cannot create snapshots.
      const readonlyToken = 'atd_live_' + randomBytes(32).toString('base64url');
      const readonlyHash = createHash('sha256').update(readonlyToken).digest('hex');
      await source.$executeRaw`
        INSERT INTO "b2b_api_keys"
          ("id", "client_id", "name", "key_prefix", "key_hash",
           "scopes", "status", "created_by_id", "updated_at")
        VALUES
          (${randomUUID()}::uuid, ${owner.client_id}::uuid, 'Disposable read-only CI',
           ${readonlyToken.slice(0, 16)}, ${readonlyHash},
           ARRAY['reference:read']::text[], 'ACTIVE', ${owner.created_by_id}::uuid, NOW())
      `;
      const readonly = new AutotechdocSyncClient({
        baseUrl: producerUrl, token: readonlyToken, maxRetries: 1,
      });
      const checkpoint = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });
      expect((await readonly.fetchChangeFeed(checkpoint.feedCursor, null, 10))
        .contractVersion).toBe('2.0.0');
      await expect(readonly.createSnapshot()).rejects.toThrow();

      // A separate replacement key must continue to work after the original
      // CI credential is revoked, and expire immediately when withdrawn.
      const replacementToken = 'atd_live_' + randomBytes(32).toString('base64url');
      const replacementHash = createHash('sha256').update(replacementToken).digest('hex');
      const replacementId = randomUUID();
      await source.$executeRaw`
        INSERT INTO "b2b_api_keys"
          ("id", "client_id", "name", "key_prefix", "key_hash",
           "scopes", "status", "created_by_id", "updated_at")
        VALUES
          (${replacementId}::uuid, ${owner.client_id}::uuid,
           'Disposable replacement CI', ${replacementToken.slice(0, 16)},
           ${replacementHash}, ARRAY['reference:read','reference:snapshot']::text[],
           'ACTIVE', ${owner.created_by_id}::uuid, NOW())
      `;
      const replacement = new AutotechdocSyncClient({
        baseUrl: producerUrl, token: replacementToken, maxRetries: 1,
      });
      expect((await replacement.createSnapshot()).contractVersion).toBe('2.0.0');

      await source.$executeRaw`
        UPDATE "b2b_api_keys"
        SET "status" = 'REVOKED', "revoked_at" = NOW(),
            "revoked_reason" = 'Disposable live integration test'
        WHERE "id" = ${owner.id}::uuid
      `;
      await expect(remote.createSnapshot()).rejects.toThrow();
      expect((await replacement.fetchChangeFeed(checkpoint.feedCursor, null, 10))
        .contractVersion).toBe('2.0.0');

      await source.$executeRaw`
        UPDATE "b2b_api_keys"
        SET "expires_at" = NOW() - INTERVAL '1 minute'
        WHERE "id" = ${replacementId}::uuid
      `;
      await expect(replacement.createSnapshot()).rejects.toThrow();
      // Consumer state must remain unchanged by failed credential requests.
      expect((await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      })).feedCursor).toBe(checkpoint.feedCursor);
    }, 180_000,
  );
});
