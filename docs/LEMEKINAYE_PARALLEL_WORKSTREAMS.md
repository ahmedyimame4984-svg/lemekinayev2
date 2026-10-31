# Lemekinaye — Admin and Seller Joint Workstream Policy

**Established:** 2026-10-11
**Standing coordination command:** `LEM SYNC` (automatic)
**Pull request audit command:** `LEM PR CLEAN`

## One platform, parallel work

| Track | Owner | Responsibility |
| --- | --- | --- |
| Admin Pro | Ahmed | Catalog reference data, vehicle fitment and identity, supplier/admin governance, applicant and first-publication approvals, permissions and audit |
| Seller Portal | Foziya | Seller account, verification and activation, product article authoring, store/locations, inventory, online price, listings and seller operations |
| Shared contracts | Both | NestJS API, Prisma/PostgreSQL, auth, roles, notification workflow, status machines, seller-product/fitment IDs and end-to-end integration |

Lemekinaye is an **automotive parts marketplace**; vehicle data is a reference library for fitment, not a vehicle sales catalog. Seller articles and stock remain seller-owned. Reference Catalog and Vehicle masters remain Admin-managed.

## Required steps for every change

### Before implementation — LEM SYNC
- Retrieve current `main`, open/draft PRs, recent commits and relevant branch diffs **in both Admin and Seller**.
- Define owner, exact goal, success criteria and boundaries. Check shared API, Prisma migrations and permission/state contracts.
- Identify risks to the other track and coordinate dependent PR/merge order.
- If an unmerged PR already implements the change, **review and extend or consolidate it** rather than creating an unnecessary duplicate.

### During implementation
- Independent work gets its own branch and PR. Do not directly change `main` or overwrite another developer's branch.
- Shared changes should be isolated, reviewed and tested against both consuming sides.
- Preserve agreed onboarding: seller registers and verifies account, Admin approves/rejects, seller gets decision notification, no Admin invitation-first account creation.
- Preserve agreed first-publication approval: Admin approves a listing's initial publication; subsequent permitted seller updates do not automatically require new approval.
- Never claim completeness from the presence of code or the creation of a PR. Avoid unintended destructive data operations.

### Before review and merge
- Recheck latest `main`, both tracks, and all affected PRs.
- Check whether the PR is already merged/superseded, has dependent branches, conflicting migrations, failing CI or missing acceptance verification.
- Confirm tests (API, Admin, Seller, DB, E2E) appropriate to affected modules. Mark exact checks not run.
- Propose merge order, seek explicit merge authorization and never silently merge or delete others' work.

## PR cleanup workflow — LEM PR CLEAN

| Decision | Use when | Action |
| --- | --- | --- |
| KEEP | Needed and currently active | Preserve, assign owner and next validation |
| FIX | Relevant but failing/incomplete | Fix in its branch, test and reassess |
| CONSOLIDATE | Two PRs overlap or form a stack | Choose canonical PR and safely port missing work, only then close redundant PRs |
| CLOSE | Obsolete, abandoned, already delivered or explicitly removed from product scope | Record reason and close after authorization |
| MERGE | Independently verified, compatible, approved and explicitly authorized | Merge in dependency order |

**Do not automatically delete branch histories.** Closing a PR is not deleting merged code or changing PostgreSQL. Never use a failed CI result as sufficient evidence a feature is unnecessary; distinguish CI infrastructure faults from test failures.

### PR register and progress reporting

Maintain a brief checkpoint with one line per open PR: number, title, owner, category, dependencies, test state, next action and merge decision. A milestone is `not started`, `in development`, `ready for review`, `merged but unverified`, or `accepted in live testing`; avoid describing all states as “done.”

Each response should say: **Track, Goal, Other-track impact, Changes, Verification, PR state, Next action.**

## Agreed roadmap

1. Reconcile true GitHub and product progress.
2. Finish Admin Pro and Seller core workflows in their separate tracks.
3. Integrate Admin approval with Seller submission and inventory.
4. Perform and sign off live operator acceptance for both portals.

Parallel work continues wherever contracts are stable; a shared API/database change receives explicit coordination.
