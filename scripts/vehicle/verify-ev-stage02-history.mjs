import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import pg from 'pg';

const database = process.argv[2];
if (!['lemekinaye_ev_stage02_fresh_utf8', 'lemekinaye_ev_stage02_upgrade_utf8'].includes(database)) {
  throw new Error('Choose one of the two fixed isolated Stage 2 databases.');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrations = resolve(root, 'packages/database/prisma/migrations');
const expected = readdirSync(migrations, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
const client = new pg.Client({ host: '127.0.0.1', port: 55442, user: 'ev_stage2', database });
try {
  await client.connect();
  const { rows } = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name');
  if (JSON.stringify(rows.map(r => r.migration_name)) !== JSON.stringify(expected)) throw new Error('Migration history differs from the repository.');
  for (const row of rows) {
    const checksum = createHash('sha256').update(readFileSync(resolve(migrations, row.migration_name, 'migration.sql'))).digest('hex');
    if (!row.finished_at || row.rolled_back_at || checksum !== row.checksum) throw new Error(`Migration history/checksum failed: ${row.migration_name}`);
  }
  console.log(`PASS: ${rows.length} authentic completed migration checksums (${database})`);
} finally {
  await client.end();
}
