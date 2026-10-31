CREATE TABLE "admin_import_jobs" (
    "id" UUID NOT NULL,
    "workflow" VARCHAR(40) NOT NULL,
    "dataset_reference" VARCHAR(200),
    "file_name" VARCHAR(255),
    "file_format" VARCHAR(16) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    "total_rows" INTEGER NOT NULL,
    "included_rows" INTEGER NOT NULL,
    "excluded_rows" INTEGER NOT NULL DEFAULT 0,
    "warning_rows" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_import_jobs_workflow_created_at_idx"
ON "admin_import_jobs"("workflow", "created_at");

CREATE INDEX "admin_import_jobs_created_by_id_created_at_idx"
ON "admin_import_jobs"("created_by_id", "created_at");

CREATE INDEX "admin_import_jobs_created_at_idx"
ON "admin_import_jobs"("created_at");

ALTER TABLE "admin_import_jobs"
ADD CONSTRAINT "admin_import_jobs_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "admin_import_jobs" (
    "id",
    "workflow",
    "dataset_reference",
    "file_name",
    "file_format",
    "status",
    "total_rows",
    "included_rows",
    "excluded_rows",
    "warning_rows",
    "created_count",
    "metadata",
    "created_by_id",
    "created_at"
)
SELECT
    "id",
    'MANUFACTURER_ARTICLE',
    "dataset_reference",
    "file_name",
    "file_format",
    'COMPLETED',
    "total_rows",
    "included_rows",
    "excluded_rows",
    "warning_rows",
    "created_count",
    jsonb_build_object('previewFingerprint', "preview_fingerprint"),
    "created_by_id",
    "created_at"
FROM "catalog_article_import_jobs"
ON CONFLICT ("id") DO NOTHING;
