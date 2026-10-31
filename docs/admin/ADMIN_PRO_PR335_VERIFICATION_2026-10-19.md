# Admin Pro PR #335 verification — 2026-10-19

**Track:** Ahmed / Admin Pro. **Result:** requested Save All runtime scenarios, all 880 API tests, the full API typecheck and both application builds pass. Hosted CI remains blocked before execution. **PR #335 stays Draft and unmerged.** Merge requires all required gates to pass and separate explicit user authorization.

## Exact source and scope

- Tested API test-fix commit: `e68a67ad0207660706307098b3602f9e086891bc`. All nine committed spec blobs match the files used for the passing full API suite, typecheck and build.
- Tested application/runtime commit: `2ca3c05527b6e00bf7670fdba6f51542d34c3af8`. The Admin and live PostgreSQL/browser results below were executed on this commit.
- Starting verified head: `8f1e471c0f6232a059ad92a66d17fb552739bb6f`.
- Current main baseline: `d85b8ca3d93fa07c1b8c9a57fc04f4c8fa1267c9` (merged #334). This baseline was already an ancestor; no synchronization merge or history rewrite was necessary.
- Branch: `fix/admin-product-type-attribute-save-all-20261012`.
- The application correction changes only `apps/admin/app/globals.css`. The later API corrections change nine `.spec.ts` files. All 659 compared API runtime, Admin and database/schema blobs match the application/runtime commit; all 723 compiled API JavaScript, source-map and declaration outputs also match its verified build. Admin and live database/browser checks were not rerun after these test-only corrections; their results are carried forward with this equivalence evidence.
- The evidence commit following the API test-fix commit adds documentation and test artifacts only.
- Requirements exercised: master plan #10, #12, #13, #18, #24–#26, #48, #50 and #55, limited to this Product Type workflow.

Two demonstrated defects were corrected:

1. The new Attribute “More settings” text used `0.64rem`, below the existing readability floor. It now uses `0.68rem`. The original full Admin suite failed its readability regression; the corrected suite passes.
2. The Product Types library allocated only 72px to its three action controls. A normal mouse click on “Open here” was intercepted because the controls were clipped. The action column now has a 252px minimum, a 1260px table minimum and a small control gap. The table keeps its existing internal scrolling. The same mouse navigation test now passes.

No Seller runtime or `apps/seller` source, Prisma schema/migration, working database, production database or other PR was changed or merged. Shared API spec corrections clear a blocking verification dependency and do not alter service behavior. Relevant open Seller PR file lists were checked and do not overlap these spec corrections. #334's publication/readback safeguards remain in place.

## Executed checks

Environment: Node `v24.19.0`, npm `11.9.0`, Prisma `7.10.0`, Vitest `4.1.11`, Next.js `16.3.6`; Chromium `153.0.8010.0` for browser acceptance.

| Check | Result | Exact evidence |
|---|---|---|
| `npm run db:generate` / `npm run db:validate` | PASS | Client generation and schema validation completed. No migration was applied. |
| Catalog API Vitest, `src/catalog` | PASS | 191 tests in 14 files, including CatalogAttributeAssignmentService, schema publication/validation and catalog policy tests. |
| Full API Vitest | PASS | 880/880 tests in 86 files on the API test-fix commit, including the Catalog suite. [Per-file results, command exits and provenance](evidence/pr335-save-all-20261019/api-verification.json). |
| Focused Admin drafts, publication and BFF/client Vitest | PASS | 48 tests in 5 files. |
| `npm run test -w admin` | PASS | 486 tests in 65 files after both CSS corrections. |
| `npm run typecheck -w admin` | PASS | Route type generation and TypeScript completed. |
| API production typecheck, `tsc --noEmit -p apps/api/tsconfig.build.json` | PASS | Production source compiles. |
| `npm run build -w api` | PASS | Repeated after all nine spec corrections; Nest production compilation completed and all 723 compiled outputs are identical. [Build output](evidence/pr335-save-all-20261019/api-build-after-test-fixes.log). |
| `npm run build -w admin` | PASS | Next production build completed; this build served browser acceptance. |
| Full API typecheck, `tsc --noEmit -p apps/api/tsconfig.json` | PASS | Exit 0 with no diagnostics after the test-only corrections. The six original diagnostics are resolved. |
| Isolated PostgreSQL/API/browser acceptance | PASS | 14/14 checks; [machine evidence](evidence/pr335-save-all-20261019/acceptance.json). |
| GitHub Actions on API test-fix SHA | BLOCKED | Both new runs report failure, an empty runner name and zero job steps; they provide no executable test PASS. Exact run/job records are in the verification JSON. |

Final focused commands:

```sh
npm exec -w api -- vitest run src/catalog
npm run test -w admin -- lib/product-type-attribute-drafts.spec.ts lib/product-type-publication.spec.ts app/api/admin/catalog/product-type-attribute-routes.spec.ts lib/server/admin-api.spec.ts lib/client-api.spec.ts
```

Final API commands after all spec corrections:

```sh
npm exec -w api -- vitest run
./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
npm run build -w api
```

The full suite used Vitest's JSON reporter; the persisted verification JSON records all 86 files and their test counts. These unit tests and compilation commands used an unreachable loopback test `DATABASE_URL` and a synthetic MFA encryption key. They did not connect to any database.

## Real PostgreSQL 16 transaction and browser evidence

Target: Neon branch `br-silent-math-b4le4ctk`, named `pr335-save-all-isolated-20261019`, project `green-morning-80609343`, database `pr334_acceptance`. The branch was confirmed non-default and non-primary. The server returned PostgreSQL **16.15**. The harness asserted the branch's exact endpoint and database before creating synthetic fixtures.

Direct TCP/DNS access was unavailable in this execution environment. The official Neon WebSocket pg-protocol driver connected through the configured HTTPS proxy. A session-only transport preload supplied the Pool to the unchanged PrismaPg adapter; the running Nest services, controllers, validation, transaction callbacks and SQL executed against the actual named PostgreSQL 16 database. No mock database or embedded PostgreSQL was used for these results.

| Live check | Result and observed behavior |
|---|---|
| Atomic Save All | HTTP 200; independent settings persisted on two rows in one Serializable transaction, one commit and one bulk audit with two before/after snapshots. Both assignment versions incremented once. Product Type and assignments remained Draft until publication. Fresh API reads matched saved settings. |
| Stale second row | HTTP 409; all assignment values/versions, Product Type, schemas and type audit history unchanged. |
| Invalid second row | HTTP 400 for a negative display order; entire batch unchanged. |
| Invalid conditional requirement | HTTP 400 from service validation when the second row had no conditional rule; entire batch unchanged. |
| Duplicate / missing assignment | HTTP 400 / 404 respectively, with no partial assignment or audit changes. |
| Unauthenticated batch | HTTP 401, with no changes. |
| Save All audit failure | A trigger restricted to the synthetic fixture rejected the audit insert with PostgreSQL P0001. HTTP 500; both preceding assignment updates and versions rolled back, with no audit persisted. |
| Publication audit failure | A synthetic publication audit rejection returned HTTP 500; schema creation, Product Type activation and assignment activation rolled back. |
| 1440 × 1050 and 1920 × 1050 | Two Attributes edited independently across requirement, flags, display mode and order. Zero mutations per click; publication/removal blocked while dirty. One Save All PATCH contained both rows. Reload preserved settings. Publish returned HTTP 201; stored Product Type and both assignments were ACTIVE, with a bound schema UUID, SHA-256 hash and matching setting snapshot. A second reload retained ACTIVE. No document-wide horizontal overflow. |
| Discard / navigation | Discard restored saved settings. A normal “Open here” mouse click raised the unsaved-change warning; cancelling preserved the selected Product Type and drafts without database writes. |
| Failed Save All | Injected HTTP 409 retained both edited rows and kept publication blocked. |
| Incomplete HTTP-success response | Injected HTTP 200 with an incomplete batch was rejected by frontend verification; both drafts were retained and publication stayed blocked. |

Temporary audit-failure triggers/functions were removed after their checks. Synthetic test data remains only on the isolated branch for inspection. Application servers were stopped after acceptance.

Screenshots from the tested executable commit:

- [1440px staged edits](evidence/pr335-save-all-20261019/staged-1440.png)
- [1440px published and reloaded](evidence/pr335-save-all-20261019/published-1440.png)
- [1920px staged edits](evidence/pr335-save-all-20261019/staged-1920.png)
- [1920px published and reloaded](evidence/pr335-save-all-20261019/published-1920.png)

## Resolved API verification defects

The full API typecheck originally reported these six diagnostics on both this PR and current main:

| File | Diagnostic |
|---|---|
| `apps/api/src/common/email/smtp-email.transport.spec.ts` | Lines 12 and 13: TS2451, duplicate `verify` declaration (two diagnostics). |
| `apps/api/src/marketplace/seller-application-review.service.spec.ts` | Line 38: TS2502, self-referential `tx` annotation. |
| `apps/api/src/marketplace/seller-product-vehicle-article.service.spec.ts` | Lines 77 and 84: TS2345, `DRAFT` passed to an `ACTIVE`-inferred parameter (two diagnostics). |
| `apps/api/src/marketplace/seller-stock-transfer.service.spec.ts` | Line 58: TS2502, self-referential `tx` annotation. |

The baseline was reproduced on a separately hash-verified current-main API/schema snapshot. [Historical pre-fix output](evidence/pr335-save-all-20261019/api-typecheck.log) is retained as failure evidence. The duplicate declaration was removed, transaction callback parameters were renamed to avoid self-shadowing, and the rule fixture's status parameter was explicitly typed as `MasterDataStatus`.

Running the complete API suite then demonstrated stale fixtures in five further spec files. They now expect the existing private document path and safe email diagnostic text, supply the existing inventory eligibility lookup and approved listing schema snapshot, and verify the current application-review approval gate. The direct-approval test now asserts rejection and no transaction, Seller, user or audit writes; the approved-but-uninvited fixture now starts with an approved Seller. Existing runtime contracts and negative governance assertions remain enforced. All 880 tests pass after these corrections.

## Outstanding gate

CI runs for API test-fix commit `e68a67ad0207660706307098b3602f9e086891bc`: [Validate 39290361979](https://github.com/ahmedyimame4984-svg/lemekinaye/actions/runs/39290361979) and [Master lifecycle database 39290361535](https://github.com/ahmedyimame4984-svg/lemekinaye/actions/runs/39290361535). Each job has zero recorded steps and no assigned runner name. Their failed conclusions are not evidence of executed tests. The available API evidence does not establish the reason no runner was assigned.

All required acceptance gates are therefore **not yet green**. Keep #335 unmerged; obtain executable required CI results before requesting separate explicit merge authorization.

## Source provenance

Terminal Git authentication was unavailable, so the existing branch snapshot was prepared through the connected GitHub account. All 1,010 text blobs were checked against the remote Git blob hashes. Sixteen unrelated binary attachments/historical evidence images were omitted from execution. Next's generated `next-env.d.ts` route-type import is a build-generated difference; no such generated-file change was committed. Both runtime fixes are in the application/runtime commit's CSS blob. The nine final spec blobs were checked against the remote API test-fix commit, and the 659 application/schema blobs were compared between the two remote commit trees with zero differences. Updates used the existing branch, fast-forward commits and an expected-head lease; no force push or main update was performed. The following documentation/evidence commit does not alter executable source.
