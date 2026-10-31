-- Professional Article Import V2
-- Persists committed import-job/report metadata while keeping preview zero-write.

CREATE TABLE "catalog_article_import_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dataset_reference" VARCHAR(200) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_format" VARCHAR(8) NOT NULL,
  "preview_fingerprint" CHAR(64) NOT NULL,
  "total_rows" INTEGER NOT NULL,
  "included_rows" INTEGER NOT NULL,
  "excluded_rows" INTEGER NOT NULL,
  "warning_rows" INTEGER NOT NULL,
  "created_count" INTEGER NOT NULL,
  "report" JSONB NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "catalog_article_import_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_article_import_jobs_counts_check"
    CHECK (
      "total_rows" >= 0
      AND "included_rows" >= 0
      AND "excluded_rows" >= 0
      AND "warning_rows" >= 0
      AND "created_count" >= 0
      AND "included_rows" + "excluded_rows" = "total_rows"
      AND "created_count" <= "included_rows"
    ),
  CONSTRAINT "catalog_article_import_jobs_file_format_check"
    CHECK ("file_format" IN ('CSV', 'XLSX')),
  CONSTRAINT "catalog_article_import_jobs_fingerprint_check"
    CHECK ("preview_fingerprint" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "catalog_article_import_jobs_dataset_reference_key"
ON "catalog_article_import_jobs" ("dataset_reference");

CREATE INDEX "catalog_article_import_jobs_created_by_id_created_at_idx"
ON "catalog_article_import_jobs" ("created_by_id", "created_at");

CREATE INDEX "catalog_article_import_jobs_created_at_idx"
ON "catalog_article_import_jobs" ("created_at");

ALTER TABLE "catalog_article_import_jobs"
ADD CONSTRAINT "catalog_article_import_jobs_created_by_id_fkey"
FOREIGN KEY ("created_by_id")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
