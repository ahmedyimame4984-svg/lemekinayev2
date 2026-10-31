# Lemekinaye EV integration — Stage 1: Database foundation

**Status:** Review in a focused PR. **Owner:** Admin/vehicle reference data.
**Baseline:** reconciled with `main` at `98126f1ad10686bb8a6f3691874670a194011b47`; original Stage 1 head `ed1dc166927a83353255ecb0ee4b835c0206ceb4`.
**New migration:** `20261011173000_vehicle_ev_stage01_foundation`.

## Purpose and scope

Add optional EV, hybrid and plug-in-hybrid technical data to the *spare-parts fitment reference* schema without altering currently configured vehicles or their existing engine/transmission references.

Canonical path remains **Make → Model → optional Derivative / Body Line → Generation → Trim / Variant → Configuration**. A powertrain choice belongs **only inside Configuration**.

Stage 1 contains only Prisma declarations, one additive PostgreSQL migration, read-only/static safety tests and an **isolated test database** migration-verification script. It makes **no** Admin screen, API/DTO, activation, VIN, fitment-matching or existing-record changes. Vehicle entry remains manual; no bulk research, data import or seeding features are being reintroduced.

## Added structures

- `VehiclePowertrainType`: ICE, BEV, HEV, PHEV, MHEV, EREV.
- `VehicleConfiguration.powertrainType` is **nullable**. Existing records remain `NULL` until individually verified; do not infer ICE.
- Optional `batteryPackId` and `chargingSystemId` on a configuration.
- Draft-first reusable masters: `VehicleElectricMotor`, `VehicleBatteryPack`, `VehicleDriveUnit`, `VehicleChargingSystem`; each has create/update actor, status, version and timestamps.
- Explicit many-to-one configuration assignments for motors and drive units with non-null position enum, unique assignment keys and restrictive foreign keys.
- Gross vs usable battery capacity and AC vs DC charging capability stay separate.

Keep original engine, transmission, identity code, fitment hierarchy, production dates, body, source market, steering and permissions intact. The migration neither deletes rows nor sets an EV value on existing records. Unknown technical specifications must remain nullable instead of being guessed.

**Important:** The current API and Admin still implement ICE-oriented validation/entry. Do not attempt to save a BEV/PHEV through existing Admin workflows until Stage 2 API and Stage 3 Configured Vehicles UI are reviewed and merged.

## Five-stage delivery gates

1. **Stage 1 — Database foundation:** this PR; merge only after the verification below.
2. **Stage 2 — API and business validation:** conditional ICE/HEV/PHEV/BEV rules, strict identity/activation, permissions and tests.
3. **Stage 3 — Configured Vehicles UI/UX:** powertrain selection and conditional technical fields in Configuration, consistent with Admin Pro.
4. **Stage 4 — EV parts fitment:** validate compatibility of EV-specific articles with configurations.
5. **Stage 5 — Manual EV data-quality verification:** record-specific evidence and source-market accuracy. No automatic research-data importer.

## Verification on the feature branch

With Node 24, installed dependencies, and no production database changes:

```bash
npm run db:validate
npm run db:generate
node --test scripts/vehicle/ev-database-foundation.test.mjs
```

Then review `packages/database/prisma/migrations/20261011173000_vehicle_ev_stage01_foundation/migration.sql` directly. Every existing configuration and its current engine/transmission assignment must survive unchanged.

### Required migration test — isolated local PostgreSQL test database

Final Stage 1 verification requires **both a fresh, empty database and a separate pre-EV database with synthetic records**. No working-data backup or vehicle dataset is needed. The verifier accepts each mode separately and rejects partial schemas and unknown pending migrations.

**Never run this verification against the working `lemekinaye` database.** The verifier accepts only `lemekinaye_ev_stage01_test` on localhost, refuses `DIRECT_URL`, and never deletes or overwrites a test database.

#### Recommended: new empty test database

On Windows Git Bash, from the Stage 1 branch checkout:

