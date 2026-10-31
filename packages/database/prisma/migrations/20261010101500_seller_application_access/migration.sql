CREATE TABLE "seller_application_access_challenges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "purpose" VARCHAR(30) NOT NULL DEFAULT 'ACCESS',
  "target_email" VARCHAR(254),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_application_access_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_application_access_challenges_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "seller_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "seller_application_access_challenges_application_id_expires_at_idx"
  ON "seller_application_access_challenges" ("application_id", "expires_at");

CREATE TABLE "seller_application_access_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_application_access_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_application_access_sessions_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "seller_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "seller_application_access_sessions_token_hash_key"
  ON "seller_application_access_sessions"("token_hash");
CREATE INDEX "seller_application_access_sessions_application_id_expires_at_idx"
  ON "seller_application_access_sessions"("application_id", "expires_at");
