# Product Article requirement snapshot verification

Scope: Seller/API/database. Starting commit: PR #337 head `fa0ac207dbc9cafe944d48a1160f6b985bd2e6ae`.

This change consolidates the unverified snapshot implementation in draft PR #338 and extends it with frozen-policy enforcement, strict legacy handling, duplicate review and Article reuse. **Do not apply or merge both snapshot migrations.** PR #338 remains untouched; its disposition requires owner review.

## Behavior

- Fourteen requirement/count columns are copied onto `products` from each Article's exact bound published schema. No backfill reads mutable `product_types`.
- The migration validates published schema ownership, JSON section shape, enum values and integral media counts (0–20). Invalid historical rows roll back the complete additive migration.
- Missing legacy fields use the documented Product Type defaults. `requirements.oemReference` remains supported. Explicit zero counts are preserved.
- A database trigger derives insert-time policy from the bound schema, including for an older API that omits the new columns. It rejects later changes to policy, `product_type_id` or `schema_version_id`. Apply the migration before deploying the API.
- Article activation and Brand edits enforce frozen columns. Technical attributes still use the bound published schema. Missing policy fails closed. Seller media values stay in the Listing layer.
- Existing normalized Brand/MPN and GTIN unique keys remain authoritative. Without an MPN, a preflight finds probable matches by Product Type, Brand and the complete stored technical values. It exposes only approved Articles and the Seller's own drafts. The Serializable persistence transaction rechecks matches and requires an audited explanation before creating a distinct part. Technical matches are not automatically merged; vehicle fitment is added separately and is not proof of identity.
- Sellers can select a matching Article for Inventory. Existing Inventory creation links `seller_products.product_id` and creates Seller-owned stock without copying canonical Article rows. Existing receive/adjust actions preserve SKU reuse across Locations.

## Local checks

- Prisma validation/client generation: passed.
- Focused API Article/catalog/Seller suites: 160 tests passed.
- Seller suite: 52 tests passed. Seller typecheck, lint and production build passed (lint retains baseline warnings).
- API production build: passed.
- Migration fixtures: 13 scenarios passed in local PGlite/PostgreSQL 17.5, including invalid-data rollback and immutable-policy enforcement.
- All 64 migration SQL files replayed in local PGlite with enum additions committed before their later use. This is SQL verification, **not** Prisma Migrate deployment or native PostgreSQL 16 acceptance.
- Full API comparison: new branch 739 passed / 15 failed plus one unparseable SMTP suite; PR #337 source baseline 727 passed / 16 failed plus the same SMTP suite. All remaining failing tests also fail on the baseline. This change fixes the inherited Article validator assertion; no new failing test appeared. Remaining failures cover auth/environment, legacy Seller approval mocks, Listing/Inventory mocks and email expectations.
- Full API lint/typecheck remain blocked by baseline test-file defects, including duplicate `verify` declarations and self-referential mock annotations. Production API compilation passed.
- Native PostgreSQL 16, real concurrent database requests, Prisma Migrate deployment and live Seller browser acceptance: not run. No production database or external storage was changed.

Run the migration fixtures against an isolated PostgreSQL test database:

```sh
ARTICLE_POLICY_TEST_DATABASE_URL='postgresql://user:password@127.0.0.1:5432/article_policy_test' \
node packages/database/prisma/tests/article-requirement-snapshot.mjs
```

The runner creates and drops only uniquely named fixture schemas on that explicit test connection. It does not use the application's `DATABASE_URL`.

## Integration gates

PR #336 is merged. PR #337 is closed, unmerged; this branch is based on its exact head and retains its canonical-media policy change. That inherited change requires the separate Listing-owned media/storage validation protection described in PR #337 before integration. Complete native database and real Seller workflow acceptance, reconcile draft PR #338, and review merge order. No automatic merge.
