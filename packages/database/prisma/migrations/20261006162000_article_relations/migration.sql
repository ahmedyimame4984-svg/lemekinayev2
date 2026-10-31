BEGIN;

CREATE TYPE "ArticleRelationType" AS ENUM (
  'SUPERSEDES',
  'INTERCHANGEABLE',
  'RELATED'
);

CREATE TABLE "article_relations" (
  "id" UUID NOT NULL,
  "source_product_id" UUID NOT NULL,
  "target_product_id" UUID NOT NULL,
  "relation_type" "ArticleRelationType" NOT NULL,
  "relation_key" VARCHAR(180) NOT NULL,
  "note" VARCHAR(500),
  "status" "MasterDataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "article_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "article_relations_not_self_check"
    CHECK ("source_product_id" <> "target_product_id"),
  CONSTRAINT "article_relations_relation_key_check"
    CHECK (
      (
        "relation_type" = 'SUPERSEDES'
        AND "relation_key" =
          'SUPERSEDES:' || "source_product_id"::text || ':' || "target_product_id"::text
      )
      OR (
        "relation_type" IN ('INTERCHANGEABLE', 'RELATED')
        AND "relation_key" =
          "relation_type"::text || ':' ||
          LEAST("source_product_id"::text, "target_product_id"::text) || ':' ||
          GREATEST("source_product_id"::text, "target_product_id"::text)
      )
    )
);

CREATE UNIQUE INDEX "article_relations_relation_key_key"
ON "article_relations" ("relation_key");

CREATE INDEX "article_relations_source_product_id_relation_type_status_idx"
ON "article_relations" ("source_product_id", "relation_type", "status");

CREATE INDEX "article_relations_target_product_id_relation_type_status_idx"
ON "article_relations" ("target_product_id", "relation_type", "status");

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_source_product_id_fkey"
FOREIGN KEY ("source_product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_target_product_id_fkey"
FOREIGN KEY ("target_product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "article_relations"
ADD CONSTRAINT "article_relations_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
