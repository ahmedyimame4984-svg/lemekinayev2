-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "product_type_id" UUID NOT NULL,
    "schema_version_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_version_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "value_string" TEXT,
    "value_numeric" DECIMAL(24,8),
    "value_boolean" BOOLEAN,
    "value_reference_id" UUID,
    "value_json" JSONB,
    "unit" VARCHAR(50),
    "normalized_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_attribute_values_one_value_check" CHECK (
      num_nonnulls(
        "value_string",
        "value_numeric",
        "value_boolean",
        "value_reference_id",
        "value_json"
      ) = 1
    )
);

-- CreateIndex
CREATE INDEX "products_product_type_id_status_name_idx"
ON "products"("product_type_id", "status", "name");

CREATE INDEX "products_category_id_status_idx"
ON "products"("category_id", "status");

CREATE INDEX "products_schema_version_id_idx"
ON "products"("schema_version_id");

CREATE UNIQUE INDEX "product_attribute_values_product_id_attribute_id_key"
ON "product_attribute_values"("product_id", "attribute_id");

CREATE INDEX "product_attribute_values_attribute_id_idx"
ON "product_attribute_values"("attribute_id");

CREATE INDEX "product_attribute_values_value_reference_id_idx"
ON "product_attribute_values"("value_reference_id");

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_product_type_id_fkey"
FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_schema_version_id_fkey"
FOREIGN KEY ("schema_version_id") REFERENCES "product_type_schema_versions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_attribute_values"
ADD CONSTRAINT "product_attribute_values_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_attribute_values"
ADD CONSTRAINT "product_attribute_values_attribute_id_fkey"
FOREIGN KEY ("attribute_id") REFERENCES "attribute_definitions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
