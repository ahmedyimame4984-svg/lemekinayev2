import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stage01TestEnvironment } from './ev-stage01-test-environment.mjs';

const schema = readFileSync(
  new URL('../../packages/database/prisma/schema.prisma', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('../../packages/database/prisma/migrations/20261011173000_vehicle_ev_stage01_foundation/migration.sql', import.meta.url),
  'utf8',
);

function model(name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'u'));
  assert.ok(match, `Expected model ${name}`);
  return match[1];
}

test('Stage 01 preserves existing combustion engine and transmission fields', () => {
  const configuration = model('VehicleConfiguration');
  assert.match(configuration, /engineId\s+String\?\s+@map\("engine_id"\) @db\.Uuid/u);
  assert.match(configuration, /transmissionId\s+String\?\s+@map\("transmission_id"\) @db\.Uuid/u);
  assert.match(configuration, /identityCode\s+String\s+@unique/u);
  assert.match(configuration, /steeringSide\s+VehicleSteeringSide\?/u);
});

test('Stage 01 never assumes unverified historic powertrain', () => {
  const configuration = model('VehicleConfiguration');
  assert.match(configuration, /powertrainType\s+VehiclePowertrainType\?\s+@map\("powertrain_type"\)/u);
  assert.match(migration, /ADD COLUMN "powertrain_type" "VehiclePowertrainType"/u);
  assert.doesNotMatch(migration, /ADD COLUMN "powertrain_type"[^,;]*NOT NULL/u);
  assert.doesNotMatch(migration, /^\s*(?:DELETE|UPDATE|TRUNCATE|DROP)\b/imu);
});

test('Stage 01 defines four reusable audited technical masters', () => {
  for (const name of ['VehicleElectricMotor', 'VehicleBatteryPack', 'VehicleDriveUnit', 'VehicleChargingSystem']) {
    const content = model(name);
    assert.match(content, /status\s+MasterDataStatus\s+@default\(DRAFT\)/u);
    assert.match(content, /version\s+Int\s+@default\(1\)/u);
    assert.match(content, /createdById\s+String\s+@map\("created_by_id"\)/u);
    assert.match(content, /updatedById\s+String\s+@map\("updated_by_id"\)/u);
  }
  for (const table of ['vehicle_electric_motors', 'vehicle_battery_packs', 'vehicle_drive_units', 'vehicle_charging_systems']) {
    assert.ok(migration.includes(`CREATE TABLE "${table}"`));
  }
});

