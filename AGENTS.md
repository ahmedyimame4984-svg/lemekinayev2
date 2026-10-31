# Lemekinaye Agent Operating Command: LEM SYNC

Applies to all Admin, Seller, API, Prisma/PostgreSQL, documentation, review and merge tasks in this repository.

**Standing instruction:** Execute the `LEM SYNC` cross-track check automatically before starting a substantive change, proposing a PR, or merging. It is not necessary for the user to type the command. The user can explicitly say **LEM SYNC** to request the check without code changes.

## Admin Pro-only operating command — ADMIN FOCUS

**Standing instruction for Ahmed's Admin tasks:** Run **ADMIN FOCUS** by default, even when not explicitly typed. The canonical process is in [`docs/admin/ADMIN_PRO_MASTER_PLAN.md`](docs/admin/ADMIN_PRO_MASTER_PLAN.md), Section 0.1. Admin Pro is the active scope; do not propose, develop, or report Seller Portal features in Ahmed's Admin work. Foziya independently owns Seller implementation. Perform `LEM SYNC` dependency checks silently when API, Prisma, authentication, permissions or shared contracts could conflict; report cross-track details only if they materially block an Admin task.

Work in this fixed order, with review and merge gates after each milestone:

1. **October 8 Admin Pro UI/UX standard:** audit actual workflows for clean navigation, readable desktop density, efficient daily entry and consistent design; preserve the existing functional architecture instead of resetting `main`.
2. **Admin master-data management:** Categories, Part Groups, Product Types, Attributes, Brands, Criteria, Vehicle fitment reference libraries and supporting Supplier Master; manual vehicle entry, validation and controlled activation.
3. **Professional three-dot record actions:** verify Edit, Draft → Activate, Retire/Archive, Restore/Reactivate and safe Delete with permission checks, dependency preflight, audit history and clear feedback. Fix only defects actually demonstrated.
4. **Professional operator acceptance:** use the existing 20 scenarios in `docs/admin/ADMIN_PRO_OPERATOR_ACCEPTANCE_2026-10-07.md`; test on a running Admin with suitable permissions and data at 1440px and 1920px. Record **PASS / FAIL / BLOCKED / NOT TESTED**, evidence and baseline SHA. Source inspection is not a live PASS.

**Rules:** Do not reopen abandoned research, datasets, or Vehicle import flows. No new feature merely because it seems useful; prioritize proven operator problems. Before editing, check current `main` and existing Admin PRs, prevent duplicates, and preserve accepted functionality. Use one small PR per validated correction or coherent milestone; review and test it before an explicitly authorized merge. Do not mark a stage complete because a PR exists or source code looks plausible. When user says **Continue**, resume the first unaccepted Admin milestone and report only Admin status, blocking integration dependencies, tests, PR and next gate.

## Two owners, one spare-parts marketplace
- **Ahmed — Admin Pro:** reference catalog, Category → Part Group → Product Type, Attributes, vehicle-fitment master data, admin access, Seller and listing approval, governance, audit, Admin UI/UX.
- **Foziya — Seller Portal:** seller registration, seller product articles, stores/locations, inventory, online listings, pricing and seller operations.
- **Shared:** NestJS API, Prisma migrations, authentication, permissions, listing state transitions, seller approvals, notifications, product identifiers, fitment and integration tests.

## LEM SYNC — mandatory preflight
1. Check current `main`, all relevant open/draft PRs, active branches, recent commits and CI **for both tracks**. Verify actual merge status; never assume a previous SHA or answer is still current.
2. Record owner, business goal, scope and acceptance criteria. Read current affected code and agreed decisions.
3. Examine shared impacts: DB tables/migrations, API DTO/routes, auth, permissions, state changes, UI consumers, notifications, compatibility and tests.
4. Flag overlap and coordinate a safe change/merge order **before editing**. Avoid conflicting with either owner's unmerged PRs.
5. Use focused feature branches and PRs; no direct writes to `main`, no merger or deletion without explicit user permission.

## LEM SYNC — review and merge gate
1. Recheck both tracks and PR status against latest `main`.
2. Audit duplicate, superseded, obsolete, conflicting or unrelated changes. Keep Seller changes isolated from Admin unless a shared contract requires coordinated edits.
3. Run available API, DB, Admin and Seller tests appropriate to the change; report what passed, failed, was blocked, and was not run. A created PR is not a delivered feature.
4. Check schema/API/permission/approval compatibility and sequencing. Do not merge incompatible or unverified work.
5. Report: **Track → Goal → Cross-track impact → Changes → Verification → PR status → Next action**.

## PR hygiene command: LEM PR CLEAN
When asked to clean open work, audit ALL open PRs and classify each as:
- **KEEP — actively needed**, one clear milestone and owner.
- **FIX — relevant but broken/blocked**, with exact action and tests required.
- **CONSOLIDATE — duplicate or dependent**, establish canonical PR and preserve valuable work before closing redundant PRs.
- **CLOSE — superseded, obsolete, unrelated or explicitly retired**, but only close after authorization; preserve a short GitHub reason.
- **MERGE — reviewed, approved, verified and explicitly authorized**, considering both tracks.

Closing a PR is not deleting code already merged, and deleting a remote branch is a separate action. Never claim cleanup has occurred until GitHub confirms. Avoid deleting developer work without checking its dependencies.

**Product boundary:** Lemekinaye sells automotive parts, not vehicles. Vehicle masters exist to establish part compatibility. Seller-created product articles and inventory belong to the Seller workstream; master catalogs belong to Admin. Never reintroduce abandoned master-data imports.

See `docs/LEMEKINAYE_PARALLEL_WORKSTREAMS.md` for full governance.
