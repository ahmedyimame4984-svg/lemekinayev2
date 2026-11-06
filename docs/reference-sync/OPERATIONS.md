# AutotechDoc → LemekinayeV2 — ATD-07 v2 synchronization operations

**Status: draft integration only. Do not merge, deploy, or apply production migrations.**
Producer: AutotechDoc PR #3 at v2 publishing contract. Consumer: LemekinayeV2
PR #1 on existing synchronization branch.

AutotechDoc owns canonical published data; LemekinayeV2 owns local PostgreSQL,
commercial Articles, Listings, Inventory, prices and marketplace attribute rules.
Only the versioned HTTP API crosses that boundary. No shared database.

## Source contract and durable import

Required source operations (all under /api/v1, with a B2B key issued by
AutotechDoc Admin with reference:read + reference:snapshot scopes):

- POST /reference-data/export/v2/snapshots creates the immutable 12-hour
  bootstrap (snapshotId, through, expiresAt, entityTypes, recordCount).
- GET /reference-data/export/v2/snapshots/:snapshotId/:entityType?cursor=&limit=
  returns source-owned records in strict UUID order, frozen to the same snapshot.
- GET /reference-data/export/v2/changes?after=N&through=M&limit=100
  returns monotonically increasing, replayable committed sequence positions.

Never call legacy /manifest, /feed?since, /entities or timestamp-based v1.
Before completion, the consumer verifies that the active, source-managed
imported-identity count exactly equals the producer's frozen recordCount.
Any mismatch fails closed without advancing the replay cursor. No upstream
signed checksum exists in v2, so a checksum cannot yet be independently
compared; this remains a producer contract review gate.

After the last snapshot entity has completed, checkpoint feedCursor is set to
snapshot.through in one database transaction. Each incremental page commits
canonical writes, per-entity import identity, current sequence and pinned
through together. A crash replays safely from the last durable checkpoint.
On HTTP 410 restart an unfinished frozen bootstrap without resetting an
otherwise healthy incremental cursor. A 401/403 fails closed; 429/5xx retry
with bounded backoff. The snapshot expiry is visible in Admin monitoring.

A source-managed identity that is no longer in a completed replacement
snapshot is archived, not hard-deleted. Imported records track a local UUID
mapping when preexisting marketplace attribute assignments share the same
Product Type/Attribute pair but not the source row ID. Attribute assignment
requirement, visibility, seller-editable, searchable/filterable settings and
other commercial overrides are preserved across source updates.

**Important:** canonical Product Type v3 suggested schemas are mirrored to
reference_sync_canonical_product_type_schemas and must NOT overwrite the
marketplace product_type_schema_versions table referenced by Articles.
Canonical schema snapshots require contractVersion=3,
attributePolicy=SUGGESTED; historic marketplace schemas and their references
are retained.

## Worker and credentials

Configure the consumer API process and a dedicated worker with the same
server-only secrets; never expose the machine key in browser/Next public env:

```env
AUTOTECHDOC_SYNC_BASE_URL=https://autotechdoc.example/api/v1
AUTOTECHDOC_SYNC_TOKEN=<issued-atd_live-machine-key>
AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET=<distinct-32+-character-secret>
```

The producer key is provisioned from
POST /api/v1/admin/b2b/clients/:id/keys under authenticated Admin
admin.accounts.manage; the secret is displayed once and its digest is stored
at rest by AutotechDoc. Rotate/revoke only under separate change approval.

```sh
npm run sync:reference-data:worker -w api
```

Supervise the worker process for restarts. The default persisted schedule is
every five minutes (288 slots/day); Admin may configure 1–1440 minutes or
disable automatic polling. The worker reads the schedule every 15 seconds.
Admin Pro → Autotechdoc synchronization supports manual incremental, resumable
snapshot, reconciliation and explicitly confirmed full resync; all API
operations require ADMIN plus catalog.manage and vehicle.manage.

The optional AutotechDoc notifier can run with:
LEMEKINAYEV2_PUBLICATION_WEBHOOK_URL (HTTPS) and
LEMEKINAYEV2_PUBLICATION_WEBHOOK_SECRET, and the command
npm run notify:reference-publications -w api. A signed HMAC notification only
wakes a pull; the journal is authoritative and scheduled polling recovers
missed hints. Duplicate hints are expected and safe.

## Producer publishing contract dependency gap (review blocker)

The current source v2 allowlist exposes only 24 entity types. Certain published
records can still reference source masters absent from that allowlist:

- AttributeUnit.dimensionId and AttributeDefinition.unitDimensionId require
  UnitDimension; synthesizing a placeholder would violate canonical ownership.
- AttributeDefinition.optionSetId requires AttributeOptionSet.
- VehicleGeneration.derivativeId requires VehicleModelDerivative.
- Configuration market-applicability junctions are also not part of the v2
  projected VehicleConfiguration payload.

The consumer fails safely for missing referenced parents, retains the last
committed checkpoint, and does NOT create fake canonical data. Real source
records using these relationships require a separately reviewed producer
contract extension (and an upgraded consumer allowlist), plus an independent
integration test. Do not silently null the foreign keys or fall back to v1.

## Validation and release restrictions

GitHub Actions consumer workflow validates Prisma, runs all API unit tests,
typechecks, applies migrations ONLY to disposable PostgreSQL and exercises
v2 HTTP client + real consumer DB migrations and checkpoint/restart replay.
It is a simulated v2 HTTP producer, NOT a running AutotechDoc producer with
a second real database. Source-to-consumer E2E, browser Admin confirmation,
data license approval, high-volume snapshot performance, and real credential
rotation/revocation remain external review gates until independently proven.
Do not mark them PASS based only on source code or mocked HTTP responses.

For local proof, provision two **separate disposable** PostgreSQL databases,
start approved source PR #3 and consumer PR #1 apps, seed approved source
reference data (including BEV motor and drive-unit links and Product Type v3
suggestions), issue a test-only B2B machine key, run snapshot+incremental+
reconciliation, verify database counts and entity IDs, kill and restart
consumer mid-snapshot and mid-feed, replay same cursor, and rotate/revoke
the test key. Check UI at mobile and desktop widths.

No PR merge, deployment, production migration, force-push, destruction,
or credentials outside test environments without explicit approval.
