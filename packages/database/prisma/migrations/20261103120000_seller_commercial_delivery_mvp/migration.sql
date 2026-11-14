-- Marketplace-owned requirements are local policies; do not synchronize from Autotechdoc.
ALTER TABLE "product_types"
  ADD COLUMN "package_dimensions_requirement" "ProductTypeRequirementLevel" NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "package_weight_requirement" "ProductTypeRequirementLevel" NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "discount_requirement" "ProductTypeRequirementLevel" NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "transport_requirement" "ProductTypeRequirementLevel" NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "special_handling_requirement" "ProductTypeRequirementLevel" NOT NULL DEFAULT 'OPTIONAL';

-- Nullable for legacy Listings. Their status and immutable identity are unchanged.
ALTER TABLE "seller_listings" ADD COLUMN "commercial_details" JSONB;
