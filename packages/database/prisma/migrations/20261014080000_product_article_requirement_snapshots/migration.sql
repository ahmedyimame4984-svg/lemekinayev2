-- Product Article policy is frozen from the exact published schema
-- bound to products.schema_version_id, NEVER from the mutable product_types row.
-- Keep historical JSON contracts readable via the documented legacy defaults.
-- Prisma's PostgreSQL runner does not wrap SQL migrations automatically.
-- Roll back every added column if a historical snapshot cannot be backfilled.
BEGIN;

ALTER TABLE "products"
  ADD COLUMN "brand_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "gtin_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "oem_reference_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "cross_reference_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "fitment_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "image_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "document_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "price_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "stock_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "condition_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "warranty_requirement" "ProductTypeRequirementLevel",
  ADD COLUMN "identifier_requirement" "ProductTypeIdentifierRequirement",
  ADD COLUMN "minimum_image_count" INTEGER,
  ADD COLUMN "minimum_document_count" INTEGER;


CREATE FUNCTION validate_article_policy_snapshot(snapshot JSONB) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE section TEXT; policy JSONB; key TEXT;
BEGIN
  IF snapshot IS NULL OR jsonb_typeof(snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Invalid Article schema snapshot';
  END IF;
  FOREACH section IN ARRAY ARRAY['articleRequirements','requirements','offerRequirements'] LOOP
    IF snapshot ? section AND jsonb_typeof(snapshot -> section) <> 'object' THEN
      RAISE EXCEPTION 'Invalid Article requirements section: %', section;
    END IF;
  END LOOP;
  policy := COALESCE(snapshot -> 'articleRequirements', snapshot -> 'requirements', '{}'::jsonb);
  FOREACH key IN ARRAY ARRAY['minimumImageCount','minimumDocumentCount'] LOOP
    IF policy ? key AND policy -> key <> 'null'::jsonb AND policy ->> key <> '' THEN
      IF jsonb_typeof(policy -> key) <> 'number' OR (policy ->> key)::numeric < 0
         OR (policy ->> key)::numeric > 20 OR (policy ->> key)::numeric <> trunc((policy ->> key)::numeric) THEN
        RAISE EXCEPTION 'Invalid Article media count: %', key;
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products p LEFT JOIN product_type_schema_versions s ON s.id=p.schema_version_id
      WHERE s.id IS NULL OR s.product_type_id <> p.product_type_id OR s.published_at IS NULL) THEN
    RAISE EXCEPTION 'Every Article must reference its own Product Type published schema';
  END IF;
  PERFORM validate_article_policy_snapshot(s.snapshot)
    FROM products p JOIN product_type_schema_versions s ON s.id=p.schema_version_id;
END $$;

WITH frozen AS (
  SELECT
    p.id,
    COALESCE(
      CASE WHEN jsonb_typeof(s.snapshot -> 'articleRequirements') = 'object'
        THEN s.snapshot -> 'articleRequirements' END,
      CASE WHEN jsonb_typeof(s.snapshot -> 'requirements') = 'object'
        THEN s.snapshot -> 'requirements' END,
      '{}'::jsonb
    ) AS article,
    COALESCE(
      CASE WHEN jsonb_typeof(s.snapshot -> 'offerRequirements') = 'object'
        THEN s.snapshot -> 'offerRequirements' END,
      '{}'::jsonb
    ) AS offer
  FROM "products" p
  JOIN "product_type_schema_versions" s ON s.id = p.schema_version_id
)
UPDATE "products" p
SET
  "brand_requirement" = COALESCE(NULLIF(f.article ->> 'brand', ''), 'OPTIONAL')::"ProductTypeRequirementLevel",
  "identifier_requirement" = COALESCE(NULLIF(f.article ->> 'identifier', ''), 'ANY_PART_NUMBER')::"ProductTypeIdentifierRequirement",
  "gtin_requirement" = COALESCE(NULLIF(f.article ->> 'gtin', ''), 'OPTIONAL')::"ProductTypeRequirementLevel",
  "oem_reference_requirement" = COALESCE(NULLIF(f.article ->> 'oemReference', ''), 'OPTIONAL')::"ProductTypeRequirementLevel",
  "cross_reference_requirement" = COALESCE(NULLIF(f.article ->> 'crossReference', ''), 'OPTIONAL')::"ProductTypeRequirementLevel",
  "fitment_requirement" = COALESCE(NULLIF(f.article ->> 'fitment', ''), 'REQUIRED')::"ProductTypeRequirementLevel",
  "image_requirement" = COALESCE(NULLIF(f.article ->> 'image', ''), 'REQUIRED')::"ProductTypeRequirementLevel",
  "document_requirement" = COALESCE(NULLIF(f.article ->> 'document', ''), 'OPTIONAL')::"ProductTypeRequirementLevel",
  "price_requirement" = COALESCE(NULLIF(f.offer ->> 'price', ''), 'REQUIRED')::"ProductTypeRequirementLevel",
  "stock_requirement" = COALESCE(NULLIF(f.offer ->> 'stock', ''), 'REQUIRED')::"ProductTypeRequirementLevel",
  "condition_requirement" = COALESCE(NULLIF(f.offer ->> 'condition', ''), 'REQUIRED')::"ProductTypeRequirementLevel",
  "warranty_requirement" = COALESCE(NULLIF(f.offer ->> 'warranty', ''), 'OPTIONAL')::"ProductTypeRequirementLevel",
  "minimum_image_count" = COALESCE(NULLIF(f.article ->> 'minimumImageCount', '')::NUMERIC::INTEGER, CASE WHEN f.article ->> 'image' = 'NOT_APPLICABLE' THEN 0 ELSE 1 END),
  "minimum_document_count" = COALESCE(NULLIF(f.article ->> 'minimumDocumentCount', '')::NUMERIC::INTEGER, 0)
