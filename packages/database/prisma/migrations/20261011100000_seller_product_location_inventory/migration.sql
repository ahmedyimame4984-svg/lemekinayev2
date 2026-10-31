-- Additive Seller Product migration. Never truncate or replace existing inventory.
ALTER TABLE "inventory_locations"
  ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "online_fulfillment_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Existing Sellers retain their historical online availability.
UPDATE "inventory_locations" SET "online_fulfillment_enabled" = true WHERE "status" = 'ACTIVE';

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "seller_id" ORDER BY
    CASE WHEN "status" = 'ACTIVE' THEN 0 ELSE 1 END, "created_at", "id") AS position
  FROM "inventory_locations"
)
UPDATE "inventory_locations" location
SET "is_default" = true
FROM ranked WHERE location."id" = ranked."id" AND ranked.position = 1;

CREATE UNIQUE INDEX "inventory_locations_one_default_per_seller_idx"
  ON "inventory_locations" ("seller_id") WHERE "is_default" = true;

CREATE TABLE "seller_products" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "product_id" UUID,
  "sku" VARCHAR(100) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "condition" "ProductCondition",
  "package_quantity" INTEGER NOT NULL DEFAULT 1,
  "package_unit" VARCHAR(30) NOT NULL DEFAULT 'PIECE',
  "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_products_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "seller_products_seller_id_sku_key" ON "seller_products"("seller_id", "sku");
CREATE INDEX "seller_products_seller_id_status_name_idx" ON "seller_products"("seller_id", "status", "name");
CREATE INDEX "seller_products_product_id_idx" ON "seller_products"("product_id");

-- Keep legacy listing IDs as stable Seller Product IDs for deterministic backfill.
INSERT INTO "seller_products"
  ("id", "seller_id", "product_id", "sku", "name", "condition",
   "created_by_id", "updated_by_id", "created_at", "updated_at")
SELECT l."id", l."seller_id", l."product_id", l."seller_sku",
       COALESCE(NULLIF(l."seller_title", ''), p."name"), l."condition",
       l."created_by_id", l."updated_by_id", l."created_at", l."updated_at"
FROM "seller_listings" l
JOIN "products" p ON p."id" = l."product_id";

ALTER TABLE "seller_listings" ADD COLUMN "seller_product_id" UUID;
UPDATE "seller_listings" SET "seller_product_id" = "id";
CREATE UNIQUE INDEX "seller_listings_seller_product_id_key" ON "seller_listings"("seller_product_id");
ALTER TABLE "seller_listings" ADD CONSTRAINT "seller_listings_seller_product_id_fkey"
  FOREIGN KEY ("seller_product_id") REFERENCES "seller_products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory" ADD COLUMN "seller_product_id" UUID;
UPDATE "inventory" SET "seller_product_id" = "listing_id";
ALTER TABLE "inventory" ALTER COLUMN "seller_product_id" SET NOT NULL;
ALTER TABLE "inventory" ALTER COLUMN "listing_id" DROP NOT NULL;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_seller_product_id_fkey"
  FOREIGN KEY ("seller_product_id") REFERENCES "seller_products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "inventory_seller_product_id_location_id_key"
  ON "inventory"("seller_product_id", "location_id");

-- Dispatch removes stock from the source. Receipt adds stock to the destination.
-- In-transit quantity is intentionally excluded from online availability.
CREATE TYPE "SellerStockTransferStatus" AS ENUM ('IN_TRANSIT', 'COMPLETED');

CREATE TABLE "seller_stock_transfers" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "seller_product_id" UUID NOT NULL,
  "source_location_id" UUID NOT NULL,
  "destination_location_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "received_quantity" INTEGER NOT NULL DEFAULT 0,
  "idempotency_key" VARCHAR(80) NOT NULL,
  "status" "SellerStockTransferStatus" NOT NULL DEFAULT 'IN_TRANSIT',
  "reason" VARCHAR(500) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "seller_stock_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_stock_transfers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfers_seller_product_id_fkey" FOREIGN KEY ("seller_product_id") REFERENCES "seller_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfers_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfers_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfers_positive_quantity" CHECK ("quantity" > 0),
  CONSTRAINT "seller_stock_transfers_received_bounds" CHECK ("received_quantity" >= 0 AND "received_quantity" <= "quantity"),
  CONSTRAINT "seller_stock_transfers_distinct_locations" CHECK ("source_location_id" <> "destination_location_id")
);
CREATE UNIQUE INDEX "seller_stock_transfers_seller_id_idempotency_key_key" ON "seller_stock_transfers"("seller_id", "idempotency_key");
CREATE INDEX "seller_stock_transfers_seller_product_id_status_created_at_idx" ON "seller_stock_transfers"("seller_product_id", "status", "created_at");

CREATE TABLE "seller_stock_transfer_receipts" (
  "id" UUID NOT NULL,
  "transfer_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(80) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "actor_id" UUID NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_stock_transfer_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_stock_transfer_receipts_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "seller_stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfer_receipts_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "seller_stock_transfer_receipts_positive_quantity" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "seller_stock_transfer_receipts_transfer_id_idempotency_key_key" ON "seller_stock_transfer_receipts"("transfer_id", "idempotency_key");
