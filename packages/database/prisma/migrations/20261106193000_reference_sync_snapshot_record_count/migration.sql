-- Frozen snapshot identity count is immutable and survives process restarts.
-- Verification occurs before advancing the consumer's committed feed cursor.
ALTER TABLE "reference_sync_checkpoints"
 ADD COLUMN "snapshot_record_count" INTEGER;
