-- Add a non-destructive policy cap. Existing Articles retain their frozen minimums.
-- Missing historical maximums map to the previous API limit of 20 images.
ALTER TABLE "product_types" ADD COLUMN "maximum_image_count" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "products" ADD COLUMN "maximum_image_count" INTEGER NOT NULL DEFAULT 20;

-- No images are permitted for NOT_APPLICABLE policies.
UPDATE "product_types" SET "maximum_image_count" = 0 WHERE "image_requirement" = 'NOT_APPLICABLE';
UPDATE "products" SET "maximum_image_count" = 0 WHERE "image_requirement" = 'NOT_APPLICABLE';
