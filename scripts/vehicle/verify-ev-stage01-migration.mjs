/**
 * Stage 01 EV smoke test. Only works against a fresh empty or restored, local
 * lemekinaye_ev_stage01_test database. Never writes to the working database.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { stage01TestEnvironment } from './ev-stage01-test-environment.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migration = '20261011173000_vehicle_ev_stage01_foundation';
function abort(message) {
  console.error('STAGE 01 BLOCKED: ' + message);
  process.exit(1);
}
let urlText, env;
try { ({ urlText, env } = stage01TestEnvironment(process.env)); }
catch (error) { abort(error.message); }
function run(command, args) {
  const out = spawnSync(command, args, { cwd: root, env, encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024 });
  if (out.error) abort(command + ' not available: ' + out.error.message);
  if (out.status !== 0) {
    // Never print a database URL or password in logs.
    const safe = String(out.stderr || '').split(urlText).join('[REDACTED]');
    const redacted = env.PGPASSWORD
      ? safe.split(env.PGPASSWORD).join('[REDACTED]') : safe;
    console.error(redacted.slice(-3000));
    abort(command + ' exited with status ' + out.status);
  }
  return out.stdout.trim();
}
const sql = query => run(process.platform === 'win32' ? 'psql.exe' : 'psql',
  ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query]);
if (sql('SELECT current_database()') !== 'lemekinaye_ev_stage01_test') {
  abort('Resolved database name is incorrect.');
}
// Support two safe acceptance modes using the same fixed test-database name:
// 1. A completely empty test database: apply the full Prisma migration history.
// 2. A pre-EV restored test clone: apply only the one pending EV migration.
// Refuse partial schemas and unexpected objects rather than silently rewriting them.
const hasVehicleTable = sql("SELECT to_regclass('public.vehicle_configurations') IS NOT NULL") === 't';
const hasMigrationHistory = sql("SELECT to_regclass('public.\"_prisma_migrations\"') IS NOT NULL") === 't';
const freshDatabase = !hasVehicleTable && !hasMigrationHistory;
if (freshDatabase) {
  const publicObjects = sql("SELECT (" +
    "SELECT count(*) FROM pg_catalog.pg_class c " +
    "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace " +
    "WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')) + (" +
    "SELECT count(*) FROM pg_catalog.pg_type t " +
    "JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace " +
    "WHERE n.nspname='public' AND t.typtype IN ('e','d','c')) + (" +
    "SELECT count(*) FROM pg_catalog.pg_proc p " +
    "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')");
  if (publicObjects !== '0') {
    abort('Test database must be completely empty, not partially initialized.');
  }
} else if (!hasVehicleTable || !hasMigrationHistory) {
  abort('Test database has an inconsistent partial schema.');
}

const names = readdirSync(join(root, 'packages/database/prisma/migrations'), {
  withFileTypes: true,
}).filter(e => e.isDirectory() && /^\d{14}_/.test(e.name)).map(e => e.name);
if (!names.includes(migration)) abort('The EV migration file is missing.');

if (!freshDatabase) {
  const applied = JSON.parse(sql('SELECT COALESCE(json_agg(migration_name ORDER BY migration_name) ' +
    "FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), '[]'::json)::text " +
    'FROM public.\"_prisma_migrations\"'));
  if (applied.includes(migration)) abort('EV migration already applied; use a fresh test database.');
  if (sql('SELECT count(*) FROM public.\"_prisma_migrations\" ' +
    'WHERE finished_at IS NULL AND rolled_back_at IS NULL') !== '0') {
    abort('Test clone has failed or incomplete Prisma migrations.');
  }
  const unexpected = applied.filter(n => !names.includes(n));
  if (unexpected.length) abort('Test clone has unknown migration history: ' + unexpected.join(', '));
  const pending = names.filter(n => n !== migration && !applied.includes(n));
  if (pending.length) {
    abort('Other migrations remain pending in the restored clone: ' + pending.join(', '));
  }
  if (sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' " +
    "AND table_name='vehicle_configurations' AND column_name='powertrain_type'") !== '0') {
    abort('EV schema already exists; use a fresh pre-migration test database.');
  }
}
const baseline = "SELECT json_build_object('count',count(*),'digest',md5(" +
  "COALESCE(string_agg((to_jsonb(v) - 'powertrain_type' - 'battery_pack_id' - " +
  "'charging_system_id')::text,'|' ORDER BY v.id::text),'')))::text " +
  'FROM public.vehicle_configurations v';
const before = freshDatabase ? null : JSON.parse(sql(baseline));
const fitmentTables = ['vehicle_compatibilities', 'vehicle_profiles',
  'vehicle_identifier_mappings', 'product_vehicle_articles'];
function fitmentSnapshot() {
  return Object.fromEntries(fitmentTables.map(table => [table, JSON.parse(sql(
    "SELECT json_build_object('count',count(*),'digest',md5(COALESCE(" +
    "string_agg(to_jsonb(v)::text,'|' ORDER BY to_jsonb(v)::text),'')))::text " +
    'FROM public."' + table + '" v'))]));
}
const fitmentBefore = freshDatabase ? null : fitmentSnapshot();
console.log(freshDatabase
  ? 'Fresh, empty test database: applying complete migration history.'
  : 'Existing configured vehicle rows in test clone: ' + before.count);
console.log('Applying pending migration ONLY in the isolated test database...');
if (process.platform === 'win32') {
  run('cmd.exe', ['/d', '/c', 'npm run db:migrate']);
} else {
  run('npm', ['run', 'db:migrate']);
}
console.log('PASS: Prisma Migrate deployment (exit 0).');
const after = JSON.parse(sql(baseline));
if (freshDatabase) {
  if (after.count !== 0) {
    abort('The fresh test database unexpectedly contains configured vehicle records.');
  }
  const recorded = JSON.parse(sql('SELECT COALESCE(json_agg(migration_name ORDER BY migration_name) ' +
    "FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), '[]'::json)::text " +
    'FROM public.\"_prisma_migrations\"'));
  const unrecorded = names.filter(n => !recorded.includes(n));
  if (unrecorded.length) abort('Not all migrations applied: ' + unrecorded.join(', '));
} else if (JSON.stringify(before) !== JSON.stringify(after)) {
  abort('Configured vehicle count or original column data changed.');
}
if (!freshDatabase && JSON.stringify(fitmentBefore) !== JSON.stringify(fitmentSnapshot())) {
  abort('Existing part fitment, garage or identifier link data changed.');
}
if (sql('SELECT count(*) FROM public.vehicle_configurations WHERE ' +
  'powertrain_type IS NOT NULL OR battery_pack_id IS NOT NULL ' +
  'OR charging_system_id IS NOT NULL') !== '0') {
  abort('Historical vehicles received unapproved EV classifications.');
}
for (const table of [
  'vehicle_electric_motors', 'vehicle_battery_packs', 'vehicle_drive_units',
  'vehicle_charging_systems', 'vehicle_configuration_electric_motors',
  'vehicle_configuration_drive_units',
]) {
  if (sql("SELECT to_regclass('public." + table + "') IS NOT NULL") !== 't' ||
      sql('SELECT count(*) FROM public."' + table + '"') !== '0') {
    abort('Missing EV table or unexpected seed rows: ' + table);
  }
}
if (sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' " +
  "AND table_name='vehicle_configurations' AND is_nullable='YES' " +
  "AND column_name IN ('powertrain_type','battery_pack_id','charging_system_id')") !== '3') {
  abort('All three new EV columns must remain nullable.');
}
if (sql('SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name=' +
  "'20261011173000_vehicle_ev_stage01_foundation' AND finished_at IS NOT NULL") !== '1') {
  abort('Prisma did not record the Stage 01 migration.');
}
console.log('PASS: EV schema and 6 new empty EV tables.');
console.log(freshDatabase
  ? 'PASS: fresh test database has zero configured vehicles and full migration history.'
  : 'PASS: ' + after.count + ' configured vehicles unchanged (count and digest).');
console.log('PASS: historical powertrain classifications remain unknown.');
if (!freshDatabase) console.log('PASS: existing part fitment, garage and identifier links unchanged.');
console.log('STAGE 01 TEST DATABASE MIGRATION VERIFIED. Working DB untouched.');

