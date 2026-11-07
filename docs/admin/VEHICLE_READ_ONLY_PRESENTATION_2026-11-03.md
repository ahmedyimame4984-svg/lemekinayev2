# Vehicle browsing restoration — 2026-11-03

Owner: Ahmed / Admin Pro. Branch: `feat/autotechdoc-reference-sync`.
Baseline: `b178a763f8440558f41ba70b1a35c971eef4a939`.

## Scope and acceptance

Restore the pre-cleanup vehicle library presentation while retaining Autotechdoc canonical ownership. Reuse the original hierarchy, technical descriptions, search/filter/sort controls, pagination, CSV export and local saved views. Restore the paginated Makes and Models presentation without creation, edit or lifecycle controls. Model links now open the filtered vehicle library instead of the authoring workflow.

The configured-vehicle component contains no canonical mutation handlers or creation forms. Saved-view changes continue to affect only local administrator preferences. Existing API write guards and Product Type restrictions remain unchanged. No database, sync engine, Seller or original Lemekinaye changes.

## Preflight

- Remote main: `f90707365e3d3bb3ef8b54024724de41538ac099`.
- Only open PR found: draft #1, using the existing synchronization branch.
- Remote heads: main and the requested feature branch; no competing branch found.
- No PR workflow runs returned for baseline; this repository has no `.github` workflow directory.

## Verification

- Admin suite: **PASS — 500 tests / 67 files**, including six new DOM interaction cases.
- Admin typecheck: **PASS**.
- Admin production build: **PASS**.
- Admin lint: **PASS**, pre-existing warnings outside changed production code.
- Whitespace/diff check: **PASS**.
- Live authenticated browser against synchronized PostgreSQL: **NOT TESTED**. DOM tests use mocked HTTP responses, not a live database.

Interaction cases cover hierarchy and technical details; configuration/model deep links; search, sort, pagination and clearing filters; error recovery and empty results; local saved views; Makes and Models library browsing. They also assert canonical vehicle requests remain GET-only and authoring controls are absent. Existing route/write-boundary tests run as part of the full Admin suite.

Review the actual vehicle screens at 1440px and 1920px with synchronized data before operator acceptance. Nothing merged or deployed.
