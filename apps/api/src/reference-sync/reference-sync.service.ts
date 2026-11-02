import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AutotechdocSyncClient } from './autotechdoc-sync-client.js';
import { ReferenceDataUpserter } from './reference-data-upserter.js';
import {
  CanonicalSnapshotPageResponse,
  CanonicalSyncEntityType,
  SYNCHRONIZATION_ORDER,
  SyncResult,
  SyncStatusReport,
} from './reference-sync.types.js';

export const DEFAULT_CHECKPOINT_ID = 'autotechdoc-canonical-sync';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ReferenceSyncService {
  private readonly logger = new Logger(ReferenceSyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly syncClient: AutotechdocSyncClient,
    private readonly upserter: ReferenceDataUpserter,
  ) {}

  private async ensureCheckpoint(): Promise<void> {
    await this.database.referenceSyncCheckpoint.upsert({
      where: { id: DEFAULT_CHECKPOINT_ID },
      create: {
        id: DEFAULT_CHECKPOINT_ID,
        snapshotStatus: 'NOT_STARTED',
      },
      update: {},
    });
  }

  async acquireLock(workerId: string, ttlMs = LOCK_TTL_MS): Promise<void> {
    await this.ensureCheckpoint();
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + ttlMs);

    // Atomic compare-and-set: competing workers cannot both acquire the lease.
    const acquired = await this.database.referenceSyncCheckpoint.updateMany({
      where: {
        id: DEFAULT_CHECKPOINT_ID,
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lte: now } },
          { workerId },
        ],
      },
      data: { workerId, lockedUntil },
    });
    if (acquired.count !== 1) {
      throw new ConflictException('Reference synchronization is already running');
    }
  }

  async releaseLock(workerId: string): Promise<void> {
    // Only the current lease owner can release; never clear another worker's lease.
    await this.database.referenceSyncCheckpoint.updateMany({
      where: { id: DEFAULT_CHECKPOINT_ID, workerId },
      data: { workerId: null, lockedUntil: null },
    });
  }

  async getStatus(): Promise<SyncStatusReport> {
    await this.ensureCheckpoint();

    const checkpoint = await this.database.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
      include: {
        entityStates: {
          orderBy: { entityType: 'asc' },
        },
      },
    });

    const isLocked = Boolean(
      checkpoint.lockedUntil && checkpoint.lockedUntil > new Date() && checkpoint.workerId,
    );

    return {
      isConfigured: this.syncClient.isConfigured(),
      checkpointId: checkpoint.id,
      snapshotStatus: checkpoint.snapshotStatus,
      snapshotId: checkpoint.snapshotId,
      feedCursor: checkpoint.feedCursor,
      lastSnapshotAt: checkpoint.lastSnapshotAt,
      lastIncrementalAt: checkpoint.lastIncrementalAt,
      lastSuccessAt: checkpoint.lastSuccessAt,
      lastFailureAt: checkpoint.lastFailureAt,
      lastError: checkpoint.lastError,
      totalApplied: checkpoint.appliedCount,
      totalSkipped: checkpoint.skippedCount,
      totalFailed: checkpoint.failedCount,
      isLocked,
      workerId: checkpoint.workerId,
      lockedUntil: checkpoint.lockedUntil,
      entityStates: checkpoint.entityStates.map((s) => ({
        entityType: s.entityType,
        status: s.status,
        recordCount: s.recordCount,
        lastCompletedCursor: s.lastCompletedCursor,
        updatedAt: s.updatedAt,
      })),
    };
  }

  async executeSnapshot(options?: {
    forceFull?: boolean;
    batchSize?: number;
  }): Promise<SyncResult> {
    const workerId = `snapshot-worker-${randomUUID()}`;
    const startTime = Date.now();
    let processedCount = 0;
    let appliedCount = 0;
    let skippedCount = 0;

    await this.acquireLock(workerId);
    this.logger.log(`Acquired sync lock as ${workerId} for initial/resumed snapshot`);

    try {
      const manifest = await this.syncClient.fetchManifest();
      const batchSize = options?.batchSize ?? 100;

      if (options?.forceFull) {
        await this.database.referenceSyncEntityState.deleteMany({
          where: { checkpointId: DEFAULT_CHECKPOINT_ID },
        });
        await this.database.referenceSyncCheckpoint.update({
          where: { id: DEFAULT_CHECKPOINT_ID },
          data: { snapshotStatus: 'IN_PROGRESS' },
        });
      }

      for (const entityType of SYNCHRONIZATION_ORDER) {
        let entityState = await this.database.referenceSyncEntityState.findUnique({
          where: {
            checkpointId_entityType: {
              checkpointId: DEFAULT_CHECKPOINT_ID,
              entityType,
            },
          },
        });

        if (!entityState) {
          entityState = await this.database.referenceSyncEntityState.create({
            data: {
              checkpointId: DEFAULT_CHECKPOINT_ID,
              entityType,
              status: 'IN_PROGRESS',
              recordCount: 0,
            },
          });
        }

        if (entityState.status === 'COMPLETED' && !options?.forceFull) {
          this.logger.debug(`Entity ${entityType} already completed, skipping`);
          continue;
        }

        let cursor: string | null = entityState.lastCompletedCursor;
        let hasMore = true;

        this.logger.log(`Starting snapshot for ${entityType} from cursor ${cursor ?? 'BEGIN'}`);

        while (hasMore) {
          const page = await this.syncClient.fetchSnapshotPage(entityType, cursor, batchSize);

          if (page.items.length > 0) {
            await this.database.$transaction(
              async (tx) => {
                for (const item of page.items) {
                  const outcome = await this.upserter.upsertRecord(
                    tx,
                    entityType,
                    item as Record<string, any>,
                  );
                  if (outcome === 'APPLIED') appliedCount++;
                  else skippedCount++;
                  processedCount++;
                }

                const lastId = (page.items[page.items.length - 1] as any).id;
                await tx.referenceSyncEntityState.update({
                  where: {
                    checkpointId_entityType: {
                      checkpointId: DEFAULT_CHECKPOINT_ID,
                      entityType,
                    },
                  },
                  data: {
                    lastCompletedCursor: lastId,
                    recordCount: { increment: page.items.length },
                    status: page.hasMore ? 'IN_PROGRESS' : 'COMPLETED',
                  },
                });
              },
              { timeout: 60_000 },
            );
          } else {
            await this.database.referenceSyncEntityState.update({
              where: {
                checkpointId_entityType: {
                  checkpointId: DEFAULT_CHECKPOINT_ID,
                  entityType,
                },
              },
              data: { status: 'COMPLETED' },
            });
          }

          hasMore = page.hasMore;
          cursor = page.nextCursor;
        }

        this.logger.log(`Completed snapshot for ${entityType}`);
      }

      const completedAt = new Date();
      await this.database.referenceSyncCheckpoint.update({
        where: { id: DEFAULT_CHECKPOINT_ID },
        data: {
          snapshotStatus: 'COMPLETED',
          snapshotId: manifest.serverTime,
          feedCursor: manifest.serverTime,
          lastSnapshotAt: completedAt,
          lastSuccessAt: completedAt,
          lastError: null,
          appliedCount: { increment: appliedCount },
          skippedCount: { increment: skippedCount },
        },
      });

      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'SNAPSHOT',
          status: 'SUCCESS',
          completedAt,
          recordsProcessed: processedCount,
          recordsApplied: appliedCount,
          recordsSkipped: skippedCount,
          cursorAfter: manifest.serverTime,
        },
      });

      return {
        syncType: 'SNAPSHOT',
        status: 'SUCCESS',
        processedCount,
        appliedCount,
        skippedCount,
        cursorAfter: manifest.serverTime,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error(`Snapshot sync failed: ${err.message}`, err.stack);
      await this.database.referenceSyncCheckpoint.update({
        where: { id: DEFAULT_CHECKPOINT_ID },
        data: {
          lastFailureAt: new Date(),
          lastError: err.message,
          failedCount: { increment: 1 },
        },
      });

      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'SNAPSHOT',
          status: 'FAILED',
          completedAt: new Date(),
          recordsProcessed: processedCount,
          recordsApplied: appliedCount,
          recordsSkipped: skippedCount,
          error: err.message,
        },
      });

      throw err;
    } finally {
      await this.releaseLock(workerId);
    }
  }

  async executeIncrementalSync(options?: { batchSize?: number }): Promise<SyncResult> {
    const workerId = `incremental-worker-${randomUUID()}`;
    const startTime = Date.now();
    let processedCount = 0;
    let appliedCount = 0;
    let skippedCount = 0;

    await this.acquireLock(workerId);

    try {
      const checkpoint = await this.database.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });

      if (checkpoint.snapshotStatus !== 'COMPLETED') {
        this.logger.warn('Initial snapshot not completed. Initiating snapshot first.');
        await this.releaseLock(workerId);
        return this.executeSnapshot();
      }

      let currentCursor = checkpoint.feedCursor;
      const initialCursor = currentCursor;
      let hasMore = true;
      const batchSize = options?.batchSize ?? 100;

      while (hasMore) {
        const feed = await this.syncClient.fetchChangeFeed(currentCursor, batchSize);

        if (feed.changes.length === 0) {
          hasMore = false;
          break;
        }

        await this.database.$transaction(
          async (tx) => {
            for (const change of feed.changes) {
              if (change.operation === 'ARCHIVE') {
                await this.upserter.archiveRecord(tx, change.entityType, change.entityId);
                appliedCount++;
              } else {
                const outcome = await this.upserter.upsertRecord(
                  tx,
                  change.entityType,
                  change.data,
                );
                if (outcome === 'APPLIED') appliedCount++;
                else skippedCount++;
              }
              processedCount++;
            }

            const nextCursor = feed.nextCursor ?? feed.serverTime;
            await tx.referenceSyncCheckpoint.update({
              where: { id: DEFAULT_CHECKPOINT_ID },
              data: {
                feedCursor: nextCursor,
                lastIncrementalAt: new Date(),
                lastSuccessAt: new Date(),
                lastError: null,
                appliedCount: { increment: appliedCount },
                skippedCount: { increment: skippedCount },
              },
            });
          },
          { timeout: 60_000 },
        );

        currentCursor = feed.nextCursor;
        hasMore = feed.hasMore && Boolean(feed.nextCursor);
      }

      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'INCREMENTAL',
          status: 'SUCCESS',
          completedAt: new Date(),
          cursorBefore: initialCursor,
          cursorAfter: currentCursor,
          recordsProcessed: processedCount,
          recordsApplied: appliedCount,
          recordsSkipped: skippedCount,
        },
      });

      return {
        syncType: 'INCREMENTAL',
        status: 'SUCCESS',
        processedCount,
        appliedCount,
        skippedCount,
        cursorBefore: initialCursor,
        cursorAfter: currentCursor,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error(`Incremental sync failed: ${err.message}`, err.stack);
      await this.database.referenceSyncCheckpoint.update({
        where: { id: DEFAULT_CHECKPOINT_ID },
        data: {
          lastFailureAt: new Date(),
          lastError: err.message,
          failedCount: { increment: 1 },
        },
      });

      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'INCREMENTAL',
          status: 'FAILED',
          completedAt: new Date(),
          recordsProcessed: processedCount,
          recordsApplied: appliedCount,
          recordsSkipped: skippedCount,
          error: err.message,
        },
      });

      throw err;
    } finally {
      await this.releaseLock(workerId);
    }
  }

  async executeReconciliation(): Promise<{
    reconciledEntities: Record<string, { remoteCount: number; localCount: number; repaired: number }>;
    durationMs: number;
  }> {
    const workerId = `reconciliation-worker-${randomUUID()}`;
    const startTime = Date.now();
    await this.acquireLock(workerId);

    const reconciledEntities: Record<
      string,
      { remoteCount: number; localCount: number; repaired: number }
    > = {};

    try {
      const manifest = await this.syncClient.fetchManifest();

      for (const entityType of SYNCHRONIZATION_ORDER) {
        const remoteManifest = manifest.entities[entityType];
        if (!remoteManifest) continue;

        const localCount = await this.getLocalEntityCount(entityType);
        let repaired = 0;

        if (localCount !== remoteManifest.count) {
          this.logger.warn(
            `Count drift for ${entityType}: remote=${remoteManifest.count}, local=${localCount}. Reconciling...`,
          );

          let cursor: string | null = null;
          let hasMore = true;

          while (hasMore) {
            const page: CanonicalSnapshotPageResponse =
              await this.syncClient.fetchSnapshotPage(entityType, cursor, 100);
            if (page.items.length > 0) {
              await this.database.$transaction(async (tx) => {
                for (const item of page.items) {
                  await this.upserter.upsertRecord(
                    tx,
                    entityType,
                    item as Record<string, any>,
                  );
                  repaired++;
                }
              });
            }
            hasMore = page.hasMore;
            cursor = page.nextCursor;
          }
        }

        reconciledEntities[entityType] = {
          remoteCount: remoteManifest.count,
          localCount,
          repaired,
        };
      }

      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'RECONCILIATION',
          status: 'SUCCESS',
          completedAt: new Date(),
          details: reconciledEntities,
        },
      });

      return {
        reconciledEntities,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error(`Reconciliation failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      await this.releaseLock(workerId);
    }
  }

  private async getLocalEntityCount(entityType: CanonicalSyncEntityType): Promise<number> {
    switch (entityType) {
      case 'Brand':
        return this.database.brand.count();
      case 'Category':
        return this.database.category.count();
      case 'ProductFamily':
        return this.database.productFamily.count();
      case 'AttributeGroup':
        return this.database.attributeGroup.count();
      case 'AttributeUnit':
        return this.database.attributeUnit.count();
      case 'AttributeDefinition':
        return this.database.attributeDefinition.count();
      case 'AttributeAllowedValue':
        return this.database.attributeAllowedValue.count();
      case 'ProductType':
        return this.database.productType.count();
      case 'ProductTypeAttributeAssignment':
        return this.database.productTypeAttributeAssignment.count();
      case 'ProductTypeSchemaVersion':
        return this.database.productTypeSchemaVersion.count();
      case 'VehicleMake':
        return this.database.vehicleMake.count();
      case 'VehicleModel':
        return this.database.vehicleModel.count();
      case 'VehicleGenerationFamily':
        return this.database.vehicleGenerationFamily.count();
      case 'VehicleGeneration':
        return this.database.vehicleGeneration.count();
      case 'VehicleTrim':
        return this.database.vehicleTrim.count();
      case 'VehicleEngine':
        return this.database.vehicleEngine.count();
      case 'VehicleTransmission':
        return this.database.vehicleTransmission.count();
      case 'VehicleBodyType':
        return this.database.vehicleBodyType.count();
      case 'VehicleMarket':
        return this.database.vehicleMarket.count();
      case 'VehicleConfiguration':
        return this.database.vehicleConfiguration.count();
      default:
        return 0;
    }
  }
}
