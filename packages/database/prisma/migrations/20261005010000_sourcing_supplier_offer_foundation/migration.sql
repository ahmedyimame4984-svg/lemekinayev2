-- Professional sourcing foundation.
-- Supplier commercial offers are intentionally separate from Manufacturer
-- Article technical identity and Seller marketplace listings.

CREATE TYPE "SupplierType" AS ENUM (
  'MANUFACTURER',
  'AUTHORIZED_DISTRIBUTOR',
  'DISTRIBUTOR',
  'WHOLESALER',
  'EXPORTER',
  'TRADING_COMPANY',
  'OTHER'
);

CREATE TYPE "SourcingIncoterm" AS ENUM (
  'EXW',
  'FCA',
  'CPT',
  'CIP',
  'DAP',
  'DPU',
  'DDP',
  'FAS',
  'FOB',
  'CFR',
  'CIF'
);

CREATE TABLE "suppliers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "supplier_type" "SupplierType" NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "contact_email" VARCHAR(254),
  "website" VARCHAR(500),
  "notes" TEXT,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_offers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supplier_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "supplier_sku" VARCHAR(120),
  "unit_cost" DECIMAL(18,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "min_order_quantity" INTEGER NOT NULL DEFAULT 1,
  "order_multiple" INTEGER NOT NULL DEFAULT 1,
  "available_quantity" INTEGER,
  "lead_time_days_min" INTEGER,
  "lead_time_days_max" INTEGER,
  "incoterm" "SourcingIncoterm",
  "origin_country_code" CHAR(2),
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "notes" TEXT,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_offers_unit_cost_positive"
    CHECK ("unit_cost" > 0),
  CONSTRAINT "supplier_offers_moq_positive"
    CHECK ("min_order_quantity" >= 1),
  CONSTRAINT "supplier_offers_order_multiple_positive"
    CHECK ("order_multiple" >= 1),
  CONSTRAINT "supplier_offers_available_quantity_nonnegative"
    CHECK ("available_quantity" IS NULL OR "available_quantity" >= 0),
  CONSTRAINT "supplier_offers_lead_time_min_nonnegative"
    CHECK ("lead_time_days_min" IS NULL OR "lead_time_days_min" >= 0),
  CONSTRAINT "supplier_offers_lead_time_max_nonnegative"
    CHECK ("lead_time_days_max" IS NULL OR "lead_time_days_max" >= 0),
  CONSTRAINT "supplier_offers_lead_time_order"
    CHECK (
      "lead_time_days_min" IS NULL
      OR "lead_time_days_max" IS NULL
      OR "lead_time_days_min" <= "lead_time_days_max"
    ),
  CONSTRAINT "supplier_offers_validity_order"
    CHECK (
      "valid_from" IS NULL
      OR "valid_to" IS NULL
      OR "valid_from" <= "valid_to"
    )
);

CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");
CREATE INDEX "suppliers_status_name_idx" ON "suppliers"("status", "name");
CREATE INDEX "suppliers_country_code_status_idx"
  ON "suppliers"("country_code", "status");

CREATE INDEX "supplier_offers_product_id_status_unit_cost_idx"
  ON "supplier_offers"("product_id", "status", "unit_cost");
CREATE INDEX "supplier_offers_supplier_id_status_updated_at_idx"
  ON "supplier_offers"("supplier_id", "status", "updated_at");
CREATE INDEX "supplier_offers_currency_status_idx"
  ON "supplier_offers"("currency", "status");
CREATE INDEX "supplier_offers_valid_to_status_idx"
  ON "supplier_offers"("valid_to", "status");

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_offers"
  ADD CONSTRAINT "supplier_offers_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_offers"
  ADD CONSTRAINT "supplier_offers_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_offers"
  ADD CONSTRAINT "supplier_offers_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_offers"
  ADD CONSTRAINT "supplier_offers_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "key", "description")
VALUES (
  gen_random_uuid(),
  'sourcing.manage',
  'Manage automotive suppliers and commercial sourcing offers'
)
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'sourcing.manage'
WHERE r."key" = 'platform-admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
