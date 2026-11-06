-- ATD-07: isolate AutotechDoc suggested-schema v3 from marketplace Article schema.
-- Additive, no mutation or deletion of existing commercial schema history.
CREATE TABLE "reference_sync_canonical_product_type_schemas" (
  "id" UUID NOT NULL,
  "product_type_id" UUID NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "schema_hash" CHAR(64) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reference_sync_canonical_product_type_schemas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reference_sync_canonical_product_type_schemas_product_type_id_schema_version_key"
ON "reference_sync_canonical_product_type_schemas" ("product_type_id", "schema_version");
CREATE INDEX "reference_sync_canonical_product_type_schemas_product_type_id_active_schema_version_idx"
ON "reference_sync_canonical_product_type_schemas" ("product_type_id", "active", "schema_version");
ALTER TABLE "reference_sync_canonical_product_type_schemas"
ADD CONSTRAINT "reference_sync_canonical_product_type_schemas_product_type_id_fkey"
FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
