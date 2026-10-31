# EV Stage 1 verification — 2026-10-12

**Database/test execution:** 2026-10-13 EAT / 2026-10-12 UTC. **Final repository/CI review:** 2026-10-13, 06:35 EAT / 03:35 UTC.
**Owner/track:** Ahmed — Admin vehicle-fitment reference data.
**PR:** #329, Draft and unmerged, ready for owner technical review.
**Main baseline:** `98126f1ad10686bb8a6f3691874670a194011b47`.
**Tested implementation commit:** `1e0c81826f8f781802a82808823e6b2b26a6f225`. The subsequent report update changes documentation only; its final head SHA is recorded in the PR description.
**Approved architecture:** PR #330 at `00c5fcf1fa72cb1edf874898ec843099b5729029`; no Stage 2 runtime implementation or merge is included.

## Result

**The native Prisma Migrate blocker is resolved.** Both the completely empty database and the populated synthetic pre-EV upgrade passed the migration verifier. Native Prisma executed the migrations and wrote authentic history; no history was fabricated or manually stamped. The earlier manual SQL replay is retained only as historical SQL evidence.

GitHub Actions remains an independent infrastructure blocker: the latest code-head run and a controlled retry recorded no allocated runner or executed steps. This report does not claim green CI. Required CI resolution, owner review and explicit merge approval remain outstanding.

## Executed checks

| Check | Actual final result |
| --- | --- |
| Toolchain | Node 24.19.0, npm 11.9.0, Prisma/Client 7.10.0, Vitest 4.1.11, PostgreSQL server and psql 16.15 |
| `npm run db:validate` | PASS — exit 0, schema valid |
| `npm run db:generate` | PASS — exit 0, Prisma Client 7.10.0 generated |
| EV tests | PASS — **20 tests**, 0 failed/skipped/cancelled; includes the new connection-timeout regression |
| Existing vehicle/fitment tests | PASS — **3 files, 69 tests**, 0 failures |
| Empty database full deployment | PASS — native `prisma migrate deploy` applied all **64 migrations**; verifier exit 0 and `STAGE 01 TEST DATABASE MIGRATION VERIFIED` |
| Pre-EV initialization | PASS — native `npm run db:migrate` applied all **63 upstream migrations**, exit 0; the EV file was temporarily excluded and restored unchanged |
| Populated pre-EV upgrade | PASS — synthetic fixture inserted, then native Prisma applied the one pending EV migration; verifier reported Prisma exit 0 and completed with exit 0 |
| Authentic `_prisma_migrations` | PASS — each final database has **64 unique completed rows, 64 matching file checksums, 0 failed/incomplete rows, 0 rolled-back rows**; every row has timestamps, NULL logs and `applied_steps_count=1` |
| Prior migration-history preservation | PASS — all **63 original history rows** retain the same complete-row digest: `9bb2737502a152a748667c3e576779a2` |
| Existing data preservation | PASS — counts and complete original-column digests match for **13 tables**, including vehicle hierarchy, configuration, fitment, garage, VIN/CHASSIS mappings and ProductVehicleArticle |
| EV schema safety | PASS — 6 empty EV tables, 3 nullable configuration columns, all historical EV fields NULL; **14 validated foreign keys**, all RESTRICT on delete / CASCADE on update |
| PostgreSQL constraint fixture | PASS — psql exit 0: Draft/version defaults, nullable battery data, AC-only charging, multiple motor positions, duplicate motor/drive assignment rejection, restrictive component deletion, missing configuration/battery/charger/audit-actor rejection, explicit VIN preservation |
| EV DDL transaction rollback | PASS — native psql applied the EV DDL inside BEGIN/ROLLBACK; both new enum types, all 6 EV tables and all 3 added columns were absent afterwards; original 63 history rows and all 13 data digests matched |
| Component/assignment rollback | PASS — constraint checks roll back temporary EV mutations; all 6 EV tables remain empty and all 13 original data digests match afterwards |
| Idempotent deployment | PASS — `npm run db:migrate`, exit 0, `No pending migrations to apply` |
| Migration status | PASS — native `prisma migrate status`, exit 0, 64 migrations and `Database schema is up to date!` |
| Prisma-generated additive DDL | PASS — enum values/table columns, 14 indexes, 14 foreign keys and 3 added columns match the hand-written EV migration after layout normalization |
| Latest-main compatibility | PASS — main remains the baseline above; fresh main-to-code-head comparison has **0 commits behind and exactly 10 EV database/test/documentation files** |
| Existing Prisma declarations | PASS — all **126 existing model/enum blocks** and old declarations retained; only User and VehicleConfiguration extended, 8 new blocks |
| Workflow / script syntax | PASS — CI YAML parsed (fresh/preservation, postgres:16), both helper/verifier scripts pass `node --check` |
| Full application suites, typechecks, lint, builds, E2E and live Admin acceptance | NOT RUN — targeted existing API regressions ran; this PR adds no application/UI behavior |

