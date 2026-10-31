# Shared Vehicle Generation Family — additive foundation

**PR scope / 2026-10-09:** The first schema-only implementation item. This is an optional grouping master, not a new dataset revision or administrative creation workflow.

## Why

- Multiple derivative-scoped Generation records may represent one documented model-level family without merging their identities.
- Each family must be established through reviewed technical evidence, not inferred from generation names, dates, markets or similarity of fitments.
- Body Lines, trims, configured vehicles and fitment applicability remain separate and unchanged.

The older hierarchy Make → Model → (optional Derivative / Body Line) → Generation → Trim → Configuration is preserved. Nothing is inferred from generation name, dates, destination markets, or codes.

## Schema contract implemented

`VehicleGenerationFamily` is a Model-owned technical *identity group* with a model-scoped code, readable name, optional production years, and lifecycle fields defaulting to **DRAFT / UNKNOWN**. The `VehicleGeneration.familyId` link is optional. Its composite foreign key `(familyId, modelId) → (id, modelId)` **prevents assignment to a family owned by another model at database level**.

No generation, derivative, trim or configuration foreign keys are changed. The migration creates a new empty family table and a nullable link column; it performs no record merges, deletes, ET market assignments, backfill, activation or VIN/fitment writes. Legacy data continues working with `familyId = null`.

## Follow-up gates (NOT implemented by this PR)

1. Add a permission-gated Admin/API workflow to propose/review family identities with authoritative documentary provenance and explicit per-Generation mappings, validated transactionally and audit-logged.
2. Add read-only UI grouping, with existing Generations and Body Lines visible underneath; unknown or unmapped Generations must remain visible separately. Do not parse names into speculative family IDs.
3. Reconcile facelift/part applicability, source markets and exact year/engine/transmission identity via OEM evidence.
4. Test on a staging backup before any actual link assignment, verify seller/fitment/VIN/history references, and only then consider production reconciliation. Separate activation approval.

## Validation

- `node --test scripts/vehicle/generation-family-foundation.test.mjs` — six tests: two additive migration contract checks and four self-contained synthetic relationship checks (optional families, multiple Generations per Family, cross-model rejection, configured-vehicle and fitment preservation).
- `npm exec -w api -- vitest run src/vehicle/generation-family-foundation.spec.ts` — the corresponding six focused Vitest cases; neither suite requires historical research files.
- `npm run db:validate` — Prisma schema parse and relation checks (requires local workspace dependencies).
- `psql ... -v ON_ERROR_STOP=1 -f packages/database/prisma/tests/vehicle-generation-family-contract.sql` — on a **disposable/staging migrated database only**, confirms nullable FK, cross-model guard, no backfill and UNKNOWN default.

### Disposable PostgreSQL cross-model acceptance check

A dedicated CI workflow, [vehicle-generation-family.yml](../../.github/workflows/vehicle-generation-family.yml), uses Node 24 and an isolated PostgreSQL 16 database named `generation_family_ci`. It first applies every migration **except** the new family migration, inserts the existing synthetic preservation fixture, applies the family migration, and runs the no-backfill schema contract and a rollback-protected FK smoke check.

The new [transactional FK acceptance script](../../packages/database/prisma/tests/vehicle-generation-family-cross-model.sql) tests a permitted same-Model link and an illegal cross-Model link; it requires the synthetic Generation fixture and a disposable database name ending in `_test`, `_staging`, or `_ci`. It deliberately finishes with `ROLLBACK`, verifies that the temporary records disappeared, and refuses to run against a normally named production database.

**Local read-only commands** on the new feature branch (Node 24 required):

```bash
git fetch origin
git switch --track origin/feat/vehicle-generation-family-clean
node --test scripts/vehicle/generation-family-foundation.test.mjs
npm run db:validate
```

For manual SQL acceptance, first make an isolated, disposable PostgreSQL database, install the preceding migration history and synthetic fixture there, then apply this new migration before running the two SQL checks below. **Do not run `npm run db:migrate` against the working Lemekinaye database for this test.**

```bash
psql -h localhost -p 5432 -U lemekinaye -d lemekinaye_family_test \
  -v ON_ERROR_STOP=1 \
  -f packages/database/prisma/tests/vehicle-generation-family-contract.sql
psql -h localhost -p 5432 -U lemekinaye -d lemekinaye_family_test \
  -v ON_ERROR_STOP=1 \
  -f packages/database/prisma/tests/vehicle-generation-family-cross-model.sql
```

The Node and Vitest tests use synthetic in-memory fixtures and structural assertions; they do **not** replace actual Prisma validation or PostgreSQL migration rehearsal. Before the final review corrections, local isolated PostgreSQL 16 upgrade and fresh-install acceptance was reported successful with 67 migrations, FK rollback and preservation checks. The final review also added model-deletion dependency preflight and family production-year check constraints. **Rerun focused API tests and migrate the revised SQL against a newly created disposable database before merging**; databases that applied the earlier unmerged version of this migration cannot validate the new constraint checks merely by running `prisma migrate status`. GitHub CI is **not asserted successful** until a run completes. CI billing restrictions may prevent jobs from starting. Do not merge this PR on static checks alone.