```bash
# Run once only. If this database already exists, stop rather than overwrite it.
# The postgres role (or another authorized role) must have CREATEDB permission.
createdb -h localhost -p 5432 -U postgres -O lemekinaye \
  lemekinaye_ev_stage01_test

# Supply only the password for the test database role; do not print or share it.
(
  unset DATABASE_URL DIRECT_URL
  read -rsp "PostgreSQL password for lemekinaye: " EV_STAGE01_PASSWORD
  echo
  export EV_STAGE01_PASSWORD
  node scripts/vehicle/verify-ev-stage01-migration.mjs
)
```

The verifier inspects the isolated database before writing. If the test database is empty, it applies the repository's **full existing Prisma migration history, including EV Stage 1**, then checks all migrations are recorded, the six EV tables are empty, the three new configuration fields are nullable and no vehicle configurations were invented.

If the database is not empty or the test name is already in use, **stop and ask for review**; do not drop it or reuse your working database.

#### Required: test preservation with synthetic records

A populated **synthetic** test database verifies preservation without reading working or production data. Apply all pre-EV migrations with Prisma to a separate, empty test database and run `packages/database/prisma/tests/ev-stage01-before.sql`. The fixture refuses a different database name, existing users/vehicles, or an already installed EV schema. It creates two clearly labeled test configurations, part-fitment and product-vehicle article links, Manual/VIN garage entries and CHASSIS/VIN mappings. The invented VIN is never decoded. No real vehicle specifications, research or importer are involved.

Run the same verifier. In this mode it applies only the one pending EV migration and compares complete original-column digests and row counts for configurations plus all four link tables. Then run `packages/database/prisma/tests/ev-stage01-after.sql` with `psql -X -v ON_ERROR_STOP=1` against that same isolated target. It checks Draft defaults, nullable unknown battery data, AC-only charging, multiple positions, duplicate rejection, restrictive foreign keys and rollback; temporary EV test mutations roll back.

The dedicated `Vehicle EV database foundation` CI workflow has separate **fresh** and **preservation** jobs, each with its own PostgreSQL 16 service and the fixed test database name. The preservation job temporarily excludes only the Stage 1 migration, initializes the existing migration history and synthetic fixture, restores the migration, then runs the verifier and constraint checks. Both jobs run Prisma validation/generation, the safety tests and existing vehicle/parts-fitment regressions. CI uses literal test-only credentials, no environment secrets or working database.

Expected success in either mode: `STAGE 01 TEST DATABASE MIGRATION VERIFIED`. Never paste passwords, tokens or database URLs into chat, screenshots or GitHub.

**Merge gate:** real `db:validate` and `db:generate`, Node safety tests, successful native Prisma deployment on both an empty PostgreSQL test database and a populated synthetic pre-EV test database, authentic migration-history checks, unchanged vehicle/fitment digests, constraint and rollback checks, migration SQL review, cross-track conflict check, then **explicit owner approval**. Source inspection or manual SQL replay cannot satisfy this gate. No Stage 2 implementation before Stage 1 is verified and actually merged with permission.

## Shared-schema reconciliation — 2026-10-11

After another workstream's merge, the canonical `VehicleConfiguration.productArticles` relation and `ProductVehicleArticle` model now live on `main`. The Stage 1 branch was reconciled on top of that merged commit, retaining these declarations verbatim. Only the existing `User` and `VehicleConfiguration` models receive EV additions; every other upstream model and migration remains intact. Review any later open shared-schema PR before merging. See `EV_INTEGRATION_STAGE_01_VERIFICATION_2026-10-12.md` for the final native Prisma, regression and isolated PostgreSQL evidence. **Both migration-verifier modes now pass on PostgreSQL 16.15, with authentic history and preserved synthetic records.** GitHub Actions still records no allocated runner or executed steps. Stage 1 remains Draft and unmerged for owner review, required CI resolution and explicit merge approval.