The earlier locked dependency install (`npm ci --no-audit --no-fund`, 571 packages) was reused rather than restarting the work.

## Isolation and actual migration method

Final empty-database evidence is from new disposable PG16 project `lively-dew-30598485`, branch `br-crimson-lake-b4b6pj8l`. Final preservation evidence is from new disposable PG16 project `little-heart-25782599`, branch `br-dark-violet-b4quonhn`. Each started with an empty public schema and uses only database `lemekinaye_ev_stage01_test` and role `ev_stage01_test`.

An earlier native run used disposable project `holy-tree-08241333`, fresh branch `br-purple-hill-b43ahrb8` and preservation branch `br-bold-breeze-b4cqrkxv`. It also produced real 64-migration history and matching preservation audits; a tool interruption during its preservation verifier led to the clean final run above. Previously created disposable project `aged-river-74509368` was used only for a read-only native connectivity probe during this final cycle. Its earlier manual SQL replay is not the Prisma acceptance evidence.

Direct TCP/DNS remains unavailable in this runtime. A temporary transport under `/workspace/scratch/86ec451d2908/ev-stage01-transport-runtime` forwarded native PostgreSQL wire bytes from loopback port 6543 to a fixed test-only, non-pooled Neon endpoint over certificate-verified secure WebSocket. It accepts only the fixed test database and role, does not parse/replay SQL, and does not write migration history. Native Prisma and psql remain the database clients. The remote leg is encrypted; optional inner loopback SSL requests receive N. Transport dependencies (ws 8.22.0 / https-proxy-agent 9.1.0, plus a serverless-driver probe) were installed outside the repository; no application dependency or lockfile changed.

Only repository migrations and clearly labeled synthetic records initialized these databases. No working/production database, connection string, dump, backup or real VIN data was accessed, copied, reset or deleted. All six test endpoints were confirmed idle at the final review; schemas are retained for review, local test credentials cleared, and temporary relays stopped.

## Exact core commands

From `/workspace/scratch/86ec451d2908/lemekinaye`, the validation/generation and API pretest hook used this explicit, non-sensitive placeholder (these commands do not require a live database):

```bash
DATABASE_URL='postgresql://ev_stage01_test@127.0.0.1:6543/lemekinaye_ev_stage01_test?schema=public' DIRECT_URL='' npm run db:validate
DATABASE_URL='postgresql://ev_stage01_test@127.0.0.1:6543/lemekinaye_ev_stage01_test?schema=public' DIRECT_URL='' npm run db:generate
node --test scripts/vehicle/ev-database-foundation.test.mjs
DATABASE_URL='postgresql://ev_stage01_test@127.0.0.1:6543/lemekinaye_ev_stage01_test?schema=public' DIRECT_URL='' npm run test -w api -- src/vehicle/vehicle-configuration.service.spec.ts src/vehicle/vehicle-configuration-identity.spec.ts src/compatibility/compatibility.service.spec.ts
DATABASE_URL='postgresql://ev_stage01_test@127.0.0.1:6543/lemekinaye_ev_stage01_test?schema=public' DIRECT_URL='' npm exec -- prisma migrate diff --config packages/database/prisma.config.ts --from-schema /workspace/scratch/86ec451d2908/ev-main.schema.prisma --to-schema packages/database/prisma/schema.prisma --script --output /workspace/scratch/86ec451d2908/ev-stage01-generated-final.sql
node --check scripts/vehicle/verify-ev-stage01-migration.mjs
node --check scripts/vehicle/ev-stage01-test-environment.mjs
```

The following exact native commands were launched from `/workspace/scratch/86ec451d2908`. The temporary wrapper creates the relay, supplies the selected test-only credentials through environment variables, redacts credentials from output, runs its child in the repository and closes the relay. For psql/verifier commands, PATH included `/workspace/scratch/86ec451d2908/ev-stage01-pg16-client/extracted/usr/lib/postgresql/16/bin` and LD_LIBRARY_PATH was `/workspace/scratch/86ec451d2908/ev-stage01-pg16-client/extracted/usr/lib/x86_64-linux-gnu`.

