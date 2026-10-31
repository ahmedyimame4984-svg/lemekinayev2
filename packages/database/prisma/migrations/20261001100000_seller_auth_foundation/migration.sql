-- Seller account credential and activation provisioning foundation.

CREATE TABLE "seller_credentials" (
  "user_id" UUID NOT NULL,
  "password_hash" TEXT NOT NULL,
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "seller_credentials_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "seller_provisioning_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "seller_provisioning_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seller_credentials_locked_until_idx"
ON "seller_credentials"("locked_until");

CREATE UNIQUE INDEX "seller_provisioning_tokens_token_hash_key"
ON "seller_provisioning_tokens"("token_hash");

CREATE INDEX "seller_provisioning_tokens_user_id_consumed_at_idx"
ON "seller_provisioning_tokens"("user_id", "consumed_at");

CREATE INDEX "seller_provisioning_tokens_expires_at_idx"
ON "seller_provisioning_tokens"("expires_at");

ALTER TABLE "seller_credentials"
ADD CONSTRAINT "seller_credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_provisioning_tokens"
ADD CONSTRAINT "seller_provisioning_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
