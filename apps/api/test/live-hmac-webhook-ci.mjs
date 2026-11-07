// Real HTTP publication-hint acceptance for the disposable ATD-06/07 CI pair.
// This file must never run against shared, remote or production databases.
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';

const sourceUrl = process.env.ATD_LIVE_SOURCE_DATABASE_URL;
const consumerUrl = process.env.REFERENCE_SYNC_TEST_DATABASE_URL;
const secret = process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET;
if (process.env.NODE_ENV !== 'test' || process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1' ||
    !sourceUrl || !consumerUrl || !secret || secret.length < 32) {
  throw new Error('Live webhook CI requires explicit disposable-only test variables');
}
function verifyUrl(value) {
  const parsed = new URL(value);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !/(^|[_-])(test|ci|disposable)([_-]|$)/u.test(database)) {
    throw new Error('Refusing non-loopback or non-test PostgreSQL URL');
  }
  return parsed;
}
const sourceLocation = verifyUrl(sourceUrl);
const consumerLocation = verifyUrl(consumerUrl);
if (sourceLocation.host === consumerLocation.host &&
    sourceLocation.pathname === consumerLocation.pathname) {
  throw new Error('Producer and consumer must have physically distinct databases');
}
const webhook = 'http://127.0.0.1:4002/api/v1/integrations/autotechdoc/publication';
const source = new pg.Client({ connectionString: sourceUrl });
const consumer = new pg.Client({ connectionString: consumerUrl });

async function send(eventId, timestamp, signature) {
  const response = await fetch(webhook, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
    headers: {
      'Content-Type': 'application/json',
      'x-autotechdoc-timestamp': timestamp,
      'x-autotechdoc-signature': signature,
    },
    body: JSON.stringify({ eventId, eventType: 'reference-data.published' }),
  });
  return response.status;
}

try {
  await source.connect();
  await consumer.connect();
  if ((await source.query('SELECT current_database() AS name')).rows[0].name ===
      (await consumer.query('SELECT current_database() AS name')).rows[0].name) {
    throw new Error('Resolved to the SAME database');
  }
  const sourceUpdated = await source.query(`
    UPDATE "vehicle_makes"
    SET "name" = $1, "version" = "version" + 1, "updated_at" = NOW()
    WHERE "name" = $2 AND "status" = 'ACTIVE'
    RETURNING "id"
  `, ['HMAC publication trigger verified', 'Test EV manufacturer']);
  if (sourceUpdated.rowCount !== 1) throw new Error('Missing disposable published VehicleMake');
  const makeId = sourceUpdated.rows[0].id;

  const eventId = randomUUID();
  const timestamp = String(Date.now());
  const payload = `${timestamp}.${eventId}.reference-data.published`;
  const signature = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  const invalid = 'sha256=' + '0'.repeat(64);

  // Invalid, expired and correctly signed requests go through the real consumer
  // Nest controller, not an in-process controller mock.
  if (await send(eventId, timestamp, invalid) !== 401) {
    throw new Error('HMAC invalid signature did not return HTTP 401');
  }
  if (await send(eventId, String(Date.now() - 600_000), signature) !== 401) {
    throw new Error('HMAC expired timestamp did not return HTTP 401');
  }
  if (await send(eventId, timestamp, signature) !== 202) {
    throw new Error('Authenticated publication trigger was not accepted (202)');
  }
  if (await send(eventId, timestamp, signature) !== 202) {
    throw new Error('Duplicate signed trigger was not idempotently acknowledged');
  }

  const receipts = await consumer.query(
    'SELECT COUNT(*)::int AS count FROM "reference_sync_notification_receipts" WHERE "event_id" = $1::uuid',
    [eventId],
  );
  if (receipts.rows[0].count !== 1) {
    throw new Error('PostgreSQL did not deduplicate webhook notification receipts');
  }

  // A valid hint should cause an authoritative incremental pull of the source
  // journal; the signed body is never treated as canonical data.
  let converged = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const observed = await consumer.query(
      'SELECT "name" FROM "vehicle_makes" WHERE "id" = $1::uuid',
      [makeId],
    );
    if (observed.rows[0]?.name === 'HMAC publication trigger verified') {
      converged = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!converged) throw new Error('Signed webhook did not converge canonical VehicleMake via HTTP');
  console.log('PASS: real consumer HTTP signed HMAC, replay protection, 401 negatives, producer journal convergence');
} finally {
  await source.end();
  await consumer.end();
}
