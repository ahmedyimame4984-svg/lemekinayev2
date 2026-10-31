-- Professional OE / reference-number model.
-- "OE" is the correct identifier term; OEM describes a manufacturer/business role.

ALTER TYPE "PartNumberType" RENAME VALUE 'OEM' TO 'OE';

ALTER TABLE "part_numbers"
ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

WITH ranked_manufacturer_numbers AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "product_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "part_numbers"
  WHERE "part_number_type" = 'MANUFACTURER'
)
UPDATE "part_numbers" AS pn
SET "is_primary" = true
FROM ranked_manufacturer_numbers AS ranked
WHERE pn."id" = ranked."id" AND ranked.rn = 1;

ALTER TABLE "part_numbers"
ADD CONSTRAINT "part_numbers_primary_manufacturer_check"
CHECK (NOT "is_primary" OR "part_number_type" = 'MANUFACTURER');

CREATE UNIQUE INDEX "part_numbers_one_primary_manufacturer_per_product_key"
ON "part_numbers" ("product_id")
WHERE "is_primary" = true;

CREATE INDEX "part_numbers_product_id_is_primary_status_idx"
ON "part_numbers" ("product_id", "is_primary", "status");
