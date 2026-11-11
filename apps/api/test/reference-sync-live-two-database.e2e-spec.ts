import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import type { DatabaseService } from '../src/database/database.service.js';
import { AutotechdocSyncClient, SnapshotExpiredError } from '../src/reference-sync/autotechdoc-sync-client.js';
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
  VehicleIdentifierRule: 'referenceSyncVehicleIdentifierRule',
};

type SourceIdentifierRule = {
  id: string;
  makeId: string;
  modelId: string | null;
  chassisPrefix: string | null;
  sourceReference: string;
  evidenceReference: string;
  rightsReference: string | null;
  approvedById: string | null;
  version: number;
};

/** Consumer Prisma deliberately does not include the producer-owned rule model.
 * Only the SOURCE disposable CI connection reads that table via typed SQL.
 * Never add the producer's writable rule model to marketplace Prisma.
 */
async function readProducerRules(db: PrismaClient, approved: boolean): Promise<SourceIdentifierRule[]> {
  if (approved) return db.$queryRaw<SourceIdentifierRule[]>`
    SELECT "id", "make_id" AS "makeId", "model_id" AS "modelId",
      "chassis_prefix" AS "chassisPrefix", "source_reference" AS "sourceReference",
      "evidence_reference" AS "evidenceReference", "rights_reference" AS "rightsReference",
      "approved_by_id" AS "approvedById", "version"
    FROM "vehicle_identifier_rules"
    WHERE "source_reference" = 'SYNTHETIC-CI-NOT-LICENSED'
      AND "status" = 'ACTIVE'::"MasterDataStatus"
      AND "review_status" = 'APPROVED'::"VehicleIdentifierRuleReviewStatus"
    LIMIT 1
  `;
  return db.$queryRaw<SourceIdentifierRule[]>`
    SELECT "id", "make_id" AS "makeId", "model_id" AS "modelId",
      "chassis_prefix" AS "chassisPrefix", "source_reference" AS "sourceReference",
      "evidence_reference" AS "evidenceReference", "rights_reference" AS "rightsReference",
      "approved_by_id" AS "approvedById", "version"
    FROM "vehicle_identifier_rules"
    WHERE "chassis_prefix" = 'CIATD12'
      AND "status" = 'DRAFT'::"MasterDataStatus"
    LIMIT 1
  `;
}

