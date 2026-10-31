-- Track whether a Product Type Attribute assignment is Admin/manual or governed by the canonical criteria library.
CREATE TYPE "ProductTypeAttributeAssignmentOrigin" AS ENUM ('MANUAL', 'CANONICAL');

ALTER TABLE "product_type_attribute_assignments"
ADD COLUMN "origin" "ProductTypeAttributeAssignmentOrigin" NOT NULL DEFAULT 'MANUAL';

CREATE INDEX "product_type_attribute_assignments_origin_product_type_id_idx"
ON "product_type_attribute_assignments"("origin", "product_type_id");
