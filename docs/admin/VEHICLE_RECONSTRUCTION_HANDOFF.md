# Vehicle reconstruction continuation handoff

## Current state — 2026-10-07

- Branch: `feat/ethiopia-vehicle-market-integration`.
- Draft PR: [#272](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/272). NOT merged; no merge authorization for this continuation.
- Base main: `38bc6bf5dcd788982ef82b6a6a4f8edee4594eed`, the squash merge of PR #271 under the preceding explicit review-and-merge instruction. A merged PR cannot accept continuation changes, so this branch/PR is necessary.
- Latest implementation SHA before this handoff commit: `e50d6498aa33b7eca6d4352a84636f5e9f2da220`. Latest overall SHA is the PR head including this handoff; CI must be checked against that SHA.
- Foundation PR #271 head `03acdf93b727c32b5df0dc4bfbfeb34150f51ffe`: Validate run 37672840314 and PostgreSQL run 37672840273 both SUCCESS. Prisma, full typecheck, unit/API E2E, lint/build/whitespace, migration preservation, schema contract, baseline-relative drift and read-only PostgreSQL audit passed.

## Work completed in PR #272

Phase A is started, not complete. Added a guarded Admin market staging API:

- GET `/api/v1/admin/vehicles/structured-markets/page`: bounded searchable paginated structured/unclassified market reads with kind/status filters.
- PATCH `/api/v1/admin/vehicles/structured-markets/:id/classification`: explicit COUNTRY/REGION/SPECIFICATION classification for unused Draft markets only. Used/active legacy markets require reviewed reconciliation. No automatic legacy semantic conversion.
- GET `/api/v1/admin/vehicles/configurations/:id/market-memberships`: paginated memberships with market metadata and legacyMarketId shown separately; no inferred assignments.
- POST the same memberships path: stage a DRAFT TARGET/SOURCE membership, bound to expected configuration and market versions. TARGET requires COUNTRY ET; SOURCE excludes ET; configuration must be LHD; market must be explicitly classified and dependencies available. Unchanged draft assignment performs no writes/audit/version increments. Retired memberships cannot be revived through staging.
- Writes use serializable transactions and audit logging. Existing UUID/identityCode/legacy marketId and parent versions remain unchanged. No activation endpoint, no bulk population or reconciliation apply.
- Protected by ADMIN account type and `vehicle.manage`; existing global authentication remains in force.

Exact changed files for this continuation:

1. `apps/api/src/vehicle/dto/vehicle-market.dto.ts`
2. `apps/api/src/vehicle/vehicle-market.service.ts`
3. `apps/api/src/vehicle/vehicle-market.service.spec.ts`
4. `apps/api/src/vehicle/admin-vehicle-market.controller.ts`
5. `apps/api/src/vehicle/vehicle.module.ts`
6. `docs/admin/VEHICLE_RECONSTRUCTION_HANDOFF.md`

Migrations: none added/changed in #272. #271 additive migration remains `20261007200000_vehicle_reconstruction_foundation`.

## Validation

- 20 focused service tests PASS, including no-op assignment, stale versions, RHD/unknown steering, role confusion, unclassified/unavailable dependencies, retired membership protection, unused Draft classification, legacy dependency guards and pagination.
- Focused strict TypeScript for new service/controller/DTO/tests PASS.
- Type-aware lint of new files PASS.
- Prisma schema validation PASS with a disposable placeholder DATABASE_URL; this did not connect to or migrate a database.
- Full local typecheck cannot run on the partial connector-fetched checkout: unrelated imported source files are absent. Do not push its synthetic local Git history.
- Full #272 CI pending when this handoff was written. Check latest head and PR comments for final results; do not assume pending results passed.

## Remaining phases and architectural limits

A: classification/draft staging is implemented. Membership lifecycle/activation, readiness, selector/filter integration, versioned import/export and necessary Admin UI exposure are unfinished. Draft memberships must not appear as published seller fitments. Role/market classification changes on referenced rows require reviewed reconciliation, not these metadata endpoints.
B: integrate all provenance source authority/publication/verification fields into API/services and atomic canonical activation. Verified JSON is not fact verification.
C: configuration-owned drivetrain/material variant DTO/service/read/selector/filter/import/export integration.
D: reviewed hash/revision-bound comparison and persistent idempotent ledger; mapped KEEP/CORRECT/MERGE/REPLACE/ARCHIVE/disposable-supporting DELETE; bounded resumable serializable apply and safe reference migration. No apply command exists.
E: actual local/staging database audit STILL REQUIRED. No live data was available or inspected.
F: researched Ethiopia-relevant LHD population ONLY after A–E are stable and actual audit/reconciliation reviewed. No speculative combinations. EV/hybrid masters/population remain deferred.

## Unsafe operations NOT run

No production database migration, vehicle seed/install, insertion, update, archive, deletion, merge, identity rewrite, reference repointing, verification claim or population. Unit tests use mocks; previous PostgreSQL checks use disposable synthetic CI fixtures. Automatic classifier output never authorizes destructive apply.

## Exact next step and commands

Verify full CI on latest #272 head and fix any failures without weakening checks. Continue Phase A with provenance-aware membership readiness/lifecycle and integration. Keep #272 draft until coherent integration is reviewed; do not merge.

In a full checkout:

```bash
git fetch origin
git switch feat/ethiopia-vehicle-market-integration
git pull --ff-only
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm test
npm run test:e2e
npm run lint
npm run build
git diff --check origin/main...HEAD
```

For the actual audit, use a backed-up/restored local or staging database with the normal .env. Rehearse/apply the additive schema migration first; the audit itself is READ ONLY and does not load AppModule/bootstrap:

```bash
npm run db:migrate
npm run db:generate
npm run build -w api --silent
node apps/api/dist/scripts/audit-vehicle-reconstruction.js --page-size=250 > vehicle-reconstruction-audit.jsonl
```

Require successful exit and a complete footer. Review the audit report and references before any apply design. Missing fields such as marketApplicabilities/driveType in local generated Prisma types require `npm run db:generate` after pulling the updated schema; do not remove those fields to suppress errors.

## Locked decisions

Standard remains `ETHIOPIA_LHD_V1` at `docs/admin/CONFIGURED_VEHICLE_DATA_STANDARD_V1.md`. Ethiopia TARGET, Europe/GCC priority SOURCE, other evidenced LHD source markets allowed; all relevant makes. One mechanical identity may have many market memberships. Generation contains Trim contains configured/technical applicability. Unknown dates stay unknown. UUID and VC-identity history are immutable; configured identities are never hard deleted. Referenced histories are preserved. Old Africa source definitions remain audit-only, never the new production baseline.
