-- Article Identity & Content V2
-- GTIN/trade identifiers are first-class Manufacturer Article data.
-- OE/reference numbers remain in part_numbers because they carry issuer/reference semantics.

CREATE TYPE "ArticleIdentifierType" AS ENUM (
  'GTIN_8',
  'GTIN_12',
  'GTIN_13',
  'GTIN_14',
  'TRADE_NUMBER'
);

ALTER TABLE "products"
  ADD COLUMN "short_description" VARCHAR(500),
  ADD COLUMN "manufacturer_notes" TEXT;

CREATE TABLE "article_identifiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "identifier_type" "ArticleIdentifierType" NOT NULL,
  "value" VARCHAR(160) NOT NULL,
  "raw_value" VARCHAR(200),
  "normalized_value" VARCHAR(160) NOT NULL,
  "global_identity_key" VARCHAR(180),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "article_identifiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "article_identifiers_version_check" CHECK ("version" > 0),
  CONSTRAINT "article_identifiers_gtin_digits_check" CHECK (
    "identifier_type" = 'TRADE_NUMBER'
    OR "normalized_value" ~ '^[0-9]+$'
  ),
  CONSTRAINT "article_identifiers_gtin_length_check" CHECK (
    ("identifier_type" = 'TRADE_NUMBER')
    OR ("identifier_type" = 'GTIN_8' AND char_length("normalized_value") = 8)
    OR ("identifier_type" = 'GTIN_12' AND char_length("normalized_value") = 12)
    OR ("identifier_type" = 'GTIN_13' AND char_length("normalized_value") = 13)
    OR ("identifier_type" = 'GTIN_14' AND char_length("normalized_value") = 14)
  ),
  CONSTRAINT "article_identifiers_global_key_semantics_check" CHECK (
    ("identifier_type" = 'TRADE_NUMBER' AND "global_identity_key" IS NULL)
    OR ("identifier_type" <> 'TRADE_NUMBER' AND "global_identity_key" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "article_identifiers_global_identity_key_key"
ON "article_identifiers"("global_identity_key");

CREATE UNIQUE INDEX "article_identifiers_product_id_identifier_type_normalized_value_key"
ON "article_identifiers"("product_id", "identifier_type", "normalized_value");

CREATE INDEX "article_identifiers_normalized_value_identifier_type_status_idx"
ON "article_identifiers"("normalized_value", "identifier_type", "status");

CREATE INDEX "article_identifiers_product_id_identifier_type_status_idx"
ON "article_identifiers"("product_id", "identifier_type", "status");

ALTER TABLE "article_identifiers"
ADD CONSTRAINT "article_identifiers_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "article_identifiers"
ADD CONSTRAINT "article_identifiers_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "article_identifiers"
ADD CONSTRAINT "article_identifiers_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
