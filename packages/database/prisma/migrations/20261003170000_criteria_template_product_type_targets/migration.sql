CREATE TABLE "product_type_criteria_template_targets" (
    "template_id" UUID NOT NULL,
    "product_type_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_type_criteria_template_targets_pkey"
      PRIMARY KEY ("template_id", "product_type_id")
);

CREATE INDEX "product_type_criteria_template_targets_product_type_id_template_id_idx"
  ON "product_type_criteria_template_targets"("product_type_id", "template_id");

ALTER TABLE "product_type_criteria_template_targets"
  ADD CONSTRAINT "product_type_criteria_template_targets_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "product_type_criteria_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_type_criteria_template_targets"
  ADD CONSTRAINT "product_type_criteria_template_targets_product_type_id_fkey"
  FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
