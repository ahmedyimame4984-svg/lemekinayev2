# Admin Pro — Generation Family management (2026-10-18)

Owner: Ahmed / Admin Pro. Baseline: current main `dbcc60645f550532b9f8a0a6766dd79a8cba26b9`.
Status: owner requested review and source merge after the initial draft handoff. Focused review corrections are recorded below. Deployment and original-database operations remain unauthorized.

## Sequencing and scope

- This branch is based directly on current main, not stacked on a draft migration branch. It contains no Prisma schema/migration changes.
- Draft [#350](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/350) was OPEN/DRAFT/UNMERGED at initial preflight, then was CLOSED WITHOUT MERGE during this session (2026-10-18 21:58 EAT), with no explanatory issue comment. Its changes are absent from main. Do not interpret closure as acceptance or reopen it automatically. Current main already contains every schema field used by this UI/API. Under the owner's subsequent review-and-merge authorization, the source-only merge may proceed after focused review/testing; the migration-history reconciliation and restored-original-backup acceptance remain mandatory before deployment, original-environment migration or real-data link assignment. Fresh-install testing here does not satisfy that backup/upgrade gate.
- LEM SYNC discovered existing draft [#351](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/351), based on #350. This branch reuses its 23-file feature diff and corrects/validates it on main. These are alternative implementations of the same scope: do not merge both. #351 is left intact for owner review; select one canonical UI PR after review.
- Relevant open work at final recheck: #334/#335 Admin catalog, #344/#348, and EV #330/#341/#342/#343. #341 shares the lifecycle enum/service and VehicleModule extension points: only Family cases are added here; no EV code is copied. Rebase/re-run the affected lifecycle suite whichever PR lands second. This change does not edit Seller files, EV contracts, configured-vehicle identity code, fitment logic, Prisma schema or migrations.
- The dirty `C:/Development/lemekinaye` checkout was read only. All work ran in a separate clone. Original database `127.0.0.1:5432/lemekinaye` was never connected to, migrated, reset or used for tests.

## Operator workflow and protections

1. Vehicles → Generation Families: desktop-dense, server-paged table (50 rows), debounced name/code search, Make → Model cascading filters, all lifecycle status filters, clear filters and pagination.
2. Create/Edit uses the shared right drawer, searchable Model selector, fixed Model after creation, save locking, focus/keyboard/unsaved-change handling and explicit errors. Name is required; production years are optional. Ended requires an end year; Current/Unknown prohibit one; reversed and out-of-range years are rejected. Internal code is generated only after explicit creation; no Family is inferred from existing codes/names.
3. Inspect & assign shows same-model Generations, Body Lines, periods, status and current grouping. Every checkbox starts from persisted membership. There is no select-all, inference, cross-model movement or automatic assignment. Other-family and archived/superseded Generation changes fail closed. The submitted complete explicit selection is saved atomically with Family/Generation versions and per-link audit records.
4. Documentary evidence starts UNVERIFIED and requires a reference or URL. A different authorized Admin verifies/rejects it. Evidence versions, actor and decisions are audited.
5. Activate/Reactivate requires an ACTIVE Model, at least one ACTIVE explicitly assigned Generation and independently VERIFIED evidence. Years remain optional. Active metadata, membership and evidence are locked.
6. Reuses existing master-data lifecycle service and confirmation panels for Retire, Archive, Restore and Draft-only unused permanent deletion. Active Generation dependencies block archive; any linked Generation or provenance blocks deletion. Modified/non-Draft records cannot be permanently deleted. Restores return to DEPRECATED; reactivation repeats evidence/member/parent checks.
7. Authenticated ADMIN + `vehicle.manage` is required server-side; UI permission-gates controls. BFF uses existing HttpOnly cookies, UUID path checks, same-origin writes, allowlisted read filters and safe errors. Audit History link additionally requires `admin.audit.read`.
8. No configured-vehicle, trim or fitment reference is rewritten. Generation and Family IDs/Model ownership are fixed. Only explicit Family membership plus version/audit columns change.

## Executed verification (Node 24.21.0)

| Check | Actual result |
| --- | --- |
| npm clean dependency install | PASS, isolated checkout |
| Node foundation tests | PASS, 6 tests |
| Focused API Vitest: Family service, governance, foundation, existing lifecycle | PASS, 49 tests |
| Focused Admin Vitest: Family contracts/navigation, vehicle permissions/master BFF | PASS, 25 tests |
| New Family BFF filter/auth/CSRF/conflict tests | PASS, 4 tests |
| Prisma validate and generate | PASS |
| API production build | PASS |
| Admin typecheck and production build | PASS |
| Full API TypeScript including test files | FAIL in unchanged baseline test files; see below |
| Fresh PostgreSQL 16 replay | PASS, all 67 main migrations, separate cluster on port 55439, database `admin_generation_family_test` |
| PostgreSQL Family schema/cross-model/rollback contracts | PASS with repository synthetic reconstruction fixture |
| Real-DB service integration | PASS: multi-link, missing/cross-model/stale rejection, independent evidence, optional-year activation, retire/reactivate, unused Draft deletion, simultaneous competing edits (one succeeds), audit, exact before/after configured-vehicle and fitment row equality |
| Live HTTP API | PASS: 401/403, whitelist and duplicate rejection, cross-model rejection, activation gate, stale version, explicit multi-link/unlink, Make filter |
| Browser at 1440px and 1920px | PASS for focused Family workflows below; not a claim of full 20-case Admin acceptance |

Full API TypeScript baseline failures: duplicate `verify` declarations in `common/email/smtp-email.transport.spec.ts:12-13`; circular `tx` annotations in `marketplace/seller-application-review.service.spec.ts:38` and `seller-stock-transfer.service.spec.ts:58`; DRAFT/ACTIVE literal mismatches in `seller-product-vehicle-article.service.spec.ts:77,84`. These files are unchanged from main. Production compilation excludes test files and passes.

Browser execution used only synthetic MFA-marked sessions against the disposable database and the built Admin/API. Verified: readable table at both widths, no document horizontal overflow at 1920px; Create with unknown optional years; Edit drawer; reversed-year error and correction save; Make restricts Models and filters Families; empty state; explicit two-Generation selection/save; assigned-other-Family checkboxes disabled; activation disabled without verified source. Captures: [1440 library](evidence/generation-families/library-1440.png), [1920 library](evidence/generation-families/library-1920.png), [drawer validation](evidence/generation-families/drawer-validation-1440.png), [manual assignments](evidence/generation-families/manual-members-1440.png).

Reproducible real-DB tests are `scripts/vehicle/generation-family-admin.integration.mjs` and `generation-family-admin-http.integration.mjs`. Both refuse port 5432, non-loopback hosts and names without `_test`. The first requires a fresh synthetic reconstruction fixture and API build; optional `FAMILY_UI_TEST_SESSIONS=1` creates synthetic local sessions. The HTTP test additionally requires the isolated API on 3107. Supply DATABASE_URL/DIRECT_URL and a synthetic test-only AUTH_MFA_ENCRYPTION_KEY in the process environment; no .env file is created.

## Remaining gates

- #350 restored-original-backup upgrade rehearsal/review remains an original-environment rollout gate; no original backup was restored in this UI task. Current main already contains the required schema, so it is not a missing source dependency for the owner-authorized code merge.
- CI is not asserted passing until GitHub runs finish. GitHub returned no pull-request workflow runs for the main baseline at final preflight.
- Full Admin 20-scenario operator sign-off, production datasets/load testing, browser lifecycle confirmations and a complete two-person browser evidence/activation roundtrip are NOT claimed by this focused acceptance.
- The owner subsequently authorized source review/merge. Deployment, original-DB operation, automatic backfill and Family-to-fitment derivation remain outside this authorization.

## Merge review corrections

- Fixed stale evidence approval: changing Draft metadata or explicit membership atomically resets VERIFIED sources to UNVERIFIED, increments their versions and audits invalidation. Review requests carry both the evidence version and the inspected Family version. The source author and last meaningful Family editor cannot approve the review. No-op saves preserve reviewer eligibility.
- Fixed the generic lifecycle supersession path: a replacement Family must be ACTIVE and belong to the same Model; no Generation links are moved.
- Added seven focused API regressions for these cases. Focused API suite: 56 PASS; Admin suite: 29 PASS. Original six Node foundation tests remain unchanged.
- Fresh PG16 review database: admin_family_review_test on port 55439, all 67 migrations and SQL contract checks passed. The expanded real-DB suite tests review invalidation after metadata/mapping changes, stale source and Family review versions, cross-model supersession rejection and unchanged configured-vehicle/fitment rows.
- Prior browser evidence applies to the original UI workflows; the new evidence-review eligibility copy/contract is covered by unit/integration checks and production compilation, not a new complete two-person browser run.
- GitHub CI jobs on the initial feature head did not start because of the account billing/spending-limit restriction. Source merge uses the executed local evidence; no protection bypass or billing change is authorized.
