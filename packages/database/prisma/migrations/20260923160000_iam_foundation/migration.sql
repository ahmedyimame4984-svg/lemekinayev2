-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CUSTOMER', 'SELLER', 'BUSINESS', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PROVISIONED', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "phone" VARCHAR(32),
ADD COLUMN "name" TEXT,
ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'PROVISIONED';

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "user_roles_assigned_by_id_idx" ON "user_roles"("assigned_by_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed stable system roles and permissions. No Admin user is created here.
INSERT INTO "roles" ("id", "key", "name", "description", "is_system", "updated_at") VALUES
('00000000-0000-4000-8000-000000000001', 'platform-admin', 'Platform Admin', 'Full platform administration role', true, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000002', 'admin-staff', 'Admin Staff', 'Restricted administrative operations role', true, CURRENT_TIMESTAMP);

INSERT INTO "permissions" ("id", "key", "description") VALUES
('00000000-0000-4000-8000-000000000101', 'admin.portal.access', 'Access the Admin Portal'),
('00000000-0000-4000-8000-000000000102', 'admin.accounts.read', 'Read account administration data'),
('00000000-0000-4000-8000-000000000103', 'admin.accounts.manage', 'Manage account lifecycle state'),
('00000000-0000-4000-8000-000000000104', 'admin.roles.manage', 'Manage role and permission assignments'),
('00000000-0000-4000-8000-000000000105', 'catalog.manage', 'Manage catalog master data');

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT '00000000-0000-4000-8000-000000000001', "id" FROM "permissions";

INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES
('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101'),
('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102');
