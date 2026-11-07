-- Transactional, resumable verification of the source's frozen wire payload.
-- Retains old checkpoints/history; unknown legacy in-progress snapshots are
-- refreshed safely rather than trusted without an integrity proof.
ALTER TABLE "reference_sync_checkpoints"
  ADD COLUMN "snapshot_content_sha256" VARCHAR(64),
  ADD COLUMN "snapshot_applied_digest" VARCHAR(64);
