-- CreateEnum
CREATE TYPE "ProductTypeAttributeRequirement" AS ENUM (
    'MANDATORY',
    'OPTIONAL',
    'CONDITIONAL'
);

-- CreateEnum
CREATE TYPE "ProductTypeAttributeDisplayMode" AS ENUM (
    'VISIBLE',
    'HIDDEN',
    'READ_ONLY'
);

-- CreateTable
CREATE TABLE "product_type_attribute_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_type_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "requirement" "ProductTypeAttributeRequirement" NOT NULL DEFAULT 'OPTIONAL',
    "display_mode" "ProductTypeAttributeDisplayMode" NOT NULL DEFAULT 'VISIBLE',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "validation_rule" JSONB,
    "conditional_rule" JSONB,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_type_attribute_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_type_attribute_assignments_display_order_check" CHECK ("display_order" >= 0),
    CONSTRAINT "product_type_attribute_assignments_version_check" CHECK ("version" > 0),
    CONSTRAINT "product_type_attribute_assignments_conditional_rule_check"
      CHECK ("requirement" <> 'CONDITIONAL' OR "conditional_rule" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "product_type_attribute_assignments_product_type_id_attribute_id_key"
ON "product_type_attribute_assignments"("product_type_id", "attribute_id");

CREATE INDEX "product_type_attribute_assignments_product_type_id_status_display_order_idx"
ON "product_type_attribute_assignments"("product_type_id", "status", "display_order");

CREATE INDEX "product_type_attribute_assignments_attribute_id_status_idx"
ON "product_type_attribute_assignments"("attribute_id", "status");

-- AddForeignKey
ALTER TABLE "product_type_attribute_assignments"
ADD CONSTRAINT "product_type_attribute_assignments_product_type_id_fkey"
FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_attribute_assignments"
ADD CONSTRAINT "product_type_attribute_assignments_attribute_id_fkey"
FOREIGN KEY ("attribute_id") REFERENCES "attribute_definitions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_attribute_assignments"
ADD CONSTRAINT "product_type_attribute_assignments_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_attribute_assignments"
ADD CONSTRAINT "product_type_attribute_assignments_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