FROM frozen f
WHERE p.id = f.id;

-- Fail rather than leave any Article with a partially populated policy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "products"
    WHERE "brand_requirement" IS NULL OR
       "gtin_requirement" IS NULL OR
       "oem_reference_requirement" IS NULL OR
       "cross_reference_requirement" IS NULL OR
       "fitment_requirement" IS NULL OR
       "image_requirement" IS NULL OR
       "document_requirement" IS NULL OR
       "price_requirement" IS NULL OR
       "stock_requirement" IS NULL OR
       "condition_requirement" IS NULL OR
       "warranty_requirement" IS NULL OR
       "identifier_requirement" IS NULL OR
       "minimum_image_count" IS NULL OR
       "minimum_document_count" IS NULL
  ) THEN
    RAISE EXCEPTION 'Product Article policy backfill incomplete: every Article needs a valid bound schema version';
  END IF;
END $$;

ALTER TABLE "products"
  ALTER COLUMN "brand_requirement" SET NOT NULL,
  ALTER COLUMN "gtin_requirement" SET NOT NULL,
  ALTER COLUMN "oem_reference_requirement" SET NOT NULL,
  ALTER COLUMN "cross_reference_requirement" SET NOT NULL,
  ALTER COLUMN "fitment_requirement" SET NOT NULL,
  ALTER COLUMN "image_requirement" SET NOT NULL,
  ALTER COLUMN "document_requirement" SET NOT NULL,
  ALTER COLUMN "price_requirement" SET NOT NULL,
  ALTER COLUMN "stock_requirement" SET NOT NULL,
  ALTER COLUMN "condition_requirement" SET NOT NULL,
  ALTER COLUMN "warranty_requirement" SET NOT NULL,
  ALTER COLUMN "identifier_requirement" SET NOT NULL,
  ALTER COLUMN "minimum_image_count" SET NOT NULL,
  ALTER COLUMN "minimum_document_count" SET NOT NULL;

ALTER TABLE "products"
  ALTER COLUMN "brand_requirement" SET DEFAULT 'OPTIONAL'::"ProductTypeRequirementLevel",
  ALTER COLUMN "gtin_requirement" SET DEFAULT 'OPTIONAL'::"ProductTypeRequirementLevel",
  ALTER COLUMN "oem_reference_requirement" SET DEFAULT 'OPTIONAL'::"ProductTypeRequirementLevel",
  ALTER COLUMN "cross_reference_requirement" SET DEFAULT 'OPTIONAL'::"ProductTypeRequirementLevel",
  ALTER COLUMN "fitment_requirement" SET DEFAULT 'REQUIRED'::"ProductTypeRequirementLevel",
  ALTER COLUMN "image_requirement" SET DEFAULT 'REQUIRED'::"ProductTypeRequirementLevel",
  ALTER COLUMN "document_requirement" SET DEFAULT 'OPTIONAL'::"ProductTypeRequirementLevel",
  ALTER COLUMN "price_requirement" SET DEFAULT 'REQUIRED'::"ProductTypeRequirementLevel",
  ALTER COLUMN "stock_requirement" SET DEFAULT 'REQUIRED'::"ProductTypeRequirementLevel",
  ALTER COLUMN "condition_requirement" SET DEFAULT 'REQUIRED'::"ProductTypeRequirementLevel",
  ALTER COLUMN "warranty_requirement" SET DEFAULT 'OPTIONAL'::"ProductTypeRequirementLevel",
  ALTER COLUMN "identifier_requirement" SET DEFAULT 'ANY_PART_NUMBER'::"ProductTypeIdentifierRequirement",
  ALTER COLUMN "minimum_image_count" SET DEFAULT 1,
  ALTER COLUMN "minimum_document_count" SET DEFAULT 0;

