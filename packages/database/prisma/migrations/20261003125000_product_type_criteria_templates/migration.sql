-- Reusable Product Type criteria templates.

CREATE TABLE "product_type_criteria_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_family_id" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_type_criteria_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_type_criteria_templates_version_check" CHECK ("version" > 0)
);

CREATE TABLE "product_type_criteria_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "requirement" "ProductTypeAttributeRequirement" NOT NULL DEFAULT 'OPTIONAL',
    "display_mode" "ProductTypeAttributeDisplayMode" NOT NULL DEFAULT 'VISIBLE',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "validation_rule" JSONB,
    "conditional_rule" JSONB,
    "default_unit_id" UUID,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "comparable" BOOLEAN NOT NULL DEFAULT false,
    "variant_defining" BOOLEAN NOT NULL DEFAULT false,
    "marketplace_visible" BOOLEAN NOT NULL DEFAULT true,
    "seller_editable" BOOLEAN NOT NULL DEFAULT true,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_type_criteria_template_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_type_criteria_template_items_display_order_check" CHECK ("display_order" >= 0),
    CONSTRAINT "product_type_criteria_template_items_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "product_type_criteria_templates_code_key"
    ON "product_type_criteria_templates"("code");
CREATE INDEX "product_type_criteria_templates_product_family_id_status_name_idx"
    ON "product_type_criteria_templates"("product_family_id", "status", "name");
CREATE INDEX "product_type_criteria_templates_status_name_idx"
    ON "product_type_criteria_templates"("status", "name");

CREATE UNIQUE INDEX "product_type_criteria_template_items_template_id_attribute_id_key"
    ON "product_type_criteria_template_items"("template_id", "attribute_id");
CREATE INDEX "product_type_criteria_template_items_template_id_status_display_order_idx"
    ON "product_type_criteria_template_items"("template_id", "status", "display_order");
CREATE INDEX "product_type_criteria_template_items_attribute_id_status_idx"
    ON "product_type_criteria_template_items"("attribute_id", "status");
CREATE INDEX "product_type_criteria_template_items_default_unit_id_idx"
    ON "product_type_criteria_template_items"("default_unit_id");

ALTER TABLE "product_type_criteria_templates"
    ADD CONSTRAINT "product_type_criteria_templates_product_family_id_fkey"
    FOREIGN KEY ("product_family_id") REFERENCES "product_families"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_type_criteria_templates"
    ADD CONSTRAINT "product_type_criteria_templates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_type_criteria_templates"
    ADD CONSTRAINT "product_type_criteria_templates_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_criteria_template_items"
    ADD CONSTRAINT "product_type_criteria_template_items_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "product_type_criteria_templates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_type_criteria_template_items"
    ADD CONSTRAINT "product_type_criteria_template_items_attribute_id_fkey"
    FOREIGN KEY ("attribute_id") REFERENCES "attribute_definitions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_type_criteria_template_items"
    ADD CONSTRAINT "product_type_criteria_template_items_default_unit_id_fkey"
    FOREIGN KEY ("default_unit_id") REFERENCES "attribute_units"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_type_criteria_template_items"
    ADD CONSTRAINT "product_type_criteria_template_items_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_type_criteria_template_items"
    ADD CONSTRAINT "product_type_criteria_template_items_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
