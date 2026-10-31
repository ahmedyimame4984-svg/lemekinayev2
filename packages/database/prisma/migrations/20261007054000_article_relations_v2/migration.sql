-- Article Relations V2
-- Adds professional accessory, repair-kit, paired-part and kit/component semantics.

ALTER TYPE "ArticleRelationType" ADD VALUE IF NOT EXISTS 'ACCESSORY';
ALTER TYPE "ArticleRelationType" ADD VALUE IF NOT EXISTS 'REPAIR_KIT';
ALTER TYPE "ArticleRelationType" ADD VALUE IF NOT EXISTS 'CONTAINS';
ALTER TYPE "ArticleRelationType" ADD VALUE IF NOT EXISTS 'CONTAINED_IN';
ALTER TYPE "ArticleRelationType" ADD VALUE IF NOT EXISTS 'PAIRED_WITH';

ALTER TABLE "article_relations"
DROP CONSTRAINT "article_relations_relation_key_check";

ALTER TABLE "article_relations"
ADD COLUMN "component_quantity" DECIMAL(10,3),
ADD COLUMN "component_role" VARCHAR(120),
ADD COLUMN "component_order" INTEGER;

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_component_quantity_check"
CHECK (
  "component_quantity" IS NULL
  OR "component_quantity" > 0
);

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_component_order_check"
CHECK (
  "component_order" IS NULL
  OR "component_order" >= 0
);

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_component_metadata_type_check"
CHECK (
  "relation_type" IN ('CONTAINS', 'CONTAINED_IN')
  OR (
    "component_quantity" IS NULL
    AND "component_role" IS NULL
    AND "component_order" IS NULL
  )
);

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_active_component_quantity_check"
CHECK (
  "relation_type" NOT IN ('CONTAINS', 'CONTAINED_IN')
  OR "status" <> 'ACTIVE'
  OR "component_quantity" IS NOT NULL
);

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_relation_key_check"
CHECK (
  (
    "relation_type" IN ('SUPERSEDES', 'ACCESSORY', 'REPAIR_KIT')
    AND "relation_key" =
      "relation_type"::text || ':' ||
      "source_product_id"::text || ':' ||
      "target_product_id"::text
  )
  OR (
    "relation_type" IN ('INTERCHANGEABLE', 'PAIRED_WITH', 'RELATED')
    AND "relation_key" =
      "relation_type"::text || ':' ||
      LEAST("source_product_id"::text, "target_product_id"::text) || ':' ||
      GREATEST("source_product_id"::text, "target_product_id"::text)
  )
  OR (
    "relation_type" = 'CONTAINS'
    AND "relation_key" =
      'CONTAINS:' ||
      "source_product_id"::text || ':' ||
      "target_product_id"::text
  )
  OR (
    "relation_type" = 'CONTAINED_IN'
    AND "relation_key" =
      'CONTAINS:' ||
      "target_product_id"::text || ':' ||
      "source_product_id"::text
  )
);
