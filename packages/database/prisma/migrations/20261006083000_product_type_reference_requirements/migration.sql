-- Extend Product Type seller/article requirements with mature automotive
-- reference-data and content policies.
--
-- Values remain on existing domain records:
-- OEM / cross references -> PartNumber
-- documents -> ProductAsset(type=DOCUMENT)
-- warranty -> SellerListing.warrantyInformation

ALTER TABLE "product_types"
  ADD COLUMN "oem_reference_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "cross_reference_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "document_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "minimum_document_count" INTEGER
    NOT NULL DEFAULT 0,
  ADD COLUMN "warranty_requirement" "ProductTypeRequirementLevel"
    NOT NULL DEFAULT 'OPTIONAL';

ALTER TABLE "product_types"
  ADD CONSTRAINT "product_types_minimum_document_count_nonnegative"
  CHECK ("minimum_document_count" >= 0),
  ADD CONSTRAINT "product_types_document_requirement_consistency"
  CHECK (
    ("document_requirement" = 'NOT_APPLICABLE' AND "minimum_document_count" = 0)
    OR
    ("document_requirement" = 'REQUIRED' AND "minimum_document_count" >= 1)
    OR
    ("document_requirement" = 'OPTIONAL' AND "minimum_document_count" >= 0)
  );
