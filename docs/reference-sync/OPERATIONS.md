# Autotechdoc → LemekinayeV2: synchronization triggers

## Services to deploy

The existing API endpoints are not a scheduler. Deploy the **dedicated worker process** separately from the API:

```sh
npm run sync:reference-data:worker -w api
```

Run it under a restartable supervisor (systemd, PM2, container orchestrator).
The worker checks for a completed initial snapshot and starts/resumes it automatically
if needed. After a successful run or failure it waits the configured interval
(default five minutes) and polls again. It must have access to the **LemekinayeV2**
PostgreSQL database; Autotechdoc is contacted only through authenticated HTTP.

```env
AUTOTECHDOC_SYNC_BASE_URL=https://autotechdoc.example/api/v1
AUTOTECHDOC_SYNC_TOKEN=<same-strong-machine-export-token-as-Autotechdoc>
AUTOTECHDOC_SYNC_INTERVAL_SECONDS=300
AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET=<distinct-strong-secret-at-least-32-chars>
```

Autotechdoc uses `AUTOTECHDOC_REFERENCE_EXPORT_TOKEN` on the source API.
Never put these tokens in the browser or commit them into Git.

When a full snapshot is interrupted, starting the worker again resumes its
saved entity cursors. Forced full re-sync is restricted to the Admin interface.
Ordinary marketplace reads continue using local PostgreSQL when the source is offline.

## Optional fast notification worker

Deploy separately on the **Autotechdoc** side:

```sh
npm run notify:reference-publications -w api
```

```env
LEMEKINAYEV2_PUBLICATION_WEBHOOK_URL=https://lemekinaye.example/api/v1/integrations/autotechdoc/publication
LEMEKINAYEV2_PUBLICATION_WEBHOOK_SECRET=<same-distinct-webhook-secret-as-Lemekinaye>
AUTOTECHDOC_NOTIFICATION_POLL_SECONDS=30
```

This optional worker polls Autotechdoc's published feed and sends a timestamped
HMAC-SHA256 notification. The receiver checks the signature, accepts the hint,
and invokes the normal incremental pull. It does not accept the notification's
content as canonical data. The five-minute worker guarantees *attempted*
catch-up even if a notification is lost; the current source feed still requires
a durable publication journal before a no-loss guarantee is justified.

**Current limitation:** this notifier polls the feed rather than being emitted
atomically by every publication transaction. It is not a durable outbox.
It can deliver duplicate hints after restart. The receiver is intentionally
idempotent in effect through the existing sync lock and upserts. Prefer an
outbox-based publisher in a later reliability milestone.

## Manual Admin operations

The Admin Pro menu now contains **Autotechdoc sync**. Operations use authenticated
Next.js BFF routes, which forward user credentials to API endpoints protected
by ADMIN account type and **both** `catalog.manage` and `vehicle.manage`.
The UI shows last success/failure, checkpoint, counters and active worker status.
Full resync requires a second confirmation.

The page is an operational UI, not a substitute for the scheduled worker.

## Acceptance still required

- Start two isolated PostgreSQL instances and verify source publication to local sync.
- Verify first snapshot, resumable interruption and 5-minute periodic pull.
- Verify notification signature rejection, replay and lost-notification recovery.
- Verify worker contention, lease timeout, archival, local customizations and
  source downtime/reconnection.
- Run API/Admin builds, typechecks, unit/integration tests and migrate validation.

Do not merge or deploy without actual verification.
