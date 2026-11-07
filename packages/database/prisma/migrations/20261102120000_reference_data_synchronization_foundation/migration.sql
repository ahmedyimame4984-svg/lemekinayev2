-- CreateTable
CREATE TABLE "reference_sync_checkpoints" (
    "id" VARCHAR(60) NOT NULL,
    "snapshot_status" VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    "snapshot_id" VARCHAR(60),
    "feed_cursor" VARCHAR(200),
    "last_snapshot_at" TIMESTAMP(3),
    "last_incremental_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "last_error" TEXT,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "worker_id" VARCHAR(100),
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_sync_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_sync_entity_states" (
    "id" UUID NOT NULL,
    "checkpoint_id" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "last_completed_cursor" VARCHAR(200),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_sync_entity_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_sync_logs" (
    "id" UUID NOT NULL,
    "sync_type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "cursor_before" VARCHAR(200),
    "cursor_after" VARCHAR(200),
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_applied" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "details" JSONB,

    CONSTRAINT "reference_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_sync_entity_states_checkpoint_id_entity_type_key" ON "reference_sync_entity_states"("checkpoint_id", "entity_type");

-- CreateIndex
CREATE INDEX "reference_sync_entity_states_checkpoint_id_status_idx" ON "reference_sync_entity_states"("checkpoint_id", "status");

-- CreateIndex
CREATE INDEX "reference_sync_logs_sync_type_status_started_at_idx" ON "reference_sync_logs"("sync_type", "status", "started_at");

-- AddForeignKey
ALTER TABLE "reference_sync_entity_states" ADD CONSTRAINT "reference_sync_entity_states_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "reference_sync_checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
