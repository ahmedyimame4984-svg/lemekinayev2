/**
 * ATD-07 process-crash and persisted snapshot checkpoint acceptance.
 *
 * Operates only on two explicitly named loopback disposable CI databases.
 * The first consumer worker is killed with SIGKILL after at least one actual
 * source HTTP page is transactionally saved. A second worker must respect
 * the unreleased lease, then resume the same frozen source snapshot after
 * test-only simulated lease expiry. This does not rewrite source data.
 */
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';

function disposable(raw, label) {
  if (!raw) throw new Error(label + ' required');
  const u = new URL(raw);
  const name = decodeURIComponent(u.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(u.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
      !/(?:^|[_-])(test|ci|disposable)(?:[_-]|$)/u.test(name)) {
    throw new Error(label + ' must be a loopback disposable PostgreSQL database');
  }
  return u;
}

const sourceUrl = process.env.ATD_LIVE_SOURCE_DATABASE_URL;
const consumerUrl = process.env.REFERENCE_SYNC_TEST_DATABASE_URL;
const upstream = process.env.ATD_LIVE_PRODUCER_BASE_URL;
const token = process.env.ATD_LIVE_CONSUMER_B2B_KEY;
if (process.env.NODE_ENV !== 'test' ||
    process.env.ATD_LIVE_TWO_DB_ACCEPTANCE !== '1' ||
    process.env.ATD_LIVE_MUTATE_DISPOSABLE_SOURCE !== '1' ||
    upstream !== 'http://127.0.0.1:4000/api/v1' ||
    !/^atd_live_[a-zA-Z0-9_-]{43}$/u.test(token ?? '')) {
  throw new Error('Crash test is permitted only in explicit isolated CI');
}
const src = disposable(sourceUrl, 'source');
const dst = disposable(consumerUrl, 'consumer');
if (src.host === dst.host && src.pathname === dst.pathname) {
  throw new Error('Source and consumer may never share a database');
}

const db = new pg.Client({ connectionString: consumerUrl });
const workerArgs = ['consumer/apps/api/dist/scripts/sync-reference-data.js'];
const env = {
  ...process.env,
  DATABASE_URL: consumerUrl,
  AUTOTECHDOC_SYNC_BASE_URL: upstream,
  AUTOTECHDOC_SYNC_TOKEN: token,
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checkpointId = 'autotechdoc-canonical-sync';

async function checkpoint() {
  const r = await db.query(
    'SELECT "snapshot_status", "snapshot_id", "snapshot_record_count", ' +
    '"snapshot_applied_digest", "snapshot_content_sha256", "snapshot_through", "feed_cursor", ' +
    '"worker_id", "locked_until" FROM "reference_sync_checkpoints" WHERE "id" = $1',
    [checkpointId],
  );
  if (r.rowCount !== 1) throw new Error('Missing durable consumer sync checkpoint');
  return r.rows[0];
}
async function brandPage() {
  const r = await db.query(
    'SELECT "status", "record_count" FROM "reference_sync_entity_states" ' +
    'WHERE "checkpoint_id" = $1 AND "entity_type" = $2',
    [checkpointId, 'Brand'],
  );
  return r.rows[0] ?? null;
}
function runWorker(args, timeout = 180_000) {
  const result = spawnSync(process.execPath, [...workerArgs, ...args], {
    cwd: process.cwd(), env, stdio: 'ignore', timeout,
  });
  return { success: result.status === 0 && !result.error, errorCode: result.error?.code };
}
let firstWorker;
try {
  await db.connect();
  const brandCount = Number((await db.query(
    'SELECT COUNT(*)::int AS count FROM "brands" WHERE "status" = \'ACTIVE\'',
  )).rows[0].count);
  if (brandCount < 500) throw new Error('Multi-page crash test requires 500+ CI-only brands');
  const before = await checkpoint();
  if (before.snapshot_status !== 'COMPLETED' ||
      !/^(?:0|[1-9][0-9]*)$/u.test(before.feed_cursor)) {
    throw new Error('Start crash recovery from a verified completed snapshot');
  }

  firstWorker = spawn(process.execPath, [
    ...workerArgs, '--mode=snapshot', '--force-full', '--batch-size=5',
  ], { cwd: process.cwd(), env, stdio: 'ignore' });
  if (!firstWorker.pid) throw new Error('Failed to launch actual consumer CLI worker');

  let interrupted = false;
  for (let attempt = 0; attempt < 2100; attempt++) {
    if (firstWorker.exitCode !== null || firstWorker.signalCode !== null) {
      throw new Error('Snapshot worker exited before a durable first page was observed');
    }
    const cp = await checkpoint();
    const brand = await brandPage();
    if (cp.snapshot_status === 'IN_PROGRESS' &&
        brand?.status === 'IN_PROGRESS' &&
        brand.record_count >= 10 && brand.record_count < brandCount &&
        cp.snapshot_applied_digest && cp.worker_id) {
      firstWorker.kill('SIGKILL');
      if (firstWorker.exitCode === null && firstWorker.signalCode === null) {
        await once(firstWorker, 'exit');
      }
      interrupted = true;
      break;
    }
    await sleep(35);
  }
  if (!interrupted) throw new Error('Cannot confirm durable page checkpoint prior to SIGKILL');

  const crashed = await checkpoint();
  const saved = await brandPage();
  if (crashed.snapshot_status !== 'IN_PROGRESS' ||
      crashed.feed_cursor !== before.feed_cursor ||
      !crashed.snapshot_id ||
      !crashed.snapshot_applied_digest ||
      crashed.snapshot_applied_digest === crashed.snapshot_content_sha256 ||
      !(saved?.record_count >= 10 && saved.record_count < brandCount)) {
    throw new Error('Durable snapshot/page cursor not preserved after abrupt worker death');
  }

  const blocked = runWorker(['--mode=snapshot', '--batch-size=5'], 30_000);
  if (blocked.success || blocked.errorCode === 'ETIMEDOUT') {
    throw new Error('Competing worker bypassed crashed worker lease or hung');
  }
  const locked = await checkpoint();
  if (locked.snapshot_id !== crashed.snapshot_id ||
      locked.feed_cursor !== before.feed_cursor) {
    throw new Error('New worker modified checkpoint before the crash lease expired');
  }

  // Precisely emulate passage of the five-minute lease TTL in disposable CI.
  // Never clear a lease in production or a user database.
  const expired = await db.query(
    'UPDATE "reference_sync_checkpoints" ' +
    'SET "locked_until" = NOW() - INTERVAL \'1 second\' ' +
    'WHERE "id" = $1 AND "worker_id" = $2 RETURNING "id"',
    [checkpointId, crashed.worker_id],
  );
  if (expired.rowCount !== 1) throw new Error('Crashed lease owner unexpectedly changed');

  const recovered = runWorker(['--mode=snapshot', '--batch-size=25'], 240_000);
  if (!recovered.success) {
    throw new Error('Fresh consumer CLI did not resume the frozen HTTP snapshot after lease expiry');
  }
  const final = await checkpoint();
  const completeBrand = await brandPage();
  if (final.snapshot_status !== 'COMPLETED' ||
      final.snapshot_id !== crashed.snapshot_id ||
      final.feed_cursor !== final.snapshot_through ||
      final.snapshot_applied_digest !== final.snapshot_content_sha256 ||
      !/^[a-f0-9]{64}$/u.test(final.snapshot_content_sha256 ?? '') ||
      completeBrand?.record_count !== brandCount ||
      final.worker_id !== null) {
    throw new Error('Crash recovery did not finish the SAME frozen checksum-verified snapshot');
  }
  console.log('PASS: real consumer SIGKILL, durable partial page+digest, lease fencing, expiry and independent process resume without resnapshot');
} finally {
  if (firstWorker && firstWorker.exitCode === null && firstWorker.signalCode === null) {
    firstWorker.kill('SIGKILL');
  }
  await db.end();
}
