/**
 * ATD-07 real process outage/recovery acceptance. Disposable CI ONLY.
 *
 * Kills the actual producer Nest HTTP process after a committed journal
 * revision, invokes a fresh consumer worker and proves that a transport
 * failure cannot advance its durable cursor. Restarts the producer process,
 * then invokes another NEW worker process and requires source/consumer parity.
 * No mocks, no shared database, no external network access or production keys.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const producerUrl = process.env.ATD_LIVE_PRODUCER_BASE_URL;
const sourceUrl = process.env.ATD_LIVE_SOURCE_DATABASE_URL;
const consumerUrl = process.env.REFERENCE_SYNC_TEST_DATABASE_URL;
const consumerToken = process.env.ATD_LIVE_CONSUMER_B2B_KEY;
const pidPath = '/tmp/atd06-live-source.pid';
const checkpointId = 'autotechdoc-canonical-sync';

function validatedDatabase(raw, name) {
  if (!raw) throw new Error(name + ' is required');
  const parsed = new URL(raw);
  const db = decodeURIComponent(parsed.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !/(^|[_-])(test|ci|disposable)([_-]|$)/u.test(db)) {
    throw new Error(name + ' is not a loopback disposable PostgreSQL database');
  }
  return parsed;
}
if (process.env.NODE_ENV !== 'test' ||
    process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1' ||
    process.env.ATD_LIVE_TWO_DB_ACCEPTANCE !== '1' ||
    !consumerToken || !/^atd_live_[a-zA-Z0-9_-]{43}$/u.test(consumerToken) ||
    producerUrl !== 'http://127.0.0.1:4000/api/v1') {
  throw new Error('Real outage test requires explicitly configured disposable local CI only');
}
const src = validatedDatabase(sourceUrl, 'ATD source');
const dst = validatedDatabase(consumerUrl, 'LemekinayeV2 consumer');
if (src.host === dst.host && src.pathname === dst.pathname) {
  throw new Error('Refusing producer/consumer database aliasing');
}
const source = new pg.Client({ connectionString: sourceUrl });
const consumer = new pg.Client({ connectionString: consumerUrl });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = producerUrl + '/reference-data/export/v2/changes';

async function probe() {
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(800), redirect: 'error' });
    return response.status;
  } catch {
    return null;
  }
}
async function waitUntil(expectedUp) {
  for (let n = 0; n < 80; n++) {
    const status = await probe();
    if (expectedUp ? status === 401 : status === null) return;
    await sleep(200);
  }
  throw new Error(expectedUp ? 'Restarted producer was not healthy' : 'Producer stayed online after SIGTERM');
}
async function worker() {
  // Never interpolate the token into commands or logs; child inherits it as
  // environment data and the server-side B2B client masks it.
  const result = spawnSync(process.execPath, [
    'consumer/apps/api/dist/scripts/sync-reference-data.js',
    '--mode=incremental', '--batch-size=10',
  ], {
    env: {
      ...process.env,
      DATABASE_URL: consumerUrl,
      AUTOTECHDOC_SYNC_BASE_URL: producerUrl,
      AUTOTECHDOC_SYNC_TOKEN: consumerToken,
    },
    cwd: process.cwd(), encoding: 'utf8', timeout: 50_000,
    maxBuffer: 512 * 1024,
  });
  return { ok: result.status === 0 && !result.error, timedOut: result.error?.code === 'ETIMEDOUT' };
}
async function state() {
  const cp = await consumer.query(
    'SELECT "feed_cursor", "snapshot_status", "batch_through" FROM "reference_sync_checkpoints" WHERE "id" = $1',
    [checkpointId],
  );
  if (cp.rowCount !== 1 || cp.rows[0].snapshot_status !== 'COMPLETED') {
    throw new Error('Outage recovery must start with a verified completed source snapshot');
  }
  return cp.rows[0];
}
let oldPid = null;
let restartedChild = null;
let stopped = false;
try {
  await source.connect();
  await consumer.connect();
  if ((await source.query('SELECT current_database() AS name')).rows[0].name ===
      (await consumer.query('SELECT current_database() AS name')).rows[0].name) {
    throw new Error('Source and consumer resolved to the same database');
  }
  const original = await state();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(original.feed_cursor ?? '')) {
    throw new Error('Source replay cursor is not a committed numeric journal cursor');
  }
  const make = await source.query(
    'UPDATE "vehicle_makes" SET "name" = $1, "version" = "version" + 1, "updated_at" = NOW() ' +
    'WHERE "name" = $2 AND "status" = \'ACTIVE\' RETURNING "id"',
    ['Producer outage recovered', 'Actual AutotechDoc notifier delivered'],
  );
  if (make.rowCount !== 1) throw new Error('Missing CI-only producer VehicleMake fixture');
  const makeId = make.rows[0].id;
  const journal = await source.query(
    'SELECT "sequence"::text AS seq FROM "canonical_publication_changes" ' +
    'WHERE "entity_type" = \'VehicleMake\' AND "entity_id" = $1::uuid ORDER BY "sequence" DESC LIMIT 1',
    [makeId],
  );
  if (journal.rowCount !== 1 || BigInt(journal.rows[0].seq) <= BigInt(original.feed_cursor)) {
    throw new Error('Producer did not commit a new durable journal revision');
  }
  oldPid = Number(readFileSync(pidPath, 'utf8').trim());
  if (!Number.isInteger(oldPid) || oldPid < 2) throw new Error('Invalid disposable source process PID');
  process.kill(oldPid, 'SIGTERM');
  stopped = true;
  try {
    await waitUntil(false);
    const failed = await worker();
    if (failed.ok || failed.timedOut) {
      throw new Error('Offline producer did not fail closed promptly for fresh consumer worker');
    }
    const noMove = await state();
    if (noMove.feed_cursor !== original.feed_cursor ||
        noMove.batch_through !== original.batch_through) {
      throw new Error('Consumer durable cursor moved while upstream HTTP was unavailable');
    }
    const stale = await consumer.query(
      'SELECT "name" FROM "vehicle_makes" WHERE "id" = $1::uuid', [makeId],
    );
    if (stale.rows[0]?.name === 'Producer outage recovered') {
      throw new Error('Consumer applied unverified updates despite producer outage');
    }
  } finally {
    if (stopped) {
      restartedChild = spawn(process.execPath, ['producer/api/dist/main.js'], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: '4000', DATABASE_URL: sourceUrl },
        stdio: 'ignore',
      });
      if (!restartedChild.pid) throw new Error('Failed to restart disposable producer process');
      writeFileSync(pidPath, String(restartedChild.pid) + '\n');
      restartedChild.unref();
      await waitUntil(true);
    }
  }
  const recovered = await worker();
  if (!recovered.ok) throw new Error('Fresh consumer worker did not recover after producer restart');
  const final = await state();
  if (BigInt(final.feed_cursor) < BigInt(journal.rows[0].seq) ||
      BigInt(final.feed_cursor) <= BigInt(original.feed_cursor)) {
    throw new Error('Recovered consumer did not advance to the committed source revision');
  }
  const local = await consumer.query(
    'SELECT "name" FROM "vehicle_makes" WHERE "id" = $1::uuid', [makeId],
  );
  if (local.rows[0]?.name !== 'Producer outage recovered') {
    throw new Error('Producer and marketplace mirrors did not converge after HTTP restart');
  }
  console.log('PASS: actual source SIGTERM, failed independent consumer process, unchanged journal checkpoint, source restart, new consumer process and convergence');
} finally {
  await Promise.allSettled([source.end(), consumer.end()]);
}