ALTER TABLE "products"
  ADD CONSTRAINT "products_minimum_image_count_nonnegative"
    CHECK ("minimum_image_count" BETWEEN 0 AND 20),
  ADD CONSTRAINT "products_minimum_document_count_nonnegative"
    CHECK ("minimum_document_count" BETWEEN 0 AND 20);


CREATE FUNCTION freeze_product_article_policy() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE snapshot JSONB; article JSONB; offer JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."product_type_id", NEW."schema_version_id", NEW."brand_requirement", NEW."gtin_requirement", NEW."oem_reference_requirement", NEW."cross_reference_requirement", NEW."fitment_requirement", NEW."image_requirement", NEW."document_requirement", NEW."price_requirement", NEW."stock_requirement", NEW."condition_requirement", NEW."warranty_requirement", NEW."identifier_requirement", NEW."minimum_image_count", NEW."minimum_document_count") IS DISTINCT FROM ROW(OLD."product_type_id", OLD."schema_version_id", OLD."brand_requirement", OLD."gtin_requirement", OLD."oem_reference_requirement", OLD."cross_reference_requirement", OLD."fitment_requirement", OLD."image_requirement", OLD."document_requirement", OLD."price_requirement", OLD."stock_requirement", OLD."condition_requirement", OLD."warranty_requirement", OLD."identifier_requirement", OLD."minimum_image_count", OLD."minimum_document_count") THEN
      RAISE EXCEPTION 'Article schema binding and requirement policy are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT s.snapshot INTO snapshot FROM product_type_schema_versions s
    WHERE s.id=NEW.schema_version_id AND s.product_type_id=NEW.product_type_id AND s.published_at IS NOT NULL;
  PERFORM validate_article_policy_snapshot(snapshot);
  article := COALESCE(snapshot -> 'articleRequirements', snapshot -> 'requirements', '{}'::jsonb);
  offer := COALESCE(snapshot -> 'offerRequirements', '{}'::jsonb);
  NEW."brand_requirement" := COALESCE(NULLIF(article ->> 'brand', ''), 'OPTIONAL')::"ProductTypeRequirementLevel";
  NEW."identifier_requirement" := COALESCE(NULLIF(article ->> 'identifier', ''), 'ANY_PART_NUMBER')::"ProductTypeIdentifierRequirement";
  NEW."gtin_requirement" := COALESCE(NULLIF(article ->> 'gtin', ''), 'OPTIONAL')::"ProductTypeRequirementLevel";
  NEW."oem_reference_requirement" := COALESCE(NULLIF(article ->> 'oemReference', ''), 'OPTIONAL')::"ProductTypeRequirementLevel";
  NEW."cross_reference_requirement" := COALESCE(NULLIF(article ->> 'crossReference', ''), 'OPTIONAL')::"ProductTypeRequirementLevel";
  NEW."fitment_requirement" := COALESCE(NULLIF(article ->> 'fitment', ''), 'REQUIRED')::"ProductTypeRequirementLevel";
  NEW."image_requirement" := COALESCE(NULLIF(article ->> 'image', ''), 'REQUIRED')::"ProductTypeRequirementLevel";
  NEW."document_requirement" := COALESCE(NULLIF(article ->> 'document', ''), 'OPTIONAL')::"ProductTypeRequirementLevel";
  NEW."price_requirement" := COALESCE(NULLIF(offer ->> 'price', ''), 'REQUIRED')::"ProductTypeRequirementLevel";
  NEW."stock_requirement" := COALESCE(NULLIF(offer ->> 'stock', ''), 'REQUIRED')::"ProductTypeRequirementLevel";
  NEW."condition_requirement" := COALESCE(NULLIF(offer ->> 'condition', ''), 'REQUIRED')::"ProductTypeRequirementLevel";
  NEW."warranty_requirement" := COALESCE(NULLIF(offer ->> 'warranty', ''), 'OPTIONAL')::"ProductTypeRequirementLevel";
  NEW."minimum_image_count" := COALESCE(NULLIF(article ->> 'minimumImageCount', '')::NUMERIC::INTEGER, CASE WHEN article ->> 'image' = 'NOT_APPLICABLE' THEN 0 ELSE 1 END);
  NEW."minimum_document_count" := COALESCE(NULLIF(article ->> 'minimumDocumentCount', '')::NUMERIC::INTEGER, 0);
  RETURN NEW;
END $$;
CREATE TRIGGER products_freeze_article_policy BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION freeze_product_article_policy();

COMMIT;
