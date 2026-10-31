# Admin Pro Milestone 1 — correction and review checkpoint

**Date:** 2026-10-11  
**Owner / scope:** Ahmed — Admin Pro only  
**Milestone:** 1 — October 8 Admin UI/UX correction standards  
**Status:** CORRECTION IN PR; local automated checks verified; authenticated workflow review and merge gate pending.  
**Canonical process:** PR #326, `docs/admin/ADMIN_PRO_MASTER_PLAN.md` section 0.1 and the existing 55 requirements. No requirement is closed by this checkpoint.

## Exact baseline and PR register

| Item | Verified revision / state |
| --- | --- |
| Main | `487ea3675fc1492e420cb234994752e5c106a56f` |
| PR #325 before this correction | `1a005e7acc3f9d7b14b603b0a4355f396d21cfc6`; open, Draft, unmerged |
| Code and acceptance correction | `21b958a8bde74821317881d4dfca7e0b2caeec07`; tested source recorded below |
| PR #326 — ADMIN FOCUS process | `74fd3e04764b0a0b6c7e0973525496f303633714`; open, unmerged |
| Milestone 2, 3 and 4 | Not advanced; Milestone 1 review gate remains open |

- Correction / review PR: https://github.com/ahmedyimame4984-svg/lemekinaye/pull/325
- Governing process PR: https://github.com/ahmedyimame4984-svg/lemekinaye/pull/326
- Fetch the current PR heads before resuming; the checkpoint commit follows the code revision above.

## Confirmed issues and completed corrections

1. **Transparent record-action menus and confirmation panels.** The shared lifecycle CSS referenced `--surface`, `--surface-subtle`, `--border`, `--border-strong`, `--text-muted` and `--accent`, which were not defined in either stylesheet imported by the Admin root layout. Real browser rendering reproduced transparent menu/dialog backgrounds and zero-width borders. Replaced 28 declarations with the existing `--white`, `--soft`, `--line`, `--muted` and `--brand-red` tokens, including dependency/blocker styling. Panels now have opaque surfaces, separators, muted explanatory text, hover feedback and the existing red keyboard focus color.
2. **Stale Listing redirect acceptance assertion.** Reviewed the two original changes in PR #325 before extending it. Its correction reflects the current permission-gated Listing Moderation page, while preserving actual legacy Product and Supplier Offer redirects. Updated the operator checklist wording to match the current route.
3. **Stale missing-document assertion.** The Admin verification document component displays `Missing document` and `0 of 4 uploaded`. The existing test expected superseded wording. Corrected it to verify all four missing-document rows and the upload count, retaining assertions that preview controls and document URLs are absent. The application component and document decisions are unchanged.
4. **Misleading governance empty-state guidance.** Retained PR #325's existing correction directing the operator to Open Applications or filters, consistent with the current account-registration workflow.

The styling is shared by Categories, Part Groups, Product Types, Attributes/groups/values, Brands, Criteria Templates, Vehicle libraries and Supplier Master. Call-site inspection confirms adoption; that is not a claim that every workflow has been live-tested.

**Requirement coverage:** #37 consistent Admin UX, #38 keyboard-visible feedback, #48 responsive boundaries, #50 clear operational states; #55 acceptance evidence corrected, final sign-off still pending. The existing 55-requirement statuses are unchanged.

## Change boundary

PR #325 is reused for this coherent Milestone 1 correction. No duplicate PR was opened.

Six files differ from the main baseline: four Admin CSS/component/test files plus the operator checklist and this checkpoint. No Seller Portal, API, Prisma, authentication, permission, lifecycle handler or master-data mutation changes are included. The original platform structure and manual master-data workflow are preserved.

The open-work dependency check found no changed-file overlap with the parallel implementation PR. That check must be repeated before merge if either branch changes.

## Executed verification

Environment: Node `24.19.0`, npm `11.9.0`, locked Admin dependencies; all 390 retrieved baseline files were verified against their GitHub blob hashes before edits.

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Main baseline: `npm run test:admin-acceptance` | **FAIL** — 16 passed, 1 failed | Failure was the superseded Listing redirect assertion. |
| Original PR #325: `npm run test:admin-acceptance` | **PASS** — 17/17 | Actual repository Vitest command executed. |
| Original PR #325: `npm run test -w admin` | **FAIL** — 450 passed, 1 failed | Missing-document copy expectation; corrected in this revision. |
| Corrected Admin suite: `npm run test -w admin` | **PASS** — 451/451, 59 files | Includes all 17 operator acceptance assertions and existing readable-density, table, unsaved-change and design-system tests. |
| `npm run typecheck -w admin` | **PASS** | Next route type generation and TypeScript executed. |
| `npm run lint -w admin` | **PASS** | Initial run reported eight existing warnings outside the changes; no unrelated warning cleanup included. |
| `npm run build -w admin` | **PASS** | Production compilation, TypeScript, page generation and route generation completed after the CSS correction. |
| Actual React component browser checks | **PASS** — 9 corrected combinations; 9 baseline reproductions | Chromium `153.0.8010.0`; Catalog Category, Vehicle Make and Supplier Master fixtures, each at 1440, 1920 and 768 pixels wide. |
| Full authenticated Admin workflow review | **NOT TESTED** | The browser checks isolate real components and CSS; no running NestJS/PostgreSQL session was used. |
| API / database / Seller suites | **NOT RUN** | No corresponding runtime changes; no claim of integration or lifecycle operation acceptance. |
| Live 20-scenario acceptance | **NOT TESTED** | Reserved for Milestone 4 after the earlier gates. |

