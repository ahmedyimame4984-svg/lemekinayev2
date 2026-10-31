-- CreateTable
CREATE TABLE "product_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_types_sort_order_check" CHECK ("sort_order" >= 0),
    CONSTRAINT "product_types_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "product_types_code_key" ON "product_types"("code");
CREATE UNIQUE INDEX "product_types_slug_key" ON "product_types"("slug");
CREATE INDEX "product_types_category_id_status_sort_order_idx" ON "product_types"("category_id", "status", "sort_order");

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
