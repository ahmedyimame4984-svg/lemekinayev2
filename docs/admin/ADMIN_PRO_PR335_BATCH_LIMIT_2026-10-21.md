# PR #335 — bounded Save All correction

Owner: Ahmed / Admin Pro. Requirements: master plan #18, #24, #48 and the Product Type portion of #55.

Starting PR head: `21aeaf54e9692e315837fee58469b1c809b27a2b`.
Main inspected through GitHub: `370181bf886306b1ce058c7b31573dbbc11a6ea2`.

## Problem and correction

The Attribute editor could stage 201 distinct rows and submit all of them to an API accepting at most 200 assignments per atomic request. Save All then failed validation despite accepting every edit locally.

Individual and bulk staging now use one bounded staging function. An action that would leave more than 200 edited rows is rejected as a whole, retaining all existing drafts and the bulk selection. It never silently stages only part of a selection. The editor explains the limit beside the staged rows and displays the pending count against the capacity.

At capacity, further settings on an already-edited row remain allowed. Reverting a row to its saved settings frees a slot. No-op selected rows do not consume capacity. Save All also checks the request size defensively before sending its existing single PATCH. Existing response verification still clears drafts only after all returned IDs, versions and requested values are verified. Failed requests retain the drafts.

No API runtime, DTO, permission, Seller, database/schema/migration or transaction change. No split writes, automatic retry, lifecycle bypass or new dependency. Bulk selection remains available after staging so an operator can adjust it and retry a rejected action.

## Verification

Environment: Node `v24.21.0`, Vitest `4.1.11`, Next `16.3.6`. Existing local dependency installation reused through an ignored node_modules junction; no package or lockfile changes.

- **PASS:** 55 focused Admin tests in five files, including seven new boundary/recovery cases, existing draft/response verification, publication, BFF forwarding, server transport and client transport tests.
- **PASS:** Admin route type generation and full Admin TypeScript check (`--noEmit --incremental false`), exit 0.
- **BLOCKED:** production Admin build (`next build --webpack`) exited 1 because the reused installation lacks the already-required `@tailwindcss/postcss` package. Offline restoration of the lockfile's `4.3.3` version failed with `ETARGET` in the local cache; no source/package/lockfile workaround was made. This is not a passing build.
- **PASS:** whitespace/diff checks.
- **NOT RUN:** new live 200-row PostgreSQL/browser acceptance; new full API/Admin suites. API/database source is unchanged. The prior 880 API / 486 Admin / 14 live checks remain historical evidence at their documented SHAs, not new executions of this UI correction.
- **BLOCKED:** hosted Actions under the user-confirmed billing restriction. No manual workflow dispatch or rerun, billing action, protection bypass, merge or Draft transition.

Focused command, from `apps/admin`:

```sh
node ../../node_modules/vitest/vitest.mjs run lib/product-type-attribute-drafts.spec.ts lib/product-type-publication.spec.ts app/api/admin/catalog/product-type-attribute-routes.spec.ts lib/server/admin-api.spec.ts lib/client-api.spec.ts
node ../../node_modules/next/dist/bin/next typegen
node ../../node_modules/typescript/bin/tsc --noEmit --incremental false
node ../../node_modules/next/dist/bin/next build --webpack
```

## Integration and remaining gate

GitHub confirms PR #335 remains open, Draft and unmerged at the starting head. The current main Attribute editor blob matches the prior baseline; no duplicate limit fix is present. The new correction touches only the Attribute editor, draft helper, its tests and this note. Current open #353 affects separate Listing/media functionality; its existing overlap with #335's earlier shared spec corrections is outside this UI fix and must be reconciled during final integration review. No Seller implementation was changed here.

Keep #335 Draft and unmerged. Review the corrected SHA and obtain executable required-check results before a later, separately authorized merge. This correction does not establish full Admin Pro operator acceptance.
