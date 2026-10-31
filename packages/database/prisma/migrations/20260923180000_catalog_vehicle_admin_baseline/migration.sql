-- CreateEnum
CREATE TYPE "MasterDataStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL,
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_level_check" CHECK ("level" >= 0),
    CONSTRAINT "categories_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "categories_version_check" CHECK ("version" > 0),
    CONSTRAINT "categories_parent_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);

-- CreateTable
CREATE TABLE "vehicle_makes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_makes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_makes_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "make_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_models_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parent_id_sort_order_idx" ON "categories"("parent_id", "sort_order");
CREATE INDEX "categories_status_sort_order_idx" ON "categories"("status", "sort_order");
CREATE UNIQUE INDEX "vehicle_makes_code_key" ON "vehicle_makes"("code");
CREATE INDEX "vehicle_makes_status_name_idx" ON "vehicle_makes"("status", "name");
CREATE UNIQUE INDEX "vehicle_models_make_id_code_key" ON "vehicle_models"("make_id", "code");
CREATE INDEX "vehicle_models_make_id_status_name_idx" ON "vehicle_models"("make_id", "status", "name");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_makes" ADD CONSTRAINT "vehicle_makes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_makes" ADD CONSTRAINT "vehicle_makes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the stable vehicle master permission and grant it only to the platform-admin role.
INSERT INTO "permissions" ("id", "key", "description") VALUES
('00000000-0000-4000-8000-000000000106', 'vehicle.manage', 'Manage canonical vehicle master data');

INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES
('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000106');
