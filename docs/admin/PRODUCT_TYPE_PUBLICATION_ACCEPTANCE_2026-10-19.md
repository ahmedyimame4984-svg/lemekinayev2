# Product Type publication acceptance — PR #334

Date: 2026-10-19. Owner: Ahmed — Admin Pro.

## Baseline and scope

- Reviewed `AGENTS.md`, the Admin Pro master plan and the operator acceptance checklist.
- Main baseline: `871274df2e213bbb4150dc559a68fbde6c0d58ad`.
- Original #334 head: `eeb5c5c1ab628ed309098f7e68179e7cbbe18734`, 65 main commits behind.
- Safely synchronized the existing branch with a two-parent merge: `b53cd1d28da8a457f4ce5060966d88154378b19a`. No force push or history rewrite.
- **Final tested executable SHA: `94c7f4547a521ec4502a4f6cf7b3c9f308a87975`.** Later evidence-only commits do not change executable files.
- #335 remains separate at `ea1a7dcdf26336dfc8790fc452b434a80af63ab3`. Its overlap is `product-types-management.tsx` and `product-type-technical-attributes.tsx`; reconcile it after #334. Its Save All/API work is not included here.
- Changes are confined to the existing Admin components, publication helper/tests and this evidence. API, Seller and database sources match main. No working or production database was accessed.

## Demonstrated corrections

The production-browser baseline reproduced three publication readback defects: an empty assignment response produced green success, a malformed response crashed the workbench, and a response for another Product Type replaced the selected record before verification. New unit cases first failed for empty/malformed/missing assignments, then passed after the corrections.

Publication now verifies a nonempty schema reference and every assignment submitted for publication before updating the selected record or showing success. Each expected assignment must be present and Active. Historical inactive assignments outside that selection remain readable. Unexpected record/assignment responses leave the workbench intact and show an error.

The Draft row menu opens the existing governed readiness workflow. Browser testing also demonstrated that scrolling a load error to the top hid its message underneath the fixed Admin header. Centering the readiness/error target fixes that obstruction without changing shared layout or lifecycle rules.

## Automated verification

Environment: Node 24.19.0, npm 11.9.0, Prisma 7.10.0, Vitest 4.1.11 and Next.js 16.3.6.

| Gate | Result | Exact evidence |
| --- | --- | --- |
| Admin suite | PASS | 478/478 tests, 64 files; includes 10 publication verification cases |
| Focused API suite | PASS | 189/189 tests, 16 files: Catalog plus authentication/permissions guards |
| Admin typecheck | PASS | `next typegen && tsc --noEmit` |
| Admin production build | PASS | Standard `next build` completed |
| API production compilation | PASS | `nest build`, with generated current Prisma client |
| Prisma validate/generate | PASS | Current main schema valid; client generation successful |
| Changed Admin source lint | PASS | Type-aware oxlint, no diagnostics |

Commands, from repository root; the placeholder URL is sufficient for generation/unit tests and is not a database verification claim:

```bash
npm run test -w admin
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/postgres npm run test -w api -- src/catalog src/auth/authentication.guard.spec.ts src/auth/permissions.guard.spec.ts
npm run typecheck -w admin
ADMIN_API_BASE_URL=http://127.0.0.1:3330/api/v1 npm run build -w admin
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/postgres npm run build -w api
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/postgres npm run db:validate
```

## Running Admin/API acceptance

**PASS: 17/17 cases**, Chromium 153.0.8010.0, production Next.js Admin over HTTPS, built NestJS API and Prisma against an isolated embedded PostgreSQL 17.5 database. All 67 existing migration SQL files were applied before fixtures were created. Synthetic Admin sessions included MFA assurance and real permission checks; no production authentication rule was disabled. The test driver used a single database connection; this is not concurrency evidence.

Readback fault cases used real successful publication before injecting a response failure. The rejected-publication case injected a 503 before any write. Replay requests retained same-origin protection. Tests asserted no misleading green success, a usable error, and preservation of the selected Product Type.

