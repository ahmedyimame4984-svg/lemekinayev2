-- Additive, non-destructive migration: previously submitted applications remain unowned
-- until ownership can be established by a verified Seller account.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

ALTER TABLE "seller_applications" ADD COLUMN "owner_user_id" UUID;
CREATE INDEX "seller_applications_owner_user_id_status_idx"
  ON "seller_applications"("owner_user_id", "status");
ALTER TABLE "seller_applications"
  ADD CONSTRAINT "seller_applications_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "seller_email_verification_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_email_verification_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seller_email_verification_tokens_token_hash_key"
  ON "seller_email_verification_tokens"("token_hash");
CREATE INDEX "seller_email_verification_tokens_user_id_consumed_at_idx"
  ON "seller_email_verification_tokens"("user_id", "consumed_at");
CREATE INDEX "seller_email_verification_tokens_expires_at_idx"
  ON "seller_email_verification_tokens"("expires_at");
ALTER TABLE "seller_email_verification_tokens"
  ADD CONSTRAINT "seller_email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
