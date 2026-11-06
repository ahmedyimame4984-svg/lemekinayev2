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
Product Type/Attribute pair but not the source row ID. A pre-existing MANUAL marketplace assignment retains its ownership,
status, display order and commercial rules even when the matching canonical
suggestion is published or archived. Source-owned CANONICAL assignments remain
subject to archival. Imported source records still track their canonical IDs
and optional local UUID mapping for deterministic replay.

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

Non-loopback source URLs must be HTTPS, never plaintext HTTP. Only
localhost/127.0.0.1/::1 are permitted as HTTP development endpoints.
Redirects are rejected before forwarding machine credentials. The B2B
token must match the exact 256-bit `atd_live_` key format.

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
missed hints. Duplicate hints are expected and safe: each signed eventId is recorded
in a unique PostgreSQL receipt table before the pull is scheduled. Replays
within the signature window are acknowledged without another worker run;
receipts older than 24 hours are pruned opportunistically. If receipt
persistence is unavailable, the webhook fails closed and scheduled polling
still recovers source changes.

## Publishing v2 governed relationship coverage (29 ordered entities)

The paired draft ATD-06/07 branches now include the previously missing,
independently governed `UnitDimension`, `AttributeOptionSet`,
`AttributeOptionValue`, `VehicleModelDerivative` and
`VehicleConfigurationMarketApplicability` source tables and lifecycle events.
The consumer imports their IDs and relationships directly; it never fabricates
stand-in masters or rewrites commercial Articles. Older 24-entity clients
fail closed until upgraded. Both branches must pass their exact-head CI before
any downstream acceptance or merge decision.

## Live source → consumer two-database acceptance (explicit opt-in)

There is an executable live HTTP + two-PostgreSQL acceptance suite at
`apps/api/test/reference-sync-live-two-database.e2e-spec.ts`. It does NOT
fake `fetch`, open a shared database, apply migrations, create credentials,
seed, or touch remote/production resources. Its normal CI behavior is SKIPPED,
not PASS. Provision and migrate two separate **LOCAL disposable** test/CI
PostgreSQL databases first, run approved AutotechDoc producer against the
source DB, and provision a scoped TEST machine key. Seed ACTIVE, verified
canonical records covering every governed relationship, a BEV with EV
components and a Product Type v3 `SUGGESTED` schema. Use a *fresh* consumer
database (no existing sync checkpoint).

Set the following **server-only test runner** variables (use an approved local
secret mechanism; never commit the token):

```env
ATD_LIVE_TWO_DB_ACCEPTANCE=1
ATD_LIVE_PRODUCER_BASE_URL=http://127.0.0.1:4000/api/v1
ATD_LIVE_PRODUCER_B2B_KEY=<test-only-atd_live-key>
ATD_LIVE_SOURCE_DATABASE_URL=postgresql://<test-user>:<test-password>@127.0.0.1:5432/autotechdoc_test
REFERENCE_SYNC_TEST_DATABASE_URL=postgresql://<test-user>:<test-password>@127.0.0.1:5432/lemekinaye_test
```

From the LemekinayeV2 workspace root:

```sh
npm run test:e2e --workspace=api -- --run test/reference-sync-live-two-database.e2e-spec.ts
```

The live acceptance now fails if its published source fixtures omit a BEV
configuration with battery pack, charging system, electric motor and drive-unit
junctions, or a Product Type v3 SUGGESTED schema. It compares the complete
imported motor/drive junction sets (including positions, quantities and roles)
against the frozen producer snapshot. These checks are SKIPPED unless the
live environment is explicitly provisioned and the suite actually runs.

The suite refuses remote databases, non-test database names, identical DBs,
non-loopback producer APIs, missing test credentials and pre-existing consumer
sync checkpoints. It verifies producer authentication rejection, real HTTP
snapshot/import counts, exact published source identities and FK relations,
BEV identity, v3 schema isolation, real producer PostgreSQL journal revisions
and archives, a fresh worker service and replacement snapshot.

**Verified cross-project CI (2026-11-07):** AutotechDoc runs this opt-in
suite from `.github/workflows/atd-06-07-live-two-database.yml` using its
actual Nest HTTP producer, a **separate running LemekinayeV2 Nest API**, two
distinct migrated disposable PostgreSQL DBs, a test-only scoped machine key,
and independently seeded BEV/v3/29-entity source fixtures. The five live
snapshot/journal/credential-lifecycle tests passed, and an additional
HTTP-to-HTTP check proved signed HMAC 401 rejection, duplicate receipt
persistence and publication-hint-triggered VehicleMake convergence:
[run 42314922360](https://github.com/ahmedyimame4984-svg/autotechdoc/actions/runs/42314922360).
Consumer code tested: `5e8872c793d83d88cc09010743e18a906b56ffa6`;
source code tested: `761cb115262489a8c04b4969543af516b56add65`.
Fixture seeding and direct journal/key mutations are CI-only and gated to
disposable loopback test databases; they are **not** production governance.

Disposable CI has now exercised real post-snapshot revisions/archives,
on-the-wire key scope/rotation/revocation/expiry, and real consumer HTTP HMAC
replay and positive source-to-mirror convergence. Remaining release gates:
independent human Admin desktop/mobile operation, larger snapshot performance,
full dual-process crash/failure recovery and missed-hint/outage fault injection,
source licensing/provenance approval, and an independently verifiable signed
snapshot checksum. No production key action, migration, deployment or merge
is authorized by these test passes.

## Active vehicle powertrain identity parity

The consumer's prior `vehicle_configurations_active_identity_check` was an
ICE-era check that rejected approved BEVs with NULL combustion engine and
conventional transmission IDs. ATD-07 adds a transactional, forward migration
mirroring the independently accepted AutotechDoc Phase C six-class identity
constraint (20261105120000). It preserves generation, trim, body type, market,
steering side and production-start-year requirements for all ACTIVE records.
Unknown and ICE powertrains still require the combustion engine and
transmission; BEV allows those IDs to be NULL. Real disposable PostgreSQL
acceptance verifies BEV motor/drive-unit revisions and rejects malformed ICE
identity. Do not loosen canonical source governance to make imports pass.

## Validation and release restrictions

GitHub Actions consumer workflow validates Prisma, runs all API unit tests,
typechecks, applies migrations ONLY to disposable PostgreSQL and exercises
v2 HTTP client + real consumer DB migrations and checkpoint/restart replay.
It is a simulated v2 HTTP producer, NOT a running AutotechDoc producer with
a second real database. Real source-to-consumer E2E and test-only credential lifecycle have
passed in the separate producer-hosted live workflow; browser Admin evidence,
data license approval, high-volume snapshot performance, and **production**
credential governance remain external review gates.
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