| Cases | Result | Observed behavior |
| --- | --- | --- |
| 1. Authentication, permission and stale version | PASS | 401, 403 and 409; Draft/version/schema unchanged |
| 2. Empty schema | PASS | 409; no schema or parent activation |
| 3. Injected audit persistence failure | PASS | HTTP 500; schema, Product Type, parent and assignment changes all roll back |
| 4–5. Unselected Draft row, 1440px and 1920px | PASS | Menu selects the correct record, opens readiness, POST returns 201, saved record becomes Active |
| 4–5. Assignments and schema, both sizes | PASS | Both Draft assignments become Active/version 2; Product Type version 2 references the saved version-1 schema; snapshot values and SHA-256 match the POST; one audit event |
| 4–5. Library refresh and page reload, both sizes | PASS | Active + Published remain visible after server reload; assignments remain Active |
| 6. Publication rejected | PASS | 503 message; record remains Draft; no false success |
| 7–8. Product Type / assignment readback unavailable | PASS | Publication acceptance is distinguished from unverified activation; no false success |
| 9–11. Draft status / wrong schema / wrong Product Type | PASS | Explicit verification errors; selected record is not replaced |
| 12–13. Empty / malformed assignments | PASS | Error rather than green success or a React crash |
| 14–16. Missing / inactive / Draft published assignment | PASS | Activation confirmation is rejected |
| 17. Attribute load failure from the row menu | PASS | Error is visible below the fixed header; browser hit-testing confirms it is not covered |

Individual outcomes, synthetic identifiers and schema hashes: [browser-results.json](evidence/product-type-publication/browser-results.json).

## Native PostgreSQL 16 verification

An independent, newly provisioned test project ran PostgreSQL **16.15**. Existing databases were untouched. The runtime cannot resolve the database's direct TCP hostname (`EAI_AGAIN`), so **native PostgreSQL 16 HTTP/Prisma execution and Prisma Migrate deploy were BLOCKED**, not reported as passes.

The database connector nevertheless provided real PostgreSQL 16 verification:

1. Replayed all **67 existing migration SQL files**, preserving the required commits around added enum values; nine SQL batches, with no source migration edited. This is SQL replay, not Prisma Migrate history verification.
2. Inserted 56 synthetic fixture rows using captured parameter-bound SQL, excluding credentials, tokens, sessions and role-assignment rows.
3. Replayed the **21 statements generated by the actual publication service** with an audit failure trigger. The expected exception aborted the transaction. A fresh query confirmed zero schemas and zero changed Product Types, assignments, Categories or Part Groups.
4. Removed the test trigger, replayed the successful 21-statement publication transaction, and read it back through a separate connector call: Product Type Active/version 2, both assignments Active/version 2, Category and Part Group Active, schema version 1 and one publication audit.
5. Persisted schema ID `7380d7bb-a8b6-4fc5-9856-9d04f7edc1e7`; hash `a61b06f4c415b1ee4dfddd5e1fd41c70633dc07acde436aa0e2f440a81041a65`, matching the captured running-API response and snapshot.

SQL was captured at `288d4e7a300fba1cd86adfdac4c92563657dd296`; API and Prisma sources are identical at the final executable SHA, whose only subsequent runtime change centers Admin publication navigation. Details: [native-postgres16-proof.json](evidence/product-type-publication/native-postgres16-proof.json). The isolated compute was suspended after verification.

## Review and merge boundary

GitHub Actions run [39217612979](https://github.com/ahmedyimame4984-svg/lemekinaye/actions/runs/39217612979) failed with **zero recorded job steps**; job `117945066575` has no step logs. This does not establish a code-test failure. Its underlying annotations and branch-protection administration are unavailable to the integration. Local checks above were executed; remote CI is recorded as BLOCKED.

The requested publication slice has passed local automated, running-browser and available isolated database gates. Use the normal GitHub merge API for **#334 only**, honoring branch protection. If GitHub requires unavailable checks or approvals, leave the PR unmerged; do not bypass them. No other PR, including #335, is authorized to merge in this task.

Admin Pro coverage: requirements #12, #13, #25, #27, #49 and #50; targeted evidence for #55. The full cross-module 20-scenario acceptance milestone and #335 Save All workflow are not declared complete by this slice.