The browser checks used the actual `AdminMasterLifecycleActions` and `AdminRecordActionMenu` components, with the Admin global and readability styles. They opened menus, used keyboard navigation, opened Archive confirmation and cancelled it. They checked opaque backgrounds, 1px borders, muted headings, red keyboard focus, hover feedback and viewport containment. Before/after screenshots were inspected. **Zero API requests** occurred; no records were created, changed, archived or deleted. These are component verification results, not live operator certification.

## CI blocker

The latest inspected main Validate run `38130101905` and original PR #325 Validate run `38131775067` failed with **zero job steps executed**, independently confirmed through the job-steps API. These are CI execution failures, not failing application test results. A new PR-head run must be inspected after publishing; local success does not assert CI success.

A normal authenticated Admin/API/PostgreSQL environment is still required for the Milestone 1 workflow review and later operational gates.

## Exact next task and review gate

**Next task: review the final PR #325 diff and the Milestone 1 visual correction in the running Admin at 1440px and 1920px.**

1. Re-fetch main and PR #325 / #326 metadata; verify current heads, merge status, open Admin work and new Validate results.
2. Read this checkpoint, ADMIN FOCUS in PR #326, the master plan and the amended operator checklist.
3. Run the same Admin commands above on the final PR #325 head if code has changed.
4. In the authenticated Admin, open representative Catalog, Vehicle and Supplier record-action menus and confirmation panels, cancel the operation, and record actual visual PASS / FAIL / BLOCKED evidence. Inspect the primary Product Types, Attribute Library and Configured Vehicles navigation/layout at both desktop widths; record demonstrated defects before implementing additional Milestone 1 corrections.
5. Review and obtain Ahmed's explicit merge approval. PR #325 and PR #326 remain unmerged; do not merge automatically.
6. Continue Milestone 1 if review finds a real defect. Advance to Milestone 2 only after the Milestone 1 review/merge gate is accepted.

**Resume prompt:** Continue Lemekinaye ADMIN FOCUS Milestone 1 from `docs/admin/ADMIN_PRO_MILESTONE_1_CHECKPOINT_2026-10-11.md`. Recheck current main and PRs #325/#326, validate the latest head, complete the pending authenticated UI/UX review gate, and preserve the manual platform structure. Do not advance milestones or merge without approval.

## Follow-up — local desktop crash observed, fix awaiting execution (2026-10-11)

**Operator evidence:** A photograph of the running local Admin at `localhost:3001/admin` shows a Next.js runtime `TypeError: Cannot read properties of undefined (reading 'expected')` in `components/master-data-installer.tsx:192`, `CountCard`. This is an **observed Milestone 1 failure**, not a successful desktop-acceptance scenario.

**Confirmed code defect:** the overview mapped hard-coded count keys, then accessed `count.expected` without checking that `status.counts[key]` existed. The Admin's typed contract lists all keys, but network JSON is not runtime-validated. A missing count key can crash the whole page. The running API/Admin revision mismatch is a plausible explanation; the exact missing field and payload have not been observed yet.

**Correction on existing PR #325:**
- `apps/admin/lib/master-reference-status-display.ts`: defensively validate the API envelope and distinguish missing/malformed count data from genuine zero records. Keep prescribed Attribute targets and Admin-managed null targets distinct.
- `apps/admin/components/master-data-installer.tsx`: render missing counts as **Unavailable** (never zero), provide an actionable version-mismatch warning, and show a non-crashing status error if the root payload is malformed.
- `apps/admin/lib/master-reference-status-display.spec.ts`: regression tests for missing counts, malformed counts, zero, baseline-met/below-baseline, incomplete status envelopes.
- `apps/admin/lib/admin-pro-operator-acceptance.spec.ts`: update static acceptance safeguards to the defensive count renderer.

**Verification:** GitHub commits created and source reviewed. **NOT YET RUN** on this follow-up revision: Admin Vitest, typecheck, lint, build, or authenticated browser retest. Prior checkpoint's `451/451` test pass applies to the **earlier code only**. Do not count this fix as accepted until latest-head tests and local browser validation succeed. No API, Prisma, migration or database mutations were made.

