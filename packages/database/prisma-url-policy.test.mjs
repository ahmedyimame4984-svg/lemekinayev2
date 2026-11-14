import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSameDatabase, resolveDatasource } from './prisma-url-policy.mjs';
const primary = 'postgresql://fixture:fixture-secret@127.0.0.1:55435/atd_merge_test?schema=public';
for (const [name, direct] of Object.entries({
  identical: primary,
  credentials: primary.replace('fixture:fixture-secret', 'other:other-secret'),
  defaultSchema: primary.split('?')[0],
  encodedSchema: primary.replace('public', 'publ%69c'),
  encodedDatabase: primary.replace('atd_merge_test', 'atd%5Fmerge%5Ftest'),
  normalizedPort: primary.replace(':55435/', ':055435/'),
  protocolAlias: primary.replace('postgresql:', 'postgres:'),
})) test('accepts ' + name, () => assert.doesNotThrow(() => assertSameDatabase(primary, direct)));
for (const [name, direct] of Object.entries({
  database: primary.replace('atd_merge_test', 'other_test'),
  host: primary.replace('127.0.0.1', 'localhost'),
  port: primary.replace('55435', '55436'),
  schema: primary.replace('public', 'other'),
  duplicateSchema: primary + '&schema=other',
  encodedDuplicateSchema: primary + '&%73chema=other',
  hostOverride: primary + '&host=other',
  optionsOverride: primary + '&options=-csearch_path=other',
  unknownOption: primary + '&unknown=value',
  protocol: primary.replace('postgresql:', 'https:'),
  missingDatabase: primary.replace('atd_merge_test', ''),
  emptySchema: primary.replace('public', ''),
  badEncoding: primary.replace('atd_merge_test', '%SECRET'),
})) test('rejects redacted ' + name, () => {
  assert.throws(() => assertSameDatabase(primary, direct), error => {
    assert.doesNotMatch(error.message, /fixture-secret|other-secret|postgresql:\/\/|%SECRET/);
    return true;
  });
  if (!['database', 'host', 'port', 'schema'].includes(name)) {
    assert.throws(() => resolveDatasource({ DATABASE_URL: direct }, {}));
  }
});
test('exported primary wins over conflicting dotenv DIRECT_URL', () => {
  assert.equal(resolveDatasource({ DATABASE_URL: primary }, { DIRECT_URL: primary.replace('55435','55436') }), primary);
});
test('exported direct is explicit and wins over dotenv database', () => {
  assert.equal(resolveDatasource({ DIRECT_URL: primary }, { DATABASE_URL: primary.replace('55435','55436') }), primary);
});
test('rejects same-source mismatch for exported and dotenv connections', () => {
  const mismatch = { DATABASE_URL: primary, DIRECT_URL: primary.replace('55435','55436') };
  assert.throws(() => resolveDatasource(mismatch, {}));
  assert.throws(() => resolveDatasource({}, mismatch));
});
test('validates single dotenv URL and refuses blank settings', () => {
  assert.equal(resolveDatasource({}, { DATABASE_URL: primary }), primary);
  assert.throws(() => resolveDatasource({ DATABASE_URL: primary, DIRECT_URL: '' }, {}));
  assert.throws(() => resolveDatasource({}, {}));
});
