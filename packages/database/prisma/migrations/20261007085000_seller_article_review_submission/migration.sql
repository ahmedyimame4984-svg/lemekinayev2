ALTER TABLE "products"
ADD COLUMN "catalog_review_submitted_at" TIMESTAMP(3);

CREATE INDEX "products_seller_review_submitted_idx"
ON "products"("source_seller_id", "catalog_review_submitted_at", "updated_at");
