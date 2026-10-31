-- Professional Manufacturer Article foundation.
-- Admin continues to govern reference/master data only; article provenance is
-- recorded for Seller/manufacturer/import workflows.

CREATE TYPE "ArticleSource" AS ENUM (
  'SELLER_SUBMISSION',
  'MANUFACTURER_SUBMISSION',
  'APPROVED_CATALOG_IMPORT',
  'PLATFORM_MIGRATION'
);

ALTER TABLE "products"
  ADD COLUMN "article_source" "ArticleSource" NOT NULL DEFAULT 'PLATFORM_MIGRATION',
  ADD COLUMN "source_seller_id" UUID,
  ADD COLUMN "source_reference" VARCHAR(200),
  ADD COLUMN "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "published_at" TIMESTAMP(3);

UPDATE "products"
SET "published_at" = "updated_at"
WHERE "status" = 'ACTIVE' AND "published_at" IS NULL;

CREATE INDEX "products_article_source_status_updated_at_idx"
ON "products"("article_source", "status", "updated_at");

CREATE INDEX "products_source_seller_id_status_updated_at_idx"
ON "products"("source_seller_id", "status", "updated_at");

ALTER TABLE "products"
ADD CONSTRAINT "products_source_seller_id_fkey"
FOREIGN KEY ("source_seller_id") REFERENCES "sellers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
