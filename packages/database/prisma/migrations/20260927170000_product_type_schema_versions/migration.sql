-- CreateTable
CREATE TABLE "product_type_schema_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_type_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "schema_hash" CHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "published_by_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_type_schema_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_type_schema_versions_schema_version_check" CHECK ("schema_version" > 0)
);

-- AlterTable
ALTER TABLE "product_types"
ADD COLUMN "current_schema_version_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "product_type_schema_versions_product_type_id_schema_version_key"
ON "product_type_schema_versions"("product_type_id", "schema_version");

CREATE INDEX "product_type_schema_versions_product_type_id_published_at_idx"
ON "product_type_schema_versions"("product_type_id", "published_at");

CREATE INDEX "product_type_schema_versions_schema_hash_idx"
ON "product_type_schema_versions"("schema_hash");

CREATE UNIQUE INDEX "product_types_current_schema_version_id_key"
ON "product_types"("current_schema_version_id");

-- AddForeignKey
ALTER TABLE "product_type_schema_versions"
ADD CONSTRAINT "product_type_schema_versions_product_type_id_fkey"
FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_schema_versions"
ADD CONSTRAINT "product_type_schema_versions_published_by_id_fkey"
FOREIGN KEY ("published_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_types"
ADD CONSTRAINT "product_types_current_schema_version_id_fkey"
FOREIGN KEY ("current_schema_version_id") REFERENCES "product_type_schema_versions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
