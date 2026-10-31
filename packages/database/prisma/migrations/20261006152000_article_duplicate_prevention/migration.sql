BEGIN;

-- Canonical Manufacturer Article duplicate prevention.
-- Brand + normalized Manufacturer Part Number is the global Article identity.
-- OE and cross-reference rows intentionally keep article_identity_key NULL.

ALTER TABLE "part_numbers"
ADD COLUMN "article_identity_key" VARCHAR(240);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "part_numbers"
    WHERE "part_number_type" = 'MANUFACTURER'
      AND "brand_id" IS NOT NULL
    GROUP BY "brand_id", "normalized_part_number"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enable Manufacturer Article identity uniqueness: duplicate Brand + normalized Manufacturer Part Number rows exist';
  END IF;
END
$$;

UPDATE "part_numbers"
SET "article_identity_key" =
  "brand_id"::text || ':' || "normalized_part_number"
WHERE "part_number_type" = 'MANUFACTURER'
  AND "brand_id" IS NOT NULL;

ALTER TABLE "part_numbers"
ADD CONSTRAINT "part_numbers_article_identity_key_check"
CHECK (
  (
    "part_number_type" = 'MANUFACTURER'
    AND "brand_id" IS NOT NULL
    AND "article_identity_key" =
      "brand_id"::text || ':' || "normalized_part_number"
  )
  OR (
    (
      "part_number_type" <> 'MANUFACTURER'
      OR "brand_id" IS NULL
    )
    AND "article_identity_key" IS NULL
  )
);

CREATE UNIQUE INDEX "part_numbers_article_identity_key_key"
ON "part_numbers" ("article_identity_key");

COMMIT;
