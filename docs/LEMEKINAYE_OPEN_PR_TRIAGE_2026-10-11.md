# Lemekinaye PR Cleanup Checkpoint — 2026-10-11

**Purpose:** factual PR hygiene and two-track restart plan, using `LEM SYNC` and `LEM PR CLEAN`.  
**Code baseline:** `main` at `db0e8a275c566aac4e2c319269587510e0060c71` when checked.  
**Execution:** Five old unmerged PRs were closed with individual explanatory GitHub comments. No data deletion, branch deletion, forced push, repository rollback or code merge was performed as part of closing them.

## Closed as obsolete or superseded

| PR | Reason |
| --- | --- |
| [#285](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/285) | Abandoned master-data reset plan; does not reflect current Admin workflow |
| [#292](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/292) | Stacked on abandoned unmerged base, 501 unrelated changed files; out of scope |
| [#296](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/296) | Admin Seller application review, tabs, routes and component already exist in main; separate older page duplicates workflow |
| [#311](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/311) | Old Admin-invitation activation workflow superseded by merged account-first Seller flow #319 |
| [#318](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/318) | Duplicate old invitation flow; log-of-sensitive-email-data fix already present in main; dirty merge |

These PRs remain available as GitHub history. Closing does not delete their source branches or mutate merged code.

## Remaining eight PRs before policy PR merge

| PR | Track | Decision | Next action |
| --- | --- | --- | --- |
| [#323](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/323) | Shared | KEEP | Review and install standing coordination policy; documentation only |
| [#322](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/322) | Admin/API | FIX / TEST | Correct stale Overview and Attribute status contract; Draft and local tests pending |
| [#321](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/321) | Seller/API/DB/Admin | FIX / TEST | Seller product, locations, stock and first-publication listings; validate cross-track status and migrations |
| [#320](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/320) | Admin/API | KEEP / REVIEW | Remove obsolete Configured Vehicle import surface while preserving manual Vehicle management and Admin acceptance |
| [#316](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/316) | Shared/EV | DEFER | Separate future milestone; coordinate additive DB migration with Seller migrations |
| [#283](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/283) | Admin | CONSOLIDATE | Draft masters' explicit Activate UI foundation |
| [#284](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/284) | Admin | CONSOLIDATE | Parent readiness prerequisite stacked on #283 |
| [#286](https://github.com/ahmedyimame4984-svg/lemekinaye/pull/286) | Admin | CONSOLIDATE | Configured Vehicle activation checklist stacked on #284 |

Treat #283 / #284 / #286 as **one unfinished Admin activation milestone**, not three completed modules. No need to merge them individually before running integrated tests.

## Restore a clear delivery workflow — not a blind Git rollback

- Preserve the previously merged Admin Pro UI/UX work and its `docs/admin/ADMIN_PRO_MASTER_PLAN.md` and operator acceptance checklist.
- Do **not** reset the entire repository to October 8: later merged Seller account-first onboarding (#319) is wanted and would be lost.
- Repair only confirmed UI/API regressions through focused PRs, validate at 1440px and 1920px, and keep the original Admin-controlled Vehicle reference libraries.
- Ahmed's Admin track: close outdated import UI (#320), verify truthfulness of readiness (#322), consolidate the Vehicle activation improvements (#283/#284/#286), then perform live acceptance.
- Foziya's Seller track: finish end-to-end products, stores, stock and listing submission (#321); retain email-registration, verification, Admin approval and notification flow from main.
- Coordinate shared Prisma/API/permissions and first-publication approval across both tracks. Defer EV until core workflows are accepted.
- **No destructive DB operations, hidden imports, automatic master rebuilds, or unverified merges.**

When reporting work, state **owner, goal, latest main, actual merged/accepted status, tests, PR and next review gate**. A PR created is not a feature finished.