```bash
# Fresh mode; internally invokes npm run db:migrate -> prisma migrate deploy.
node ev-stage01-transport-runtime/run-with-relay.mjs node scripts/vehicle/verify-ev-stage01-migration.mjs

# Separate pre-EV environment; preserve/restore the EV file via EXIT trap.
ev_stage01_path='/workspace/scratch/86ec451d2908/lemekinaye/packages/database/prisma/migrations/20261011173000_vehicle_ev_stage01_foundation'
ev_stage01_stash='/workspace/scratch/86ec451d2908/ev-stage01-pre-ev-stash'
mv "$ev_stage01_path" "$ev_stage01_stash"
trap 'mv "$ev_stage01_stash" "$ev_stage01_path"' EXIT
node ev-stage01-transport-runtime/run-with-relay.mjs npm run db:migrate
# The EXIT trap restores the unchanged file when this preparation shell exits.

# With the file restored, on the separate pre-EV target:
node ev-stage01-transport-runtime/run-with-relay.mjs psql -X -v ON_ERROR_STOP=1 -f packages/database/prisma/tests/ev-stage01-before.sql
node ev-stage01-transport-runtime/run-with-relay.mjs node /workspace/scratch/86ec451d2908/ev-stage01-transport-runtime/audit.cjs before /workspace/scratch/86ec451d2908/ev-stage01-final-preservation-before.json
node ev-stage01-transport-runtime/run-with-relay.mjs psql -X -v ON_ERROR_STOP=1 -c BEGIN -f packages/database/prisma/migrations/20261011173000_vehicle_ev_stage01_foundation/migration.sql -c ROLLBACK
node ev-stage01-transport-runtime/run-with-relay.mjs node /workspace/scratch/86ec451d2908/ev-stage01-transport-runtime/audit.cjs rollback /workspace/scratch/86ec451d2908/ev-stage01-final-preservation-before.json
node ev-stage01-transport-runtime/run-with-relay.mjs node scripts/vehicle/verify-ev-stage01-migration.mjs
node ev-stage01-transport-runtime/run-with-relay.mjs psql -X -v ON_ERROR_STOP=1 -f packages/database/prisma/tests/ev-stage01-after.sql
node ev-stage01-transport-runtime/run-with-relay.mjs npm run db:migrate
node ev-stage01-transport-runtime/run-with-relay.mjs npm exec -- prisma migrate status --config packages/database/prisma.config.ts
node ev-stage01-transport-runtime/run-with-relay.mjs node /workspace/scratch/86ec451d2908/ev-stage01-transport-runtime/audit.cjs after /workspace/scratch/86ec451d2908/ev-stage01-final-preservation-before.json
```

The fresh environment also ran `audit.cjs fresh`. The audit reads real history and compares SHA-256 against each SQL file; it verifies completed timestamps, unique migration names, NULL failure logs, one applied step and no rollback marks. It compares ID-ordered full-row JSON digests (excluding only the 3 new EV columns from configurations) and verifies all 14 EV foreign keys are validated with the expected actions. The SQL BEGIN/ROLLBACK test proves isolated DDL rollback; no working-database rollback was attempted.

## Preservation evidence — final synthetic environment

Every digest below matched before migration, after the DDL rollback test, after Prisma upgrade and after the constraint fixture. Fixtures contain one legacy Active configuration (version 3, engine/transmission retained), one incomplete Draft (version 2), Manual/VIN garage entries, CHASSIS/VIN mappings and one existing ProductVehicleArticle. The invented 17-character VIN is labeled EVTEST and never decoded.

