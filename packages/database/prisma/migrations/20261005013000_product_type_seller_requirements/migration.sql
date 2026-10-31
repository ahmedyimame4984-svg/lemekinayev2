-- Product Types define the data a seller must provide.
-- Actual values remain on Manufacturer Articles, fitment records,
-- assets, Seller Listings and inventory.

CREATE TYPE "ProductTypeRequirementLevel" AS ENUM (
  'REQUIRED',
  'OPTIONAL',
  'NOT_APPLICABLE'
);

CREATE TYPE "ProductTypeIdentifierRequirement" AS ENUM (
  'MANUFACTURER_PART_NUMBER',
  'ANY_PART_NUMBER',
  'OPTIONAL',
  'NOT_APPLICABLE'
);

ALTER TABLE "product_types"
  ADD COLUMN "brand_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "identifier_requirement" "ProductTypeIdentifierRequirement"
    NOT NULL DEFAULT 'ANY_PART_NUMBER',
  ADD COLUMN "fitment_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN "image_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN "minimum_image_count" INTEGER
    NOT NULL DEFAULT 1,
  ADD COLUMN "price_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN "stock_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN "condition_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'REQUIRED';

ALTER TABLE "product_types"
  ADD CONSTRAINT "product_types_minimum_image_count_nonnegative"
  CHECK ("minimum_image_count" >= 0);

ALTER TABLE "product_types"
  ADD CONSTRAINT "product_types_image_requirement_consistency"
  CHECK (
    ("image_requirement" = 'NOT_APPLICABLE' AND "minimum_image_count" = 0)
    OR
    ("image_requirement" <> 'NOT_APPLICABLE')
  );
