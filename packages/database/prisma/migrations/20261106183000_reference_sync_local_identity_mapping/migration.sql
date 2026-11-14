-- Forward-only mapping of upstream identity onto an existing local attribute
-- assignment's UUID. Marketplace-owned assignment flags stay untouched.
ALTER TABLE "reference_sync_imported_records"
 ADD COLUMN "local_entity_id" UUID;
UPDATE "reference_sync_imported_records"
 SET "local_entity_id" = "entity_id"
 WHERE "local_entity_id" IS NULL;