**Next operator action:** From the PR #325 review worktree, run `npm run test:admin-acceptance`, `npm run test -w admin`, `npm run typecheck -w admin`, `npm run lint -w admin`, and `npm run build -w admin`; run the NestJS API from a **matching checkout/revision**, restart the Admin, refresh `/admin`, and inspect `/api/admin/reference-data/status` response keys if counts are unavailable. Avoid posting tokens, cookies or private records. Recheck Catalog, Attributes, Configured Vehicles and action menus at 1440px/1920px after Overview stops crashing. **Keep PR #325 Draft/unmerged** until review approval.

## Follow-up — aligned local screenshots and Product Types empty state (2026-10-11)

**Local visual evidence:** user supplied two new photographs of `localhost:3001`, showing the Configured Vehicles page top and the Product Types library empty state. The Vehicle page no longer shows the formerly visible `Import Vehicles`, `Browse 405 Research Drafts` or `Import CSV` controls, and the canonical guided Make → Model → optional Derivative/Body Line → Generation → Trim → Configuration workflow remains visible. This supports resolution of the earlier local-version-mismatch blocker **for the vehicle page only**, not full deployment or full operator acceptance.

**Confirmed Product Types usability defect:** With search empty and filters set to All in the screenshot, the library displayed `No Product Types match the current filters`, the same message used for filtered searches. This misleading empty state offers no distinction between an empty library and zero search results.

**Correction on existing PR #325:** `apps/admin/components/product-types-management.tsx` now derives `libraryHasActiveFilters`, reuses it for the Reset Filters control, and distinguishes `No Product Types yet` with Category → Part Group setup guidance from `No Product Types match the current filters` with search/reset guidance. `apps/admin/lib/admin-pro-operator-acceptance.spec.ts` includes a regression assertion for both paths. Existing import behavior and Catalog identity remain unchanged.

**Verification:** Github source diff and assertions checked; **NOT RUN on this new commit:** Vitest/TypeScript/lint/build, or authenticated click flows. The earlier Work 451/451 PASS applies to a prior revision only. Photos are not viewport-measured or sharp enough to certify 1440px/1920px typography, contrast or interaction details. Neither the Overview crash fix nor three-dot action menus has yet been proven against the running local version.

**Remaining Milestone 1 gate:** pull PR #325's latest head, run the Admin test/typecheck/lint/build, hard-refresh Product Types to verify the contextual empty state, capture measured desktop-width screenshots, and test opened three-dot menus, keyboard focus, confirmation and Cancel on a safely existing record. Do not fabricate records or perform destructive operations for visual verification. Keep PR Draft/unmerged pending review approval.

## Follow-up — shared record-action keyboard correction (2026-10-11)

**Context:** user is away from Windows desktop, so remaining Milestone 1 work is limited to GitHub source review and focused fixes. PR #326 is merged; this work remains within existing Draft PR #325, not a separate PR. The latest local screenshots confirmed the original manual Configured Vehicles workflow is present and the obsolete vehicle importer controls are no longer visible on the refreshed local page.

**Confirmed source-code accessibility gap:** The shared `AdminMasterLifecycleActions` record confirmation used `dialogRef.current?.focus()` on open and an Escape-only handler on the dialog section. There was no Tab focus containment, reliable restoration to the originating row's three-dot button, or consistent keyboard close behavior during a pending save.

**Focused correction implemented:**
- `apps/admin/components/admin-record-action-menu.tsx`: optional external action-button `triggerRef` so dialogs can restore focus to the originating record; existing internal ref and portal behavior remain the fallback.
- `apps/admin/components/admin-master-lifecycle-actions.tsx`: reuse the existing `useAdminOverlayKeyboard` focus/Tab/Escape/unsaved-change handling, disable close during `saving`, and restore focus to the originating action button after dismissal. Route scrim, Close and Cancel through the same guarded close path. Existing lifecycle requests, version checks, Draft-only delete gate and dependency preflight remain unchanged.
- `apps/admin/lib/admin-master-lifecycle-actions.spec.ts` and `apps/admin/lib/admin-record-action-menu.spec.ts`: static regression assertions for shared focus controller, exact trigger reference and focus restoration.

**Verification actually performed:** Re-fetched all four files from GitHub after the commits; static consistency checks PASS. **NOT RUN:** updated Vitest suite, typecheck, lint, build, live keyboard/tab review, API/PostgreSQL operations. Prior Work `451/451` test PASS was at an older commit, not proof this head passes.

**Required next gates:** From updated PR #325 checkout run `npm run test:admin-acceptance`, `npm run test -w admin`, `npm run typecheck -w admin`, `npm run lint -w admin`, `npm run build -w admin`. In the running Admin at 1440px/1920px, select an existing safe Catalog/Attribute/Vehicle master action, verify opening, Tab and Shift+Tab containment, Escape/Cancel/scrim close and focus return, then inspect archive/delete preflight without submitting it. Check that editing a deletion reason does not create a confusing double confirmation. If a defect remains, keep correction inside this Milestone 1 PR. Preserve all production master data.

**Gate remains:** Milestone 1 not accepted; PR #325 Draft/unmerged; no automatic merge or progression to Milestone 2.
