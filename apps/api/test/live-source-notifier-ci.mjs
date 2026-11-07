// Disposable-only proof that the actual AutotechDoc durable notifier worker
// sends an HMAC hint to the running LemekinayeV2 HTTP API, whose consumer then
// pulls authoritative source journal records into its separate PostgreSQL.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';

const sourceUrl = process.env.ATD_LIVE_SOURCE_DATABASE_URL;
const consumerUrl = process.env.REFERENCE_SYNC_TEST_DATABASE_URL;
const secret = process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET;
if (process.env.NODE_ENV !== 'test' ||
    process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1' ||
    !sourceUrl || !consumerUrl || !secret || secret.length < 32) {
  throw new Error('Only explicit local disposable notifier acceptance is permitted');
}
function testLocation(raw) {
  const parsed = new URL(raw);
  const name = decodeURIComponent(parsed.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !/(^|[_-])(test|ci|disposable)([_-]|$)/u.test(name)) {
    throw new Error('Notifier acceptance cannot access a remote or production database');
  }
  return parsed;
}
const a = testLocation(sourceUrl), b = testLocation(consumerUrl);
if (a.host === b.host && a.pathname === b.pathname) {
  throw new Error('Source and consumer PostgreSQL must be physically separate');
}

const source = new pg.Client({ connectionString: sourceUrl });
const consumer = new pg.Client({ connectionString: consumerUrl });
let child;
try {
  await source.connect();
  await consumer.connect();
  const previousReceipt = Number((await consumer.query(
    'SELECT COUNT(*)::int AS count FROM "reference_sync_notification_receipts"',
  )).rows[0].count);
  const nextName = 'Actual AutotechDoc notifier delivered';
  const update = await source.query(`
    UPDATE "vehicle_makes"
    SET "name" = $1, "version" = "version" + 1, "updated_at" = NOW()
    WHERE "name" = $2 AND "status" = 'ACTIVE'
    RETURNING "id"
  `, [nextName, 'HMAC publication trigger verified']);
  if (update.rowCount !== 1) throw new Error('Missing verified disposable source vehicle make');
  const makeId = update.rows[0].id;
  const event = await source.query(`
    SELECT "sequence"::text AS seq FROM "canonical_publication_changes"
    WHERE "entity_type" = 'VehicleMake' AND "entity_id" = $1::uuid
    ORDER BY "sequence" DESC LIMIT 1
  `, [makeId]);
  if (event.rowCount !== 1) throw new Error('Producer transaction did not journal VehicleMake');
  const targetSequence = BigInt(event.rows[0].seq);

  child = spawn(process.execPath, [
    resolve('producer/api/dist/scripts/notify-reference-publications.js'),
  ], {
    env: {
      ...process.env,
      DATABASE_URL: sourceUrl,
      LEMEKINAYEV2_PUBLICATION_WEBHOOK_URL:
        'http://127.0.0.1:4002/api/v1/integrations/autotechdoc/publication',
      LEMEKINAYEV2_PUBLICATION_WEBHOOK_SECRET: secret,
      AUTOTECHDOC_NOTIFICATION_POLL_SECONDS: '10',
    },
    stdio: 'ignore',
  });

  let accepted = false;
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) {
      throw new Error('Actual source notification worker stopped before delivery');
    }
    const receipts = Number((await consumer.query(
      'SELECT COUNT(*)::int AS count FROM "reference_sync_notification_receipts"',
    )).rows[0].count);
    const mirror = await consumer.query(
      'SELECT "name" FROM "vehicle_makes" WHERE "id" = $1::uuid', [makeId],
    );
    const state = await source.query(`
      SELECT "cursor"::text AS cursor
      FROM "canonical_publication_delivery_states"
      WHERE "consumer_key" = 'lemekinayev2-reference-trigger'
    `);
    if (receipts > previousReceipt && mirror.rows[0]?.name === nextName &&
        state.rowCount === 1 && BigInt(state.rows[0].cursor) >= targetSequence) {
      accepted = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!accepted) {
    throw new Error('Running publisher notifier did not deliver and checkpoint canonical convergence');
  }
  console.log('PASS: actual AutotechDoc notifier HMAC delivery, durable source cursor and consumer journal convergence');
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  await source.end();
  await consumer.end();
}
