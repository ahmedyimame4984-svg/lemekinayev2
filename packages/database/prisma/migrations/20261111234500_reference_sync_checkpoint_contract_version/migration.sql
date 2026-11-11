-- Forward-only v2.1 snapshot/checkpoint contract pinning.
-- Legacy checkpoints are explicitly 2.0.0 and require safe 30-entity resnapshot.
ALTER TABLE "reference_sync_checkpoints"
  ADD COLUMN "contract_version" VARCHAR(12) NOT NULL DEFAULT '2.0.0';