| Existing table | Rows | Matching original-data digest |
| --- | ---: | --- |
| vehicle_configurations | 2 | `a19e01f412ce7e0ef95e980ccd2a86bb` |
| vehicle_compatibilities | 1 | `5a1e56327cf25d1a2ef89db1d4dacd68` |
| vehicle_profiles | 2 | `8243791fe7aab48fcc275c0ba2481e91` |
| vehicle_identifier_mappings | 2 | `87b12e2ee4a2fd6a50dffeac6ed8eb44` |
| product_vehicle_articles | 1 | `10406f17712649cfccbfd1031baa8b27` |
| vehicle_makes | 1 | `da82ad15c2602c7b4214d1d656052608` |
| vehicle_models | 1 | `b12bcfd438b6b7197316c10a0f3ae67d` |
| vehicle_generations | 1 | `6ad0c2fb26a2d176da0e3c18dc17435f` |
| vehicle_trims | 1 | `2177ca487dfd6a41bd7e7edf8247ccb6` |
| vehicle_engines | 1 | `278b3b6cc2705444ca5ea339fd837c49` |
| vehicle_transmissions | 1 | `335b464651bfd631ff967ab3ef52bb73` |
| vehicle_body_types | 1 | `f307b344fdb006d4304c3f90c24714f1` |
| vehicle_markets | 1 | `c141dffa75df4cfa1b83202b4406c239` |

## Reviewed source identities and focused fixes

| Tested file | SHA-256 |
| --- | --- |
| Prisma schema | `d2e2fd4a13cefc5d05c06463c9db53ab218e1de570e870f515f16a74da7bbedc` |
| EV migration | `09242cb530b2f6be7cf01f293edc2b35e93bc138e63942351d0ac473fc37f6c2` |
| Before fixture | `9a4c6dd800c0dd05377910243e5a5c96e30115a434359998ddb8781a74cdfce2` |
| After fixture | `6ba84e4c2f726f0cceb90bbfe7c4d9c48748e483401c0060912661e298044387` |

The schema and EV migration are unchanged from the previous Stage 1 code. This cycle fixed the test helper's hardcoded libpq timeout: an explicit URL `connect_timeout=30` now also sets PGCONNECT_TIMEOUT=30, with a bounded 1–60 second input check and regression test. It added VIN/garage preservation coverage and an immediate Prisma exit-0 diagnostic in the verifier. No API, Admin/Seller UI, existing upstream migration, reference hierarchy or root lockfile was edited.

Earlier isolation hardening remains intact: inherited PG routing and dotenv override removal, explicit-role/loopback/fixed-name/public-schema guards, reserved-character password handling, empty-public-object checks, unknown-history rejection and original fitment row fingerprints. No retired research datasets, vehicle import tools or features were restored.

## Superseded attempts and limitations

- Earlier direct native connection attempts failed with Schema engine error / EAI_AGAIN; verified WSS wire transport resolved the connectivity blocker. Manual SQL replay was never counted as a Prisma pass.
- An API test invocation without DATABASE_URL stopped at its Prisma-generation pretest (exit 1, zero tests executed). The explicit test-target rerun passed all 69 tests.
- One preservation verifier stopped on psql connection timeout before migration; the ignored explicit timeout was corrected. Another tool session reported network approval cancellation after Prisma had recorded the EV migration; it was not counted as a completed verifier pass. The clean final preservation verifier completed with exit 0.
- An exploratory master-code uniqueness assertion failed (psql exit 3). It was an incorrect test assumption: Stage 1 defines ordinary code indexes, with uniqueness on configuration/component/position assignments. The assertion was removed without changing the approved schema; the corrected fixture passed and its writes rolled back.
- Raw generated-DDL comparison differed only by trailing whitespace; the final semantic comparison handles inline versus ALTER foreign-key layout and passed.
- Full UI/operator acceptance, application-wide checks and production migration/load/rollback were not performed or claimed.

## CI and final merge gate