type TechnicalLink = {
  id?: string;
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
    link.id,
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

    // The 30th entity must mirror ONLY source-approved/rights-cleared rules.
    // These test records are synthetic and are not legal manufacturer evidence.
    const approvedRule = (await readProducerRules(source, true))[0] ?? null;
    expect(approvedRule, 'Missing approved synthetic ATD-11 source rule').not.toBeNull();
    const importedRule = await consumer.referenceSyncVehicleIdentifierRule.findUnique({
      where: { id: approvedRule!.id },
    });
    expect(importedRule).toMatchObject({
      id: approvedRule!.id, status: 'ACTIVE',
      rightsScope: 'B2B_DISTRIBUTION',
      makeId: approvedRule!.makeId, modelId: approvedRule!.modelId,
      chassisPrefix: approvedRule!.chassisPrefix,
      sourceReference: approvedRule!.sourceReference,
      evidenceReference: approvedRule!.evidenceReference,
      version: approvedRule!.version,
    });
    expect(JSON.stringify(importedRule)).not.toContain(approvedRule!.rightsReference!);
    expect(JSON.stringify(importedRule)).not.toContain(approvedRule!.approvedById!);
    const draftRule = (await readProducerRules(source, false))[0] ?? null;
    expect(draftRule).not.toBeNull();
    expect(await consumer.referenceSyncVehicleIdentifierRule.findUnique({
      where: { id: draftRule!.id },
    })).toBeNull();
    expect(await consumer.referenceSyncImportedRecord.findUnique({
      where: { entityType_entityId: {
        entityType: 'VehicleIdentifierRule', entityId: draftRule!.id,
      } },
    })).toBeNull();

    // Unlike transport-only ACTIVE fixture seeding, this Brand must traverse
    // the real source DRAFT -> independent SUBMIT/APPROVE -> ACTIVE services.
    // Review metadata proves governance execution, not a third-party data license.
    const governed = await source.brand.findFirst({
      where: { code: { startsWith: 'GOVERNED_CI_' }, status: 'ACTIVE' },
      select: { id: true, code: true, name: true, version: true },
    });
    expect(governed, 'Source independent-review fixture must be ACTIVE').not.toBeNull();
    const reviewEvents = await source.auditLog.findMany({
      where: {
        action: 'CANONICAL_REVIEW_TRANSITIONED',
        entityType: 'BRAND',
        entityId: governed!.id,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { actorId: true, metadata: true },
    });
    expect(reviewEvents).toHaveLength(2);
    expect(reviewEvents.map(event =>
      (event.metadata as Record<string, unknown>)?.decision))
      .toEqual(['SUBMIT', 'APPROVE']);
    expect(reviewEvents[0].actorId).not.toBe(reviewEvents[1].actorId);
    expect(await source.masterDataProvenance.findFirst({
      where: { entityType: 'BRAND', entityId: governed!.id },
      select: { sourceName: true },
    })).toMatchObject({ sourceName: 'Synthetic CI governance fixture' });
    expect(await consumer.referenceSyncImportedRecord.findUnique({
      where: { entityType_entityId: { entityType: 'Brand', entityId: governed!.id } },
    })).toMatchObject({ active: true });
    expect(await consumer.brand.findUnique({ where: { id: governed!.id } }))
      .toMatchObject({ code: governed!.code, name: governed!.name, version: governed!.version, status: 'ACTIVE' });

    // A researched DRAFT lacking independent approval must not appear in
    // either the imported source-ID mapping or the consumer canonical mirror.
    const unapproved = await source.brand.findFirst({
      where: { code: { startsWith: 'UNAPPROVED_CI_' }, status: 'DRAFT' },
      select: { id: true },
    });
    expect(unapproved, 'Source negative draft fixture must exist').not.toBeNull();
    expect(await consumer.referenceSyncImportedRecord.findUnique({
      where: { entityType_entityId: { entityType: 'Brand', entityId: unapproved!.id } },
    })).toBeNull();
    expect(await consumer.brand.findUnique({ where: { id: unapproved!.id } }))
      .toBeNull();

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
            // Verify canonical UUID identity as well as technical field equality.
            // Replays must not recreate different consumer-only junction IDs.
            const sourceMotors: TechnicalLink[] = Array.isArray(record.electricMotors)
              ? record.electricMotors : [];
            const sourceDrives: TechnicalLink[] = Array.isArray(record.driveUnits)
              ? record.driveUnits : [];
            const localMotors = await consumer.vehicleConfigurationElectricMotor.findMany({
              where: { configurationId: record.id },
              select: {
                id: true, electricMotorId: true, position: true, quantity: true, functionRoles: true,
              },
            });
            const localDrives = await consumer.vehicleConfigurationDriveUnit.findMany({
              where: { configurationId: record.id },
              select: {
                id: true, driveUnitId: true, position: true, quantity: true, functionRoles: true,
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

  it.skipIf(process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1')(
    'revokes out-of-band tampered rule evidence and replays retirement without seller mutations', async () => {
      const before = (await readProducerRules(source, true))[0];
      expect(before, 'Synthetic manufacturer rule must be approved').toBeDefined();
      // A forbidden direct evidence edit would otherwise leave the row
      // ACTIVE+APPROVED; its immutable reviewedFingerprint no longer agrees.
      // The producer MUST emit an ARCHIVE tombstone, not a modified UPSERT.
      const alteredEvidence = 'UNREVIEWED-CONSUMER-CI-' + randomUUID();
      await source.$executeRaw`
        UPDATE "vehicle_identifier_rules"
        SET "source_reference" = ${alteredEvidence}, "version" = "version" + 1
        WHERE "id" = ${before.id}::uuid
      `;
      const invalidated = await sync.executeIncrementalSync({ batchSize: 10 });
      expect(invalidated.status).toBe('SUCCESS');
      const mirrored = await consumer.referenceSyncVehicleIdentifierRule.findUniqueOrThrow({
        where: { id: before.id },
      });
      expect(mirrored).toMatchObject({
        status: 'DEPRECATED', sourceReference: before.sourceReference,
      });
      expect(JSON.stringify(mirrored)).not.toContain(alteredEvidence);
      expect(await consumer.referenceSyncImportedRecord.findUniqueOrThrow({
        where: { entityType_entityId: {
          entityType: 'VehicleIdentifierRule', entityId: before.id,
        } },
      })).toMatchObject({ active: false });

      // A second ARCHIVE following explicit retirement must not resurrect
      // a locally revoked rule or advance the checkpoint incorrectly.
      await source.$executeRaw`
        UPDATE "vehicle_identifier_rules"
        SET "status" = 'DEPRECATED'::"MasterDataStatus", "version" = "version" + 1
        WHERE "id" = ${before.id}::uuid
      `;
      const retired = await sync.executeIncrementalSync({ batchSize: 10 });
      expect(retired.status).toBe('SUCCESS');
      expect(await consumer.referenceSyncVehicleIdentifierRule.findUniqueOrThrow({
        where: { id: before.id },
      })).toMatchObject({
        status: 'DEPRECATED', sourceReference: before.sourceReference,
      });
      // The mirror is local technical reference data only; never a listing.
      expect(await consumer.referenceSyncVehicleIdentifierRule.count({
        where: { status: 'ACTIVE' },
      })).toBe(0);
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
    'retries real 503/429 HTTP, preserves checkpoint on outage and converges after recovery', async () => {
      // Explicit local-only proxy; the upstream remains the real authenticated
      // AutotechDoc Nest API, and the consumer uses its real PostgreSQL DB.
      const origin = new URL(producerUrl!).origin;
      const injected: number[] = [503, 429];
      let requests = 0;
      const proxy = createServer(async (req, res) => {
        if (req.method !== 'GET' || !req.url?.startsWith('/api/v1/reference-data/export/v2/')) {
          res.writeHead(405).end();
          return;
        }
        requests++;
        if (injected.length) {
          res.writeHead(injected.shift()!, { 'Content-Type': 'application/json' });
          res.end('{"code":"DISPOSABLE_TRANSIENT_FAILURE"}');
          return;
        }
        try {
          const upstream = await fetch(origin + req.url, {
            headers: {
              Authorization: req.headers.authorization ?? '',
              'X-ATD-Reference-Contract': req.headers['x-atd-reference-contract']?.toString() ?? '2.1.0',
            },
            redirect: 'error',
          });
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(await upstream.text());
        } catch {
          res.writeHead(502).end();
        }
      });
      await new Promise<void>((resolve, reject) =>
        proxy.listen(0, '127.0.0.1', resolve).once('error', reject));
      try {
        const address = proxy.address();
        if (!address || typeof address === 'string') throw new Error('Missing local test proxy port');
        const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        const before = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
          where: { id: DEFAULT_CHECKPOINT_ID },
        });
        const retry = new AutotechdocSyncClient({
          baseUrl, token: producerToken, maxRetries: 3, timeoutMs: 3000,
        });
        const healthy = await retry.fetchChangeFeed(before.feedCursor, null, 20);
        expect(healthy.contractVersion).toBe('2.1.0');
        expect(requests).toBe(3); // Real HTTP: 503 -> 429 -> authenticated 200.

        const unavailable = randomUUID();
        await expect(retry.fetchSnapshotPage(unavailable, 'Brand', null, 10))
          .rejects.toThrow(SnapshotExpiredError); // 410 is never retried.

        const market = await source.vehicleMarket.findFirstOrThrow({
          where: { name: 'Africa regional test', status: 'ACTIVE' },
        });
        await source.vehicleMarket.update({
          where: { id: market.id },
          data: {
            name: 'ATD-07 HTTP outage recovery verified',
            version: { increment: 1 },
          },
        });
        const noRetry = new AutotechdocSyncClient({
          baseUrl, token: producerToken, maxRetries: 1, timeoutMs: 3000,
        });
        const service = new ReferenceSyncService(
          consumer as unknown as DatabaseService, noRetry, new ReferenceDataUpserter(),
        );
        injected.push(503);
        await expect(service.executeIncrementalSync({ batchSize: 10 }))
          .rejects.toThrow(/temporary HTTP 503/u);
        const blocked = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
          where: { id: DEFAULT_CHECKPOINT_ID },
        });
        expect(blocked.feedCursor).toBe(before.feedCursor);
        expect((await consumer.vehicleMarket.findUniqueOrThrow({
          where: { id: market.id },
        })).name).toBe('Africa regional test');
        const recovered = await service.executeIncrementalSync({ batchSize: 10 });
        expect(recovered.status).toBe('SUCCESS');
        expect(BigInt(recovered.cursorAfter!)).toBeGreaterThan(BigInt(before.feedCursor!));
        expect((await consumer.vehicleMarket.findUniqueOrThrow({
          where: { id: market.id },
        })).name).toBe('ATD-07 HTTP outage recovery verified');
      } finally {
        proxy.closeAllConnections();
        await new Promise<void>(resolve => proxy.close(() => resolve()));
      }
    }, 180_000,
  );

  it.skipIf(process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1')(
    'resumes a real 560-plus-record snapshot at a durable page checkpoint after worker failure', async () => {
      const brandCount = await source.brand.count({ where: { status: 'ACTIVE' } });
      expect(brandCount).toBeGreaterThan(500); // Strictly real multi-page CI fixtures.

      const before = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });
      const firstClient = new AutotechdocSyncClient({
        baseUrl: producerUrl, token: producerToken, maxRetries: 1,
      });
      const sourcePage = firstClient.fetchSnapshotPage.bind(firstClient);
      let brandPages = 0;
      const interrupt = vi.spyOn(firstClient, 'fetchSnapshotPage')
        .mockImplementation(async (id, entityType, cursor, limit) => {
          if (entityType === 'Brand' && ++brandPages === 2) {
            throw new Error('DISPOSABLE_PAGE_TWO_TRANSPORT_INTERRUPTION');
          }
          // Every successful page is fetched from the real authenticated
          // producer HTTP server and independently committed to consumer PG.
          return sourcePage(id, entityType, cursor, limit);
        });
      const firstWorker = new ReferenceSyncService(
        consumer as unknown as DatabaseService, firstClient, new ReferenceDataUpserter(),
      );
      try {
        await expect(firstWorker.executeSnapshot({ forceFull: true, batchSize: 100 }))
          .rejects.toThrow('DISPOSABLE_PAGE_TWO_TRANSPORT_INTERRUPTION');
      } finally {
        interrupt.mockRestore();
      }
      const interrupted = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });
      const firstBrandPage = await consumer.referenceSyncEntityState.findUniqueOrThrow({
        where: {
          checkpointId_entityType: {
            checkpointId: DEFAULT_CHECKPOINT_ID, entityType: 'Brand',
          },
        },
      });
      expect(brandPages).toBe(2);
      expect(firstBrandPage.status).toBe('IN_PROGRESS');
      expect(firstBrandPage.recordCount).toBe(100);
      expect(firstBrandPage.lastCompletedCursor).toBeTruthy();
      expect(interrupted.snapshotStatus).toBe('IN_PROGRESS');
      expect(interrupted.feedCursor).toBe(before.feedCursor);
      expect(interrupted.snapshotAppliedDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(interrupted.snapshotAppliedDigest).not.toBe(interrupted.snapshotContentSha256);

      // This is a new worker object and real HTTP client. It must not mint
      // another snapshot or double-import the first 100 rows.
      const restartClient = new AutotechdocSyncClient({
        baseUrl: producerUrl, token: producerToken, maxRetries: 1,
      });
      const mintSnapshot = vi.spyOn(restartClient, 'createSnapshot');
      const restartWorker = new ReferenceSyncService(
        consumer as unknown as DatabaseService, restartClient, new ReferenceDataUpserter(),
      );
      const resumed = await restartWorker.executeSnapshot({ batchSize: 100 });
      expect(resumed.status).toBe('SUCCESS');
      expect(mintSnapshot).not.toHaveBeenCalled();
      const finished = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });
      expect(finished.snapshotStatus).toBe('COMPLETED');
      expect(finished.snapshotId).toBe(interrupted.snapshotId);
      expect(finished.snapshotAppliedDigest).toBe(finished.snapshotContentSha256);
      expect(finished.feedCursor).toBe(finished.snapshotThrough);
      expect((await consumer.referenceSyncEntityState.findUniqueOrThrow({
        where: {
          checkpointId_entityType: {
            checkpointId: DEFAULT_CHECKPOINT_ID, entityType: 'Brand',
          },
        },
      })).recordCount).toBe(brandCount);
    }, 180_000,
  );

  it.skipIf(process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1')(
    'rejects an altered frozen producer payload before modifying the local identity', async () => {
      const make = await source.vehicleMake.findFirstOrThrow({
        where: { name: 'Test EV manufacturer', status: 'ACTIVE' },
        select: { id: true },
      });
      const localBefore = await consumer.vehicleMake.findUniqueOrThrow({
        where: { id: make.id },
        select: { name: true, status: true },
      });
      const checkpointBefore = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });
      const frozen = await remote.createSnapshot();
      const copies = await source.$queryRaw<Array<{ payload: Record<string, unknown> }>>`
        SELECT "payload" FROM "canonical_publication_snapshot_items"
        WHERE "snapshot_id" = ${frozen.snapshotId}::uuid
          AND "entity_type" = 'VehicleMake' AND "entity_id" = ${make.id}::uuid
      `;
      expect(copies).toHaveLength(1);
      const original = copies[0].payload;
      const corrupted = JSON.stringify({ ...original, name: 'Unexpected frozen payload replacement' });
      await source.$executeRaw`
        UPDATE "canonical_publication_snapshot_items" SET "payload" = ${corrupted}::jsonb
        WHERE "snapshot_id" = ${frozen.snapshotId}::uuid
          AND "entity_type" = 'VehicleMake' AND "entity_id" = ${make.id}::uuid
      `;

      // Snapshot creation remains real HTTP; the only override pins a snapshot
      // deliberately corrupted in disposable producer PostgreSQL.
      const pinned = new AutotechdocSyncClient({
        baseUrl: producerUrl, token: producerToken, maxRetries: 1,
      });
      const create = vi.spyOn(pinned, 'createSnapshot').mockResolvedValueOnce(frozen);
      const isolated = new ReferenceSyncService(
        consumer as unknown as DatabaseService, pinned, new ReferenceDataUpserter(),
      );
      try {
        await expect(isolated.executeSnapshot({ forceFull: true }))
          .rejects.toThrow('AutotechDoc returned an inconsistent v2 snapshot page');
        expect((await consumer.vehicleMake.findUniqueOrThrow({
          where: { id: make.id },
        }))).toMatchObject(localBefore);
        const blocked = await consumer.referenceSyncCheckpoint.findUniqueOrThrow({
          where: { id: DEFAULT_CHECKPOINT_ID },
        });
        expect(blocked.feedCursor).toBe(checkpointBefore.feedCursor);
        expect(blocked.snapshotStatus).toBe('IN_PROGRESS');
      } finally {
        create.mockRestore();
        const restored = JSON.stringify(original);
        await source.$executeRaw`
          UPDATE "canonical_publication_snapshot_items" SET "payload" = ${restored}::jsonb
          WHERE "snapshot_id" = ${frozen.snapshotId}::uuid
            AND "entity_type" = 'VehicleMake' AND "entity_id" = ${make.id}::uuid
        `;
        // Restore the consumer to a healthy checkpoint from a fresh, verified
        // real producer snapshot; never reuse the corrupted in-progress ID.
        const healed = await sync.executeSnapshot({ forceFull: true });
        expect(healed.status).toBe('SUCCESS');
      }
    }, 180_000,
  );

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
        .contractVersion).toBe('2.1.0');
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
      expect((await replacement.createSnapshot()).contractVersion).toBe('2.1.0');

      await source.$executeRaw`
        UPDATE "b2b_api_keys"
        SET "status" = 'REVOKED', "revoked_at" = NOW(),
            "revoked_reason" = 'Disposable live integration test'
        WHERE "id" = ${owner.id}::uuid
      `;
      await expect(remote.createSnapshot()).rejects.toThrow();
      expect((await replacement.fetchChangeFeed(checkpoint.feedCursor, null, 10))
        .contractVersion).toBe('2.1.0');

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
