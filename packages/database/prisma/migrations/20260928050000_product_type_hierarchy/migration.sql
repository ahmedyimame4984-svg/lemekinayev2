-- Add Product Type hierarchy support.
ALTER TABLE "product_types"
ADD COLUMN "parent_id" UUID;

CREATE INDEX "product_types_parent_id_sort_order_idx"
ON "product_types"("parent_id", "sort_order");

ALTER TABLE "product_types"
ADD CONSTRAINT "product_types_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "product_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
