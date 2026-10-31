-- Additive Seller-specific listing assets; existing Articles, Listings and Inventory are untouched.
-- Unuploaded assets remain DRAFT; verified uploads become ACTIVE. Never infer
-- Seller-specific media from canonical product_assets during backfill.
CREATE TABLE "seller_listing_assets" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "type" "ProductAssetType" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_name" VARCHAR(180) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seller_listing_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "seller_listing_assets_size_positive" CHECK ("size_bytes" > 0 AND "size_bytes" <= 8388608)
);
CREATE UNIQUE INDEX "seller_listing_assets_storage_key_key"
  ON "seller_listing_assets"("storage_key");
CREATE INDEX "seller_listing_assets_listing_id_type_status_sort_order_idx"
  ON "seller_listing_assets"("listing_id", "type", "status", "sort_order");
CREATE UNIQUE INDEX "seller_listing_assets_one_primary_image_idx"
  ON "seller_listing_assets"("listing_id")
  WHERE "is_primary" = true AND "status" <> 'ARCHIVED' AND "type" = 'IMAGE';
ALTER TABLE "seller_listing_assets"
 ADD CONSTRAINT "seller_listing_assets_listing_id_fkey"
 FOREIGN KEY ("listing_id") REFERENCES "seller_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
