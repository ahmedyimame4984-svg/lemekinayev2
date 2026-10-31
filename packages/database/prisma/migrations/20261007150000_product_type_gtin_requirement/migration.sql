-- Add a Product Type policy for canonical Manufacturer Article GTIN identity.
--
-- GTIN values remain first-class ArticleIdentifier records (GTIN-8/12/13/14).
-- This column only controls whether a GTIN is required, optional or not applicable
-- for articles governed by a Product Type.

ALTER TABLE "product_types"
  ADD COLUMN "gtin_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'OPTIONAL';
