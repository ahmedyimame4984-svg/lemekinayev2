-- CreateEnum
CREATE TYPE "AdminAuthChallengeType" AS ENUM ('MFA_ENROLLMENT', 'LOGIN');

-- AlterTable
ALTER TABLE "sessions"
ADD COLUMN "refresh_token_hash" CHAR(64),
ADD COLUMN "refresh_expires_at" TIMESTAMP(3),
ADD COLUMN "mfa_verified_at" TIMESTAMP(3),
ADD COLUMN "source_ip_hash" CHAR(64),
ADD COLUMN "user_agent" VARCHAR(300),
ADD CONSTRAINT "sessions_refresh_pair_check" CHECK (
    ("refresh_token_hash" IS NULL AND "refresh_expires_at" IS NULL)
    OR (
        "refresh_token_hash" IS NOT NULL
        AND "refresh_expires_at" IS NOT NULL
        AND "refresh_expires_at" >= "expires_at"
    )
);

-- CreateTable
CREATE TABLE "admin_credentials" (
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mfa_secret_ciphertext" TEXT NOT NULL,
    "mfa_secret_nonce" VARCHAR(24) NOT NULL,
    "mfa_secret_auth_tag" VARCHAR(24) NOT NULL,
    "mfa_enrolled_at" TIMESTAMP(3),
    "last_totp_counter" BIGINT,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "failed_mfa_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "admin_credentials_failed_login_attempts_check" CHECK ("failed_login_attempts" >= 0),
    CONSTRAINT "admin_credentials_failed_mfa_attempts_check" CHECK ("failed_mfa_attempts" >= 0)
);

-- CreateTable
CREATE TABLE "admin_provisioning_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_provisioning_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_provisioning_tokens_failed_attempts_check" CHECK ("failed_attempts" >= 0)
);

-- CreateTable
CREATE TABLE "admin_auth_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provisioning_token_id" UUID,
    "type" "AdminAuthChallengeType" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_auth_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_auth_challenges_failed_attempts_check" CHECK ("failed_attempts" >= 0),
    CONSTRAINT "admin_auth_challenges_enrollment_token_check" CHECK (
        ("type" = 'MFA_ENROLLMENT' AND "provisioning_token_id" IS NOT NULL)
        OR ("type" = 'LOGIN' AND "provisioning_token_id" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "auth_throttles" (
    "key_hash" CHAR(64) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "blocked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_throttles_pkey" PRIMARY KEY ("key_hash"),
    CONSTRAINT "auth_throttles_attempts_check" CHECK ("attempts" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");
CREATE INDEX "admin_credentials_locked_until_idx" ON "admin_credentials"("locked_until");
CREATE UNIQUE INDEX "admin_provisioning_tokens_token_hash_key" ON "admin_provisioning_tokens"("token_hash");
CREATE INDEX "admin_provisioning_tokens_user_id_consumed_at_idx" ON "admin_provisioning_tokens"("user_id", "consumed_at");
CREATE INDEX "admin_provisioning_tokens_expires_at_idx" ON "admin_provisioning_tokens"("expires_at");
CREATE UNIQUE INDEX "admin_auth_challenges_token_hash_key" ON "admin_auth_challenges"("token_hash");
CREATE INDEX "admin_auth_challenges_user_id_type_consumed_at_idx" ON "admin_auth_challenges"("user_id", "type", "consumed_at");
CREATE INDEX "admin_auth_challenges_expires_at_idx" ON "admin_auth_challenges"("expires_at");
CREATE INDEX "auth_throttles_action_updated_at_idx" ON "auth_throttles"("action", "updated_at");
CREATE INDEX "auth_throttles_blocked_until_idx" ON "auth_throttles"("blocked_until");

-- AddForeignKey
ALTER TABLE "admin_credentials" ADD CONSTRAINT "admin_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_provisioning_tokens" ADD CONSTRAINT "admin_provisioning_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_auth_challenges" ADD CONSTRAINT "admin_auth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_auth_challenges" ADD CONSTRAINT "admin_auth_challenges_provisioning_token_id_fkey" FOREIGN KEY ("provisioning_token_id") REFERENCES "admin_provisioning_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
