-- Admin Pro audit-history read capability and newest-first query indexes.

INSERT INTO "permissions" ("id", "key", "description")
VALUES (
  '00000000-0000-4000-8000-000000000107',
  'admin.audit.read',
  'Read immutable platform audit history'
)
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'admin.audit.read'
WHERE r."key" = 'platform-admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

CREATE INDEX "audit_logs_created_at_idx"
ON "audit_logs"("created_at");

CREATE INDEX "audit_logs_action_created_at_idx"
ON "audit_logs"("action", "created_at");

CREATE INDEX "audit_logs_entity_type_created_at_idx"
ON "audit_logs"("entity_type", "created_at");
