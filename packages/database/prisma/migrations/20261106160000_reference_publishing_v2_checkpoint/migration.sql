-- ATD-07: durable v2 frozen snapshot, committed change batch and imported
-- identity tracking. Additive, non-destructive; only apply to disposable DB in CI.
ALTER TABLE "reference_sync_checkpoints"
  ADD COLUMN "snapshot_through" VARCHAR(30),
  ADD COLUMN "snapshot_expires_at" TIMESTAMP(3),
  ADD COLUMN "batch_through" VARCHAR(30);

CREATE TABLE "reference_sync_imported_records" (
  "entity_type" VARCHAR(60) NOT NULL,
  "entity_id" UUID NOT NULL,
  "checkpoint_id" VARCHAR(60) NOT NULL DEFAULT 'autotechdoc-canonical-sync',
  "snapshot_id" VARCHAR(60),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_sequence" VARCHAR(30),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reference_sync_imported_records_pkey" PRIMARY KEY ("entity_type", "entity_id")
);
CREATE INDEX "reference_sync_imported_records_checkpoint_id_entity_type_snapshot_idx"
 ON "reference_sync_imported_records"("checkpoint_id","entity_type","snapshot_id","active");
ALTER TABLE "reference_sync_imported_records"
 ADD CONSTRAINT "reference_sync_imported_records_checkpoint_id_fkey"
 FOREIGN KEY ("checkpoint_id") REFERENCES "reference_sync_checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
