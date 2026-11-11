import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AutotechdocSyncClient, SnapshotExpiredError } from './autotechdoc-sync-client.js';
import { ReferenceDataUpserter } from './reference-data-upserter.js';
import { INITIAL_SNAPSHOT_DIGEST, extendSnapshotDigest } from './canonical-snapshot-integrity.js';
import {
  CanonicalSnapshotCheckpoint,
  CanonicalSnapshotPageResponse,
  CanonicalChangeFeedResponse,
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
    try {
      const existing = await this.database.referenceSyncCheckpoint.findUnique({
        where: { id: DEFAULT_CHECKPOINT_ID },
        select: { id: true },
      });
      if (existing) {
        return;
      }

      await this.database.referenceSyncCheckpoint.upsert({
        where: { id: DEFAULT_CHECKPOINT_ID },
        create: {
          id: DEFAULT_CHECKPOINT_ID,
          snapshotStatus: 'NOT_STARTED',
        },
        update: {},
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        // Concurrent initialization race condition: already created by another request
        return;
      }
      throw err;
    }
  }

  async getSchedule(): Promise<{ enabled: boolean; intervalMinutes: number }> {
    await this.ensureCheckpoint();
    const state = await this.database.referenceSyncCheckpoint.findUniqueOrThrow({
      where: { id: DEFAULT_CHECKPOINT_ID },
      select: { scheduleEnabled: true, intervalMinutes: true },
    });
    return { enabled: state.scheduleEnabled, intervalMinutes: state.intervalMinutes };
  }

  async updateSchedule(input: { enabled: boolean; intervalMinutes: number }): Promise<{ enabled: boolean; intervalMinutes: number }> {
    if (!Number.isInteger(input.intervalMinutes) || input.intervalMinutes < 1 || input.intervalMinutes > 1440) {
      throw new BadRequestException('Interval must be between 1 and 1440 minutes');
    }
    await this.ensureCheckpoint();
    const state = await this.database.referenceSyncCheckpoint.update({
      where: { id: DEFAULT_CHECKPOINT_ID },
      data: { scheduleEnabled: input.enabled, intervalMinutes: input.intervalMinutes },
    });
    this.logger.log(`Administrator updated reference synchronization schedule: enabled=${state.scheduleEnabled}, interval=${state.intervalMinutes} minutes`);
    return { enabled: state.scheduleEnabled, intervalMinutes: state.intervalMinutes };
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

  private async renewLease(tx: any, workerId: string): Promise<void> {
    const now = new Date();
    const renewed = await tx.referenceSyncCheckpoint.updateMany({
      where: {
        id: DEFAULT_CHECKPOINT_ID,
        workerId,
        lockedUntil: { gt: now },
      },
      data: { lockedUntil: new Date(now.getTime() + LOCK_TTL_MS) },
    });
    if (renewed.count !== 1) {
      throw new ConflictException('Reference synchronization lease expired or ownership changed');
    }
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
      scheduleEnabled: checkpoint.scheduleEnabled,
      intervalMinutes: checkpoint.intervalMinutes,
      checkpointId: checkpoint.id,
      contractVersion: checkpoint.contractVersion,
      snapshotStatus: checkpoint.snapshotStatus,
      snapshotId: checkpoint.snapshotId,
      snapshotThrough: checkpoint.snapshotThrough,
      snapshotRecordCount: checkpoint.snapshotRecordCount,
      snapshotContentSha256: checkpoint.snapshotContentSha256,
      snapshotAppliedDigest: checkpoint.snapshotAppliedDigest,
      snapshotExpiresAt: checkpoint.snapshotExpiresAt,
      batchThrough: checkpoint.batchThrough,
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


  private validateSnapshot(snapshot: CanonicalSnapshotCheckpoint): void {
    if (snapshot.contractVersion !== '2.1.0' || snapshot.productTypeSchemaContract !== 3 ||
        !Array.isArray(snapshot.entityTypes) ||
        snapshot.entityTypes.join(',') !== SYNCHRONIZATION_ORDER.join(',') ||
        !/^(?:0|[1-9][0-9]*)$/u.test(snapshot.through) ||
        !snapshot.snapshotId || !/^[a-f0-9]{64}$/u.test(snapshot.contentSha256 ?? '') ||
        !Number.isSafeInteger(snapshot.recordCount) ||
        snapshot.recordCount < 0 || !Number.isFinite(Date.parse(snapshot.expiresAt)) ||
        Date.parse(snapshot.expiresAt) <= Date.now()) {
      throw new ServiceUnavailableException('Incompatible or expired ATD-06 v2 frozen snapshot contract');
    }
  }

  private assertPage(
    snapshot: CanonicalSnapshotCheckpoint,
    entityType: CanonicalSyncEntityType,
    cursor: string | null,
    page: CanonicalSnapshotPageResponse,
  ): void {
    if (page.contractVersion !== '2.1.0' || page.productTypeSchemaContract !== 3 ||
        page.snapshotId !== snapshot.snapshotId || page.through !== snapshot.through ||
        page.recordCount !== snapshot.recordCount ||
        page.contentSha256 !== snapshot.contentSha256 ||
        page.entityType !== entityType || !Array.isArray(page.items) ||
        !Array.isArray(page.itemSha256) ||
        page.itemSha256.length !== page.items.length ||
        page.items.some((item, index) =>
          page.itemSha256[index] !== extendSnapshotDigest(
            INITIAL_SNAPSHOT_DIGEST, entityType, item,
          )) ||
        !Array.isArray(snapshot.entityTypes) ||
        page.items.some(item => !item || typeof item !== 'object' ||
          typeof (item as { id?: unknown }).id !== 'string') ||
        (page.hasMore && (!page.nextCursor || page.items.length === 0 ||
          page.nextCursor === cursor)) ||
        (!page.hasMore && page.nextCursor !== null) ||
        page.items.some((record, index) => {
          const id = String((record as { id?: unknown }).id);
          const prior = index > 0
            ? String((page.items[index - 1] as { id: string }).id) : cursor;
          return !!prior && id <= prior;
        }) ||
        (page.hasMore && page.nextCursor !==
          String((page.items[page.items.length - 1] as { id: string }).id))) {
      throw new ServiceUnavailableException('AutotechDoc returned an inconsistent v2 snapshot page');
    }
  }

  /**
   * A source-managed row absent from a completed frozen entity page is archived
   * only after that entity's entire snapshot has been applied. Marketplace
   * articles, offers, prices, stock and consumer attribute rules are untouched.
   */
  // Canonical assignment IDs can differ from a pre-existing marketplace
  // assignment with the same Product Type + Attribute composite identity.
  // Preserve that row's commercial overrides and track the actual local key.
  private async localEntityId(
    tx: any, type: CanonicalSyncEntityType, record: Record<string, any>,
  ): Promise<string> {
    if (type !== 'ProductTypeAttributeAssignment') return record.id;
    const row = await tx.productTypeAttributeAssignment.findUniqueOrThrow({
      where: {
        productTypeId_attributeId: {
          productTypeId: record.productTypeId, attributeId: record.attributeId,
        },
      },
      select: { id: true },
    });
    return row.id;
  }

  private async archiveMissingFromSnapshot(
    workerId: string, entityType: CanonicalSyncEntityType, snapshotId: string,
  ): Promise<number> {
    let count = 0;
    while (true) {
      const stale = await this.database.referenceSyncImportedRecord.findMany({
        where: {
          checkpointId: DEFAULT_CHECKPOINT_ID, entityType, active: true,
          OR: [{ snapshotId: { not: snapshotId } }, { snapshotId: null }],
        },
        select: { entityId: true, localEntityId: true },
        take: 100,
      });
      if (stale.length === 0) return count;
      await this.database.$transaction(async tx => {
        await this.renewLease(tx, workerId);
        for (const row of stale) {
          await this.upserter.archiveRecord(tx, entityType, row.localEntityId ?? row.entityId);
          await tx.referenceSyncImportedRecord.update({
            where: { entityType_entityId: { entityType, entityId: row.entityId } },
            data: { active: false },
          });
          count++;
        }
      }, { timeout: 60_000 });
    }
  }

  async executeSnapshot(options?: { forceFull?: boolean; batchSize?: number }): Promise<SyncResult> {
    const workerId = 'snapshot-worker-' + randomUUID();
    const startTime = Date.now();
    let processedCount = 0;
    let appliedCount = 0;
    let skippedCount = 0;
    const batchSize = options?.batchSize ?? 100;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      throw new BadRequestException('Snapshot batch size must be between 1 and 500');
    }
    await this.acquireLock(workerId);
    try {
      for (let renewalAttempt = 0; renewalAttempt < 2; renewalAttempt++) {
        const checkpoint = await this.database.referenceSyncCheckpoint.findUniqueOrThrow({
          where: { id: DEFAULT_CHECKPOINT_ID },
        });
        let snapshot: CanonicalSnapshotCheckpoint;
        const resume = !options?.forceFull && renewalAttempt === 0 &&
          checkpoint.snapshotStatus === 'IN_PROGRESS' &&
          checkpoint.contractVersion === '2.1.0' &&
          checkpoint.snapshotId && checkpoint.snapshotThrough && checkpoint.snapshotExpiresAt &&
          checkpoint.snapshotRecordCount !== null &&
          /^[a-f0-9]{64}$/u.test(checkpoint.snapshotContentSha256 ?? '') &&
          /^[a-f0-9]{64}$/u.test(checkpoint.snapshotAppliedDigest ?? '') &&
          checkpoint.snapshotExpiresAt.getTime() > Date.now();
        if (resume) {
          snapshot = {
            snapshotId: checkpoint.snapshotId!,
            through: checkpoint.snapshotThrough!,
            expiresAt: checkpoint.snapshotExpiresAt!.toISOString(),
            contractVersion: '2.1.0',
            productTypeSchemaContract: 3,
            entityTypes: [...SYNCHRONIZATION_ORDER],
            recordCount: checkpoint.snapshotRecordCount!,
            contentSha256: checkpoint.snapshotContentSha256!,
          };
        } else {
          snapshot = await this.syncClient.createSnapshot();
          this.validateSnapshot(snapshot);
          await this.database.$transaction(async tx => {
            await this.renewLease(tx, workerId);
            await tx.referenceSyncEntityState.deleteMany({
              where: { checkpointId: DEFAULT_CHECKPOINT_ID },
            });
            await tx.referenceSyncCheckpoint.update({
              where: { id: DEFAULT_CHECKPOINT_ID },
              data: {
                snapshotStatus: 'IN_PROGRESS',
                contractVersion: snapshot.contractVersion,
                snapshotId: snapshot.snapshotId,
                snapshotThrough: snapshot.through,
                snapshotRecordCount: snapshot.recordCount,
                snapshotContentSha256: snapshot.contentSha256,
                snapshotAppliedDigest: INITIAL_SNAPSHOT_DIGEST,
                snapshotExpiresAt: new Date(snapshot.expiresAt),
                // Keep the last healthy feed cursor until the full import commits.
                batchThrough: null,
              },
            });
          });
        }
        this.validateSnapshot(snapshot);
        // Resume the exact persisted chain alongside page cursors; a failed
        // transaction never advances the digest independently of imported rows.
        let appliedDigest = resume
          ? checkpoint.snapshotAppliedDigest! : INITIAL_SNAPSHOT_DIGEST;
        try {
          for (const entityType of SYNCHRONIZATION_ORDER) {
            let state = await this.database.referenceSyncEntityState.findUnique({
              where: {
                checkpointId_entityType: { checkpointId: DEFAULT_CHECKPOINT_ID, entityType },
              },
            });
            if (state?.status === 'COMPLETED') continue;
            if (!state) {
              state = await this.database.referenceSyncEntityState.create({
                data: { checkpointId: DEFAULT_CHECKPOINT_ID, entityType, status: 'IN_PROGRESS' },
              });
            }
            let cursor = state.lastCompletedCursor;
            while (true) {
              const page = await this.syncClient.fetchSnapshotPage(snapshot.snapshotId, entityType, cursor, batchSize);
              this.assertPage(snapshot, entityType, cursor, page);
              const nextDigest = page.items.reduce(
                (hash, item) => extendSnapshotDigest(hash, entityType, item),
                appliedDigest,
              );
              await this.database.$transaction(async tx => {
                await this.renewLease(tx, workerId);
                for (const item of page.items) {
                  const record = item as Record<string, any>;
                  const outcome = await this.upserter.upsertRecord(tx, entityType, record);
                  if (outcome === 'APPLIED') appliedCount++;
                  else skippedCount++;
                  processedCount++;
                  const localEntityId = await this.localEntityId(tx, entityType, record);
                  await tx.referenceSyncImportedRecord.upsert({
                    where: { entityType_entityId: { entityType, entityId: record.id } },
                    create: {
                      checkpointId: DEFAULT_CHECKPOINT_ID, entityType, entityId: record.id,
                      snapshotId: snapshot.snapshotId, active: true, localEntityId,
                    },
                    update: { snapshotId: snapshot.snapshotId, active: true, localEntityId },
                  });
                }
                await tx.referenceSyncEntityState.update({
                  where: {
                    checkpointId_entityType: { checkpointId: DEFAULT_CHECKPOINT_ID, entityType },
                  },
                  data: {
                    lastCompletedCursor: page.nextCursor ??
                      (page.items.length > 0 ? String((page.items[page.items.length - 1] as any).id) : cursor),
                    recordCount: { increment: page.items.length },
                    // Completion waits until missing previous source records are archived.
                    status: 'IN_PROGRESS',
                  },
                });
                await tx.referenceSyncCheckpoint.update({
                  where: { id: DEFAULT_CHECKPOINT_ID },
                  data: { snapshotAppliedDigest: nextDigest },
                });
              }, { timeout: 60_000 });
              appliedDigest = nextDigest;
              if (!page.hasMore) break;
              cursor = page.nextCursor;
            }
            // Mark page ingestion complete; do not retire previously published
            // identities until the entire frozen source row count is verified.
            await this.database.$transaction(async tx => {
              await this.renewLease(tx, workerId);
              await tx.referenceSyncEntityState.update({
                where: { checkpointId_entityType: { checkpointId: DEFAULT_CHECKPOINT_ID, entityType } },
                data: { status: 'COMPLETED' },
              });
            });
          }
          // A corrupt or truncated replacement snapshot must not archive
          // previously valid local references. Page counts are persisted with
          // each entity checkpoint so this also covers resumed imports.
          const completedStates = await this.database.referenceSyncEntityState.findMany({
            where: { checkpointId: DEFAULT_CHECKPOINT_ID },
            select: { entityType: true, recordCount: true, status: true },
          });
          const frozenPageCount = completedStates.reduce((sum, state) => sum + state.recordCount, 0);
          if (completedStates.length !== SYNCHRONIZATION_ORDER.length ||
              completedStates.some(state => state.status !== 'COMPLETED') ||
              !Number.isSafeInteger(frozenPageCount) || frozenPageCount !== snapshot.recordCount) {
            throw new ServiceUnavailableException(
              'Frozen snapshot count mismatch: expected ' + snapshot.recordCount +
              ', paged ' + frozenPageCount + '; existing references were not archived',
            );
          }

          if (appliedDigest !== snapshot.contentSha256) {
            throw new ServiceUnavailableException(
              'Frozen snapshot content SHA-256 mismatch; refusing archival and feed checkpoint advancement',
            );
          }

          // Only after all 29 entity streams pass the frozen count proof may
          // absent source-managed references be archived. Retrying after a
          // crash remains idempotent, and commercial records are never deleted.
          for (const entityType of SYNCHRONIZATION_ORDER) {
            appliedCount += await this.archiveMissingFromSnapshot(workerId, entityType, snapshot.snapshotId);
          }

          // Confirm the final active imported identity count after archival,
          // before replacing the durable incremental replay cursor.
          const actualCount = await this.database.referenceSyncImportedRecord.count({
            where: {
              checkpointId: DEFAULT_CHECKPOINT_ID,
              snapshotId: snapshot.snapshotId,
              active: true,
            },
          });
          if (actualCount !== snapshot.recordCount) {
            throw new ServiceUnavailableException(
              'Frozen snapshot count mismatch: expected ' + snapshot.recordCount +
              ', imported ' + actualCount + '; feed checkpoint was not advanced',
            );
          }
          const completedAt = new Date();
          await this.database.$transaction(async tx => {
            await this.renewLease(tx, workerId);
            await tx.referenceSyncCheckpoint.update({
              where: { id: DEFAULT_CHECKPOINT_ID },
              data: {
                snapshotStatus: 'COMPLETED',
                feedCursor: snapshot.through,
                batchThrough: null,
                lastSnapshotAt: completedAt,
                lastSuccessAt: completedAt,
                lastError: null,
                appliedCount: { increment: appliedCount },
                skippedCount: { increment: skippedCount },
              },
            });
          });
          await this.database.referenceSyncLog.create({
            data: {
              syncType: 'SNAPSHOT', status: 'SUCCESS', completedAt,
              recordsProcessed: processedCount, recordsApplied: appliedCount,
              recordsSkipped: skippedCount, cursorAfter: snapshot.through,
            },
          });
          return {
            syncType: 'SNAPSHOT', status: 'SUCCESS', processedCount, appliedCount,
            skippedCount, cursorAfter: snapshot.through, durationMs: Date.now() - startTime,
          };
        } catch (error) {
          if (error instanceof SnapshotExpiredError && renewalAttempt === 0) {
            this.logger.warn('Frozen snapshot expired; discarding incomplete page cursors and resnapshotting');
            continue;
          }
          throw error;
        }
      }
      throw new ServiceUnavailableException('Frozen snapshot expired repeatedly');
    } catch (err: any) {
      this.logger.error('Snapshot sync failed: ' + err.message);
      await this.database.referenceSyncCheckpoint.update({
        where: { id: DEFAULT_CHECKPOINT_ID },
        data: { lastFailureAt: new Date(), lastError: err.message, failedCount: { increment: 1 } },
      });
      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'SNAPSHOT', status: 'FAILED', completedAt: new Date(),
          recordsProcessed: processedCount, recordsApplied: appliedCount,
          recordsSkipped: skippedCount, error: err.message,
        },
      });
      throw err;
    } finally {
      await this.releaseLock(workerId);
    }
  }

  private assertFeed(feed: CanonicalChangeFeedResponse, after: string, through: string | null): void {
    if (feed.contractVersion !== '2.1.0' || feed.productTypeSchemaContract !== 3 ||
        !/^(?:0|[1-9][0-9]*)$/u.test(feed.nextCursor) ||
        !/^(?:0|[1-9][0-9]*)$/u.test(feed.through) ||
        (through !== null && through !== feed.through) ||
        BigInt(feed.nextCursor) < BigInt(after) ||
        BigInt(feed.nextCursor) > BigInt(feed.through) ||
        !Array.isArray(feed.changes)) {
      throw new ServiceUnavailableException('Invalid ATD-06 v2 committed feed cursor or contract');
    }
    let previous = BigInt(after);
    for (const change of feed.changes) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(change.sequence) ||
          BigInt(change.sequence) <= previous ||
          BigInt(change.sequence) > BigInt(feed.nextCursor) ||
          !(SYNCHRONIZATION_ORDER as readonly string[]).includes(change.entityType) ||
          !['UPSERT', 'ARCHIVE'].includes(change.operation) ||
          (change.operation === 'UPSERT' &&
            (!change.data || change.data.id !== change.entityId))) {
        throw new ServiceUnavailableException('Non-monotonic, unsafe or malformed AutotechDoc journal event');
      }
      previous = BigInt(change.sequence);
    }
    if (feed.hasMore && BigInt(feed.nextCursor) <= BigInt(after)) {
      throw new ServiceUnavailableException('AutotechDoc v2 feed did not advance a nonfinal page');
    }
  }

  async executeIncrementalSync(options?: { batchSize?: number }): Promise<SyncResult> {
    const workerId = 'incremental-worker-' + randomUUID();
    const startTime = Date.now();
    let processedCount = 0;
    let appliedCount = 0;
    let skippedCount = 0;
    const batchSize = options?.batchSize ?? 100;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      throw new BadRequestException('Incremental batch size must be between 1 and 500');
    }
    await this.acquireLock(workerId);
    try {
      const checkpoint = await this.database.referenceSyncCheckpoint.findUniqueOrThrow({
        where: { id: DEFAULT_CHECKPOINT_ID },
      });
      if (checkpoint.contractVersion !== '2.1.0' ||
          checkpoint.snapshotStatus !== 'COMPLETED' || !checkpoint.feedCursor ||
          !/^(?:0|[1-9][0-9]*)$/u.test(checkpoint.feedCursor)) {
        // Includes pre-v2 timestamp checkpoints: never try to replay them as
        // numeric sequences, and never discard prior marketplace customizations.
        await this.releaseLock(workerId);
        return this.executeSnapshot({
          // A v2.0.0 29-entity checkpoint is not proof that the v2.1
          // manufacturer-rule mirror has ever been imported. Rebootstrap
          // the full 30-entity snapshot before any incremental cursor moves.
          forceFull: checkpoint.contractVersion !== '2.1.0' ||
            checkpoint.snapshotStatus === 'COMPLETED',
          batchSize,
        });
      }
      let currentCursor = checkpoint.feedCursor;
      const initialCursor = currentCursor;
      let through = checkpoint.batchThrough ?? null;
      let hasMore = true;
      do {
        const feed = await this.syncClient.fetchChangeFeed(currentCursor, through, batchSize);
        this.assertFeed(feed, currentCursor, through);
        let pageApplied = 0;
        let pageSkipped = 0;
        await this.database.$transaction(async tx => {
          await this.renewLease(tx, workerId);
          for (const change of feed.changes) {
            if (change.operation === 'ARCHIVE') {
              const imported = change.entityType === 'ProductTypeAttributeAssignment'
                ? await tx.referenceSyncImportedRecord.findUnique({
                    where: {
                      entityType_entityId: {
                        entityType: change.entityType, entityId: change.entityId,
                      },
                    },
                    select: { localEntityId: true },
                  })
                : null;
              const localEntityId = imported?.localEntityId ?? change.entityId;
              await this.upserter.archiveRecord(tx, change.entityType, localEntityId);
              pageApplied++;
              await tx.referenceSyncImportedRecord.upsert({
                where: { entityType_entityId: { entityType: change.entityType, entityId: change.entityId } },
                create: {
                  checkpointId: DEFAULT_CHECKPOINT_ID, entityType: change.entityType,
                  entityId: change.entityId, localEntityId, active: false, lastSequence: change.sequence,
                },
                update: { active: false, localEntityId, lastSequence: change.sequence },
              });
            } else {
              const outcome = await this.upserter.upsertRecord(tx, change.entityType, change.data);
              if (outcome === 'APPLIED') pageApplied++;
              else pageSkipped++;
              const localEntityId = await this.localEntityId(tx, change.entityType, change.data);
              await tx.referenceSyncImportedRecord.upsert({
                where: { entityType_entityId: { entityType: change.entityType, entityId: change.entityId } },
                create: {
                  checkpointId: DEFAULT_CHECKPOINT_ID, entityType: change.entityType,
                  entityId: change.entityId, localEntityId, active: true, lastSequence: change.sequence,
                },
                update: { active: true, localEntityId, lastSequence: change.sequence },
              });
            }
          }
          await tx.referenceSyncCheckpoint.update({
            where: { id: DEFAULT_CHECKPOINT_ID },
            data: {
              feedCursor: feed.nextCursor,
              batchThrough: feed.hasMore ? feed.through : null,
              lastIncrementalAt: new Date(), lastSuccessAt: new Date(), lastError: null,
              appliedCount: { increment: pageApplied }, skippedCount: { increment: pageSkipped },
            },
          });
        }, { timeout: 60_000 });
        currentCursor = feed.nextCursor;
        through = feed.hasMore ? feed.through : null;
        hasMore = feed.hasMore;
        appliedCount += pageApplied;
        skippedCount += pageSkipped;
        processedCount += feed.changes.length;
      } while (hasMore);
      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'INCREMENTAL', status: 'SUCCESS', completedAt: new Date(),
          cursorBefore: initialCursor, cursorAfter: currentCursor,
          recordsProcessed: processedCount, recordsApplied: appliedCount, recordsSkipped: skippedCount,
        },
      });
      return {
        syncType: 'INCREMENTAL', status: 'SUCCESS', processedCount,
        appliedCount, skippedCount, cursorBefore: initialCursor,
        cursorAfter: currentCursor, durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error('Incremental sync failed: ' + err.message);
      await this.database.referenceSyncCheckpoint.update({
        where: { id: DEFAULT_CHECKPOINT_ID },
        data: { lastFailureAt: new Date(), lastError: err.message, failedCount: { increment: 1 } },
      });
      await this.database.referenceSyncLog.create({
        data: {
          syncType: 'INCREMENTAL', status: 'FAILED', completedAt: new Date(),
          recordsProcessed: processedCount, recordsApplied: appliedCount,
          recordsSkipped: skippedCount, error: err.message,
        },
      });
      throw err;
    } finally {
      await this.releaseLock(workerId);
    }
  }

  /** Reconciliation is a new frozen snapshot, not a timestamp-derived manifest. */
  async executeReconciliation(): Promise<{
    reconciledEntities: Record<string, { remoteCount: number; localCount: number; repaired: number }>;
    durationMs: number;
  }> {
    const start = Date.now();
    const before = await this.getStatus();
    await this.executeSnapshot({ forceFull: true });
    const after = await this.getStatus();
    const reconciledEntities: Record<string, { remoteCount: number; localCount: number; repaired: number }> = {};
    for (const state of after.entityStates) {
      const type = state.entityType as CanonicalSyncEntityType;
      const previouslyImported = before.entityStates.find(row => row.entityType === type)?.recordCount ?? 0;
      reconciledEntities[type] = {
        remoteCount: state.recordCount,
        localCount: previouslyImported,
        repaired: Math.max(0, state.recordCount - previouslyImported),
      };
    }
    return { reconciledEntities, durationMs: Date.now() - start };
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
      case 'VehicleIdentifierRule':
        return this.database.referenceSyncVehicleIdentifierRule.count();
      default:
        return 0;
    }
  }
}
