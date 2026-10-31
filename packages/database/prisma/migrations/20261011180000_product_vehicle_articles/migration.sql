-- One stable application ID per canonical Product and configured Vehicle.
CREATE TABLE "product_vehicle_articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "vehicle_configuration_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_vehicle_articles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_vehicle_article_pair_unique" ON "product_vehicle_articles" ("product_id", "vehicle_configuration_id");
CREATE INDEX "product_vehicle_articles_vehicle_configuration_id_idx" ON "product_vehicle_articles" ("vehicle_configuration_id");
ALTER TABLE "product_vehicle_articles" ADD CONSTRAINT "product_vehicle_articles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_vehicle_articles" ADD CONSTRAINT "product_vehicle_articles_vehicle_configuration_id_fkey" FOREIGN KEY ("vehicle_configuration_id") REFERENCES "vehicle_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Existing exact fitment records are preserved. Grouping prevents duplicating applications
-- when different positions/criteria have distinct compatibility evidence.
INSERT INTO "product_vehicle_articles" ("id", "product_id", "vehicle_configuration_id")
SELECT gen_random_uuid(), "product_id", "vehicle_configuration_id"
FROM "vehicle_compatibilities"
WHERE "fitment_type" = 'EXACT'
  AND "vehicle_configuration_id" IS NOT NULL
  AND "status" <> 'ARCHIVED'
GROUP BY "product_id", "vehicle_configuration_id"
ON CONFLICT ("product_id", "vehicle_configuration_id") DO NOTHING;