test('Stage 01 supports multiple motor and drive-unit assignments per vehicle', () => {
  const config = model('VehicleConfiguration');
  assert.match(config, /electricMotors\s+VehicleConfigurationElectricMotor\[\]/u);
  assert.match(config, /driveUnits\s+VehicleConfigurationDriveUnit\[\]/u);
  for (const modelName of ['VehicleConfigurationElectricMotor', 'VehicleConfigurationDriveUnit']) {
    const content = model(modelName);
    assert.match(content, /position\s+VehicleElectricMotorPosition\s+@default\(UNKNOWN\)/u);
    assert.match(content, /configurationId\s+String/u);
    assert.match(content, /@@unique/u);
  }
  assert.match(migration, /CREATE TABLE "vehicle_configuration_electric_motors"/u);
  assert.match(migration, /CREATE TABLE "vehicle_configuration_drive_units"/u);
  const assignmentColumns = [...migration.matchAll(/"position" "VehicleElectricMotorPosition" NOT NULL DEFAULT 'UNKNOWN'/gu)];
  assert.equal(assignmentColumns.length, 2, 'Both assignment tables must prevent duplicate null-position rows');
  assert.match(schema, /enum VehicleElectricMotorPosition \{\s+UNKNOWN/u);
});

test('Stage 01 migration uses unique PostgreSQL constraint identifiers', () => {
  const names = [...migration.matchAll(/CONSTRAINT "([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((name) => name.length <= 63));
});

test('Stage 01 smoke verifier can migrate only a local, isolated test database', () => {
  const verifier = readFileSync(
    new URL('./verify-ev-stage01-migration.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /stage01TestEnvironment\(process\.env\)/u);
  assert.match(verifier, /const pending = names\.filter/u);
  assert.match(verifier, /JSON\.stringify\(before\) !== JSON\.stringify\(after\)/u);
  assert.match(verifier, /powertrain_type IS NOT NULL OR battery_pack_id IS NOT NULL/u);
  assert.match(verifier, /STAGE 01 TEST DATABASE MIGRATION VERIFIED/u);
});

test('Stage 01 permits a completely empty isolated test database without touching a working database', () => {
  const verifier = readFileSync(
    new URL('./verify-ev-stage01-migration.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /const freshDatabase = !hasVehicleTable && !hasMigrationHistory/u);
  assert.match(verifier, /Test database must be completely empty/u);
  assert.match(verifier, /Test database has an inconsistent partial schema/u);
  assert.match(verifier, /freshDatabase \? null : JSON\.parse\(sql\(baseline\)\)/u);
  assert.match(verifier, /if \(after\.count !== 0\)/u);
  assert.match(verifier, /const unrecorded = names\.filter/u);
  assert.match(verifier, /const pending = names\.filter/u);
  assert.match(verifier, /pg_catalog\.pg_type/u);
  assert.match(verifier, /pg_catalog\.pg_proc/u);
});

const localTestUrl = 'postgresql://test:test@127.0.0.1:5432/lemekinaye_ev_stage01_test?schema=public';

for (const [name, url] of [
  ['working database', 'postgresql://test:test@localhost:5432/lemekinaye'],
  ['remote host', 'postgresql://test:test@db.example.com/lemekinaye_ev_stage01_test'],
  ['wrong schema', localTestUrl.replace('public', 'working')],
  ['duplicate schema', localTestUrl + '&schema=working'],
  ['libpq host override', localTestUrl + '&host=remote.example.com'],
  ['socket override', localTestUrl + '&host=%2Fvar%2Frun%2Fpostgresql'],
  ['missing explicit role', 'postgresql://localhost/lemekinaye_ev_stage01_test'],
  ['malformed encoding', localTestUrl.replace('test?', '%FF?')],
  ['unsupported protocol', localTestUrl.replace('postgresql:', 'https:')],
]) {
  test('Stage 01 rejects ' + name + ' before any connection', () => {
    assert.throws(() => stage01TestEnvironment({ DATABASE_URL: url }));
  });
}

test('Stage 01 rejects a Prisma DIRECT_URL override before any connection', () => {
  assert.throws(() => stage01TestEnvironment({
    DATABASE_URL: localTestUrl, DIRECT_URL: 'postgresql://working.example.com/working',
  }), /Unset DIRECT_URL/u);
});

test('Stage 01 removes inherited routing and dotenv overrides from both subprocesses', () => {
  const source = {
    DATABASE_URL: localTestUrl, PATH: 'preserve-path',
    PGHOSTADDR: '192.0.2.1', PGSERVICE: 'working', PGOPTIONS: '--search_path=working',
    PGSERVICEFILE: '/working/service.conf', PGPASSFILE: '/working/passwords',
    PgHostAddr: '192.0.2.2', Dotenv_Config_Path: '/working/other.env',
    DOTENV_CONFIG_OVERRIDE: 'true', DOTENV_CONFIG_PATH: '/working/.env',
  };
  const { env } = stage01TestEnvironment(source);
  for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGOPTIONS', 'PGSERVICEFILE',
    'PGPASSFILE', 'PgHostAddr', 'Dotenv_Config_Path', 'DOTENV_CONFIG_OVERRIDE', 'DOTENV_CONFIG_PATH']) {
    assert.equal(env[key], undefined, key + ' must not redirect a test subprocess');
  }
  assert.equal(env.PGHOST, '127.0.0.1');
  assert.equal(env.PGDATABASE, 'lemekinaye_ev_stage01_test');
  assert.equal(env.DATABASE_URL, localTestUrl);
  assert.equal(env.DIRECT_URL, '');
  assert.equal(env.PATH, source.PATH);
  assert.equal(source.PGHOSTADDR, '192.0.2.1', 'do not modify the caller environment');
});

test('Stage 01 safely encodes test passwords and accepts explicit loopback targets', () => {
  const password = 'test@:/?#% password';
  const { urlText, env } = stage01TestEnvironment({ EV_STAGE01_PASSWORD: password });
  assert.equal(decodeURIComponent(new URL(urlText).password), password);
  assert.equal(env.PGPASSWORD, password);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const result = stage01TestEnvironment({
      DATABASE_URL: 'postgresql://test:test@' + host + ':15432/lemekinaye_ev_stage01_test',
    });
    assert.equal(result.env.PGPORT, '15432');
    assert.equal(result.env.PGDATABASE, 'lemekinaye_ev_stage01_test');
  }
});

test('Stage 01 honors a bounded explicit connection timeout in libpq', () => {
  assert.equal(stage01TestEnvironment({ DATABASE_URL: localTestUrl }).env.PGCONNECT_TIMEOUT, '10');
  const url = localTestUrl + '&connect_timeout=30';
  const { env } = stage01TestEnvironment({ DATABASE_URL: url });
  assert.equal(env.PGCONNECT_TIMEOUT, '30');
  assert.equal(env.DATABASE_URL, url, 'keep the same explicit timeout for Prisma');
  for (const value of ['', '0', '-1', '1.5', '61', 'invalid']) {
    assert.throws(() => stage01TestEnvironment({
      DATABASE_URL: localTestUrl + '&connect_timeout=' + value,
    }), /connect_timeout/u);
  }
});