At tested code head `1e0c81826f8f781802a82808823e6b2b26a6f225`, EV workflow [38318683217](https://github.com/ahmedyimame4984-svg/lemekinaye/actions/runs/38318683217) failed on both the initial run and a controlled failed-jobs retry. Initial jobs `115041327425` (fresh, failure) and `115041327674` (preservation, cancelled), and retry jobs `115041600882` / `115041601161`, all have **runner_id=0, empty runner name and steps=[]**. Retry fresh-job log retrieval returned **404 BlobNotFound**. Validate [38318683199](https://github.com/ahmedyimame4984-svg/lemekinaye/actions/runs/38318683199), job `115041327502`, likewise failed with no runner/steps. Vehicle reconstruction `38318683202` and Master lifecycle `38318683194` also concluded failure. These runs produced zero application or database test results. Available metadata does not establish the account/platform cause; no workflow or account setting was changed to bypass the failure.

Main, AGENTS.md, the Admin Pro master plan, approved #330 architecture and relevant open work were rechecked. No current shared-schema overlap requires changing Seller-owned work. The final main-to-head diff remains limited to the same 10 EV files; the report commit changes documentation only.

1. Owner reviews #329's native PostgreSQL evidence, focused changes and final diff.
2. Resolve GitHub Actions runner availability / any required CI checks; a green workflow is still not available.
3. Obtain **explicit owner merge approval**. Do not merge under this task without it.
4. Only after Stage 1 is actually merged with permission, begin focused Stage 2 API/business validation based on approved #330 topology rules.

**Admin Pro traceability:** supports #22 validation, #25 concurrency/data safety, #30 canonical reference ownership and #53 backward compatibility, Vehicle Pro / Master-Data Quality. This foundation does not mark Admin UI/UX acceptance or the complete EV integration delivered.

---

## Task 2 synchronization — 2026-10-14

**Admin Pro / EV Stage 1 only.** The evidence below concerns branch synchronization and read-only source inspections; it is not a rerun of executable tests.

### Git reconciliation

- Main SHA: c9135f8f75a5b7a96136f1e4c64a050266adc4b1.
- Previous EV head: ead490c9abba1bb3af2c0b5c5bf4d24eb5fc13eb.
- Merge synchronization commit: 3fb09d4bb6d89e57f88bfba0c8d6cc70a26c5455. Its first parent is the EV head; its second parent is main. Neither history was rewritten.
- Integration tree: the main tree plus the 10 existing EV Stage 1 file blobs. No additional application feature changes.
- GitHub compare and changed-file APIs agree: 14 commits ahead, 0 behind, and 10 EV-only changed files. The earlier 51-file PR listing reflected the diverged base and has been resolved by synchronization.
- PR remains open and Draft; neither main nor any database was modified.

### Verification at synchronized merge commit

| Check | Observed result |
| --- | --- |
| Branch merge, compare, metadata and 10-file scope | PASS (GitHub readback) |
| Read-only Prisma source inspection | PASS: all 126 previous model/enum declarations retained; 8 additive declarations |
| Read-only EV shape inspection | PASS: ICE, BEV, HEV, PHEV, MHEV and EREV; four masters; two assignment models; nullable historical powertrain |
| Stage 1 SQL source inspection | PASS: six added tables; no direct UPDATE, DELETE, TRUNCATE or DROP statement |
| Prisma validate/generate on updated head | BLOCKED / NOT RUN (runtime Node 22.16.0; project requires Node 24) |
| 20 EV executable tests | NOT RUN on updated head |
| 69 vehicle/fitment executable regression tests | NOT RUN on updated head |
| Native Prisma migration on fresh/preservation PostgreSQL 16 | BLOCKED / NOT RUN (no isolated PostgreSQL 16 server/client in execution runtime) |
| Foreign keys, uniqueness, DDL rollback and 13-table digests | NOT RUN on updated head |
| Full API/Admin, E2E and operator UI acceptance | NOT RUN |
| GitHub Actions | NOT counted as code verification; previous jobs ran zero steps |

**Prior passes are historical only:** the earlier 20 EV tests, 69 regressions, 64 native migrations and 13-table preservation checks were executed on the previously recorded implementation commit and baseline. This synchronization does not make them a PASS for the new head.

### Current Stage 1 changed files

- .github/workflows/vehicle-ev-database-foundation.yml
- docs/vehicle/EV_INTEGRATION_STAGE_01.md
- docs/vehicle/EV_INTEGRATION_STAGE_01_VERIFICATION_2026-10-12.md
- packages/database/prisma/migrations/20261011173000_vehicle_ev_stage01_foundation/migration.sql
- packages/database/prisma/schema.prisma
- packages/database/prisma/tests/ev-stage01-after.sql
- packages/database/prisma/tests/ev-stage01-before.sql
- scripts/vehicle/ev-database-foundation.test.mjs
- scripts/vehicle/ev-stage01-test-environment.mjs
- scripts/vehicle/verify-ev-stage01-migration.mjs

### Outstanding gate

In a supported Node 24 environment with an explicitly isolated and disposable PostgreSQL 16 test target, rerun Prisma validate/generate, the 20 EV tests, 69 vehicle/fitment regressions, native fresh and preservation migration verifiers, synthetic FK/uniqueness checks and rollback/digest checks. Capture exact exit codes and resulting history. Do not deploy against working or production databases. Obtain owner review and explicit merge authorization after these checks; do not start Stage 2.
