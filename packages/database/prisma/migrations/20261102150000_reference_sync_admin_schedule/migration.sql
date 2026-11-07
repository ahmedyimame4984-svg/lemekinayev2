-- Existing checkpoints automatically inherit the default five-minute, all-day schedule.
ALTER TABLE "reference_sync_checkpoints"
  ADD COLUMN "schedule_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "interval_minutes" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "reference_sync_checkpoints"
  ADD CONSTRAINT "reference_sync_interval_minutes_range"
  CHECK ("interval_minutes" BETWEEN 1 AND 1440);
