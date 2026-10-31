-- Seller, Seller Listing, Pricing, and Inventory foundation.
-- Implements the canonical Product Master -> Seller Listing -> Inventory separation.

CREATE TYPE "SellerType" AS ENUM (
  'IMPORTER',
  'DISTRIBUTOR',
  'WHOLESALER',
  'RETAILER',
  'HYBRID',
  'OTHER'
);

CREATE TYPE "SellerVerificationStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "SellerApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "SellerStatus" AS ENUM (
  'APPLICATION',
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
  'BLOCKED'
);

CREATE TYPE "SellerListingStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'ACTIVE',
  'REJECTED',
  'PAUSED',
  'SUSPENDED',
  'OUT_OF_STOCK',
  'INACTIVE',
  'ARCHIVED'
);

CREATE TYPE "ProductCondition" AS ENUM (
  'NEW',
  'USED',
  'REFURBISHED',
  'OTHER'
);

CREATE TYPE "InventoryLocationType" AS ENUM (
  'BRANCH',
  'WAREHOUSE',
  'OTHER'
);

CREATE TYPE "InventoryAvailabilityStatus" AS ENUM (
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK'
);

CREATE TYPE "InventoryMovementType" AS ENUM (
  'RECEIPT',
  'ADJUSTMENT',
  'RESERVATION',
  'RELEASE',
  'SALE',
  'RETURN',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'DAMAGE',
  'CORRECTION'
);

CREATE TABLE "sellers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "seller_code" VARCHAR(50) NOT NULL,
  "business_name" VARCHAR(180) NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "seller_type" "SellerType" NOT NULL,
  "verification_status" "SellerVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "approval_status" "SellerApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "status" "SellerStatus" NOT NULL DEFAULT 'APPLICATION',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sellers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sellers_version_check" CHECK ("version" > 0)
);

CREATE TABLE "seller_listings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "seller_sku" VARCHAR(100) NOT NULL,
  "condition" "ProductCondition" NOT NULL,
  "seller_title" VARCHAR(180),
  "seller_description" TEXT,
  "warranty_information" TEXT,
  "delivery_information" TEXT,
  "commercial_terms" TEXT,
  "status" "SellerListingStatus" NOT NULL DEFAULT 'DRAFT',
  "rejection_reason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "seller_listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_listings_version_check" CHECK ("version" > 0)
);

CREATE TABLE "listing_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "listing_id" UUID NOT NULL,
  "base_price" DECIMAL(18,2) NOT NULL,
  "selling_price" DECIMAL(18,2) NOT NULL,
  "promotional_price" DECIMAL(18,2),
  "currency" CHAR(3) NOT NULL,
  "min_order_quantity" INTEGER NOT NULL DEFAULT 1,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "listing_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_prices_price_check" CHECK ("base_price" >= 0 AND "selling_price" > 0),
  CONSTRAINT "listing_prices_promo_check" CHECK ("promotional_price" IS NULL OR ("promotional_price" > 0 AND "promotional_price" <= "selling_price")),
  CONSTRAINT "listing_prices_min_order_check" CHECK ("min_order_quantity" > 0),
  CONSTRAINT "listing_prices_version_check" CHECK ("version" > 0),
  CONSTRAINT "listing_prices_effective_range_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from")
);

CREATE TABLE "inventory_locations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "type" "InventoryLocationType" NOT NULL,
  "address_text" VARCHAR(500),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_locations_version_check" CHECK ("version" > 0)
);

CREATE TABLE "inventory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "listing_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
  "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
  "safety_stock" INTEGER NOT NULL DEFAULT 0,
  "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
  "availability_status" "InventoryAvailabilityStatus" NOT NULL DEFAULT 'OUT_OF_STOCK',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_quantities_check" CHECK (
    "quantity_on_hand" >= 0
    AND "quantity_reserved" >= 0
    AND "safety_stock" >= 0
    AND "low_stock_threshold" >= 0
    AND "quantity_reserved" <= "quantity_on_hand"
  ),
  CONSTRAINT "inventory_version_check" CHECK ("version" > 0)
);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inventory_id" UUID NOT NULL,
  "type" "InventoryMovementType" NOT NULL,
  "quantity_delta" INTEGER NOT NULL,
  "reserved_delta" INTEGER NOT NULL DEFAULT 0,
  "quantity_before" INTEGER NOT NULL,
  "quantity_after" INTEGER NOT NULL,
  "reserved_before" INTEGER NOT NULL DEFAULT 0,
  "reserved_after" INTEGER NOT NULL DEFAULT 0,
  "reason" VARCHAR(500) NOT NULL,
  "reference_type" VARCHAR(80),
  "reference_id" VARCHAR(120),
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_movements_after_check" CHECK (
    "quantity_after" >= 0
    AND "reserved_before" >= 0
    AND "reserved_after" >= 0
    AND "reserved_after" <= "quantity_after"
  )
);

CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");
CREATE UNIQUE INDEX "sellers_seller_code_key" ON "sellers"("seller_code");
CREATE INDEX "sellers_status_approval_status_display_name_idx"
ON "sellers"("status", "approval_status", "display_name");
CREATE INDEX "sellers_verification_status_idx"
ON "sellers"("verification_status");

CREATE UNIQUE INDEX "seller_listings_seller_id_seller_sku_key"
ON "seller_listings"("seller_id", "seller_sku");
CREATE INDEX "seller_listings_product_id_status_idx"
ON "seller_listings"("product_id", "status");
CREATE INDEX "seller_listings_seller_id_product_id_status_idx"
ON "seller_listings"("seller_id", "product_id", "status");
CREATE INDEX "seller_listings_seller_id_status_updated_at_idx"
ON "seller_listings"("seller_id", "status", "updated_at");

CREATE UNIQUE INDEX "listing_prices_listing_id_key"
ON "listing_prices"("listing_id");
CREATE INDEX "listing_prices_status_currency_selling_price_idx"
ON "listing_prices"("status", "currency", "selling_price");

CREATE UNIQUE INDEX "inventory_locations_seller_id_code_key"
ON "inventory_locations"("seller_id", "code");
CREATE INDEX "inventory_locations_seller_id_status_name_idx"
ON "inventory_locations"("seller_id", "status", "name");

CREATE UNIQUE INDEX "inventory_listing_id_location_id_key"
ON "inventory"("listing_id", "location_id");
CREATE INDEX "inventory_location_id_availability_status_idx"
ON "inventory"("location_id", "availability_status");
CREATE INDEX "inventory_listing_id_availability_status_idx"
ON "inventory"("listing_id", "availability_status");

CREATE INDEX "inventory_movements_inventory_id_created_at_idx"
ON "inventory_movements"("inventory_id", "created_at");
CREATE INDEX "inventory_movements_reference_type_reference_id_idx"
ON "inventory_movements"("reference_type", "reference_id");

ALTER TABLE "sellers"
ADD CONSTRAINT "sellers_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sellers"
ADD CONSTRAINT "sellers_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sellers"
ADD CONSTRAINT "sellers_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_listings"
ADD CONSTRAINT "seller_listings_seller_id_fkey"
FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_listings"
ADD CONSTRAINT "seller_listings_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_listings"
ADD CONSTRAINT "seller_listings_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_listings"
ADD CONSTRAINT "seller_listings_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "listing_prices"
ADD CONSTRAINT "listing_prices_listing_id_fkey"
FOREIGN KEY ("listing_id") REFERENCES "seller_listings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_locations"
ADD CONSTRAINT "inventory_locations_seller_id_fkey"
FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_locations"
ADD CONSTRAINT "inventory_locations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_locations"
ADD CONSTRAINT "inventory_locations_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_listing_id_fkey"
FOREIGN KEY ("listing_id") REFERENCES "seller_listings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_location_id_fkey"
FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_inventory_id_fkey"
FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Administrative permissions for seller onboarding, listing moderation, and inventory correction.
-- Permission identity is keyed by "key", not by assumed unused UUIDs. This keeps
-- the migration safe for databases that already contain later-added permissions.
INSERT INTO "permissions" ("key", "description") VALUES
('seller.manage', 'Manage seller marketplace profiles'),
('listing.manage', 'Moderate seller marketplace listings'),
('inventory.manage', 'Perform authorized marketplace inventory corrections')
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT
  '00000000-0000-4000-8000-000000000001',
  "id"
FROM "permissions"
WHERE "key" IN ('seller.manage', 'listing.manage', 'inventory.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
