-- Master Attribute System v2 foundation.
-- This migration is intentionally additive. Existing attribute definitions and
-- product values remain valid while the canonical library is migrated.

-- CreateTable
CREATE TABLE "attribute_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_groups_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "attribute_groups_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "unit_dimensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_dimensions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "unit_dimensions_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "attribute_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dimension_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "is_base" BOOLEAN NOT NULL DEFAULT false,
    "factor_to_base" DECIMAL(24,12) NOT NULL DEFAULT 1,
    "offset_to_base" DECIMAL(24,12) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_units_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_units_factor_check" CHECK ("factor_to_base" > 0),
    CONSTRAINT "attribute_units_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "attribute_units_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "attribute_option_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_option_sets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_option_sets_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "attribute_option_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "option_set_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_option_values_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_option_values_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "attribute_option_values_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "attribute_aliases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attribute_id" UUID NOT NULL,
    "alias" VARCHAR(160) NOT NULL,
    "normalized_alias" VARCHAR(160) NOT NULL,
    "locale" VARCHAR(12) NOT NULL DEFAULT 'en',
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_aliases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attribute_aliases_version_check" CHECK ("version" > 0)
);

-- AlterTable
ALTER TABLE "attribute_definitions"
    ADD COLUMN "group_id" UUID,
    ADD COLUMN "option_set_id" UUID,
    ADD COLUMN "unit_dimension_id" UUID,
    ADD COLUMN "default_unit_id" UUID,
    ADD COLUMN "example_value" VARCHAR(300),
    ADD COLUMN "validation_rule" JSONB,
    ADD COLUMN "repeatable" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "translatable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_type_attribute_assignments"
    ADD COLUMN "default_unit_id" UUID,
    ADD COLUMN "comparable" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "variant_defining" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "marketplace_visible" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "seller_editable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "product_attribute_values"
    ADD COLUMN "unit_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "attribute_groups_code_key" ON "attribute_groups"("code");
CREATE INDEX "attribute_groups_status_sort_order_name_idx" ON "attribute_groups"("status", "sort_order", "name");

CREATE UNIQUE INDEX "unit_dimensions_code_key" ON "unit_dimensions"("code");
CREATE INDEX "unit_dimensions_status_name_idx" ON "unit_dimensions"("status", "name");

CREATE UNIQUE INDEX "attribute_units_code_key" ON "attribute_units"("code");
CREATE INDEX "attribute_units_dimension_id_status_sort_order_idx" ON "attribute_units"("dimension_id", "status", "sort_order");

CREATE UNIQUE INDEX "attribute_option_sets_code_key" ON "attribute_option_sets"("code");
CREATE INDEX "attribute_option_sets_status_name_idx" ON "attribute_option_sets"("status", "name");

CREATE UNIQUE INDEX "attribute_option_values_option_set_id_code_key" ON "attribute_option_values"("option_set_id", "code");
CREATE INDEX "attribute_option_values_option_set_id_status_sort_order_idx" ON "attribute_option_values"("option_set_id", "status", "sort_order");

CREATE UNIQUE INDEX "attribute_aliases_attribute_id_normalized_alias_locale_key" ON "attribute_aliases"("attribute_id", "normalized_alias", "locale");
CREATE INDEX "attribute_aliases_normalized_alias_locale_status_idx" ON "attribute_aliases"("normalized_alias", "locale", "status");

CREATE INDEX "attribute_definitions_group_id_status_name_idx" ON "attribute_definitions"("group_id", "status", "name");
CREATE INDEX "attribute_definitions_option_set_id_status_idx" ON "attribute_definitions"("option_set_id", "status");
CREATE INDEX "attribute_definitions_unit_dimension_id_status_idx" ON "attribute_definitions"("unit_dimension_id", "status");
CREATE INDEX "product_type_attribute_assignments_default_unit_id_idx" ON "product_type_attribute_assignments"("default_unit_id");
CREATE INDEX "product_attribute_values_unit_id_idx" ON "product_attribute_values"("unit_id");

-- AddForeignKey
ALTER TABLE "attribute_groups" ADD CONSTRAINT "attribute_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_groups" ADD CONSTRAINT "attribute_groups_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unit_dimensions" ADD CONSTRAINT "unit_dimensions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_dimensions" ADD CONSTRAINT "unit_dimensions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attribute_units" ADD CONSTRAINT "attribute_units_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "unit_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_units" ADD CONSTRAINT "attribute_units_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_units" ADD CONSTRAINT "attribute_units_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attribute_option_sets" ADD CONSTRAINT "attribute_option_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_option_sets" ADD CONSTRAINT "attribute_option_sets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attribute_option_values" ADD CONSTRAINT "attribute_option_values_option_set_id_fkey" FOREIGN KEY ("option_set_id") REFERENCES "attribute_option_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_option_values" ADD CONSTRAINT "attribute_option_values_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_option_values" ADD CONSTRAINT "attribute_option_values_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attribute_aliases" ADD CONSTRAINT "attribute_aliases_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribute_aliases" ADD CONSTRAINT "attribute_aliases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_aliases" ADD CONSTRAINT "attribute_aliases_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "attribute_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_option_set_id_fkey" FOREIGN KEY ("option_set_id") REFERENCES "attribute_option_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_unit_dimension_id_fkey" FOREIGN KEY ("unit_dimension_id") REFERENCES "unit_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "attribute_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_attribute_assignments" ADD CONSTRAINT "product_type_attribute_assignments_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "attribute_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "attribute_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
