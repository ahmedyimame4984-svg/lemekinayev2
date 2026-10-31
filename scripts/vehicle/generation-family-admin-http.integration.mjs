// Run after generation-family-admin.integration.mjs with FAMILY_UI_TEST_SESSIONS=1,
// and the isolated API listening on port 3107. Requires no real credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../apps/api/dist/database/database.service.js';
const database = new URL(process.env.DATABASE_URL ?? '');
assert.equal(database.hostname, '127.0.0.1');
assert.notEqual(database.port || '5432', '5432');
assert.match(database.pathname, /_test$/);
const db = new DatabaseService();
const base = 'http://127.0.0.1:3107/api/v1/admin/vehicles/generation-families';
const token = (label) => `disposable-family-ui-${label}-`.padEnd(64, 'x');
async function request(path, status, method = 'GET', body, credential = token('operator')) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(credential ? { authorization: `Bearer ${credential}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
try {
  await request('/page', 401, 'GET', undefined, null);
  const denied = await db.user.create({ data: { accountType: 'ADMIN', status: 'ACTIVE', name: 'Disposable no permission test' } });
  await db.session.create({ data: { userId: denied.id, tokenHash: createHash('sha256').update(token('denied')).digest('hex'), expiresAt: new Date(Date.now() + 3600000), mfaVerifiedAt: new Date() } });
  await request('/page', 403, 'GET', undefined, token('denied'));
  const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const modelId = '22222222-2222-4222-8222-222222222222';
  const otherModel = await db.vehicleModel.findFirstOrThrow({ where: { code: 'OTHER_MODEL' } });
  const otherGen = await db.vehicleGeneration.findFirstOrThrow({ where: { modelId: otherModel.id } });
  const family = await request('', 201, 'POST', { modelId, name: 'HTTP acceptance family' });
  await request(`/${family.id}/members`, 400, 'PATCH', { version: family.version, generationIds: [otherGen.id] });
  await request(`/${family.id}`, 400, 'PATCH', { version: family.version, status: 'ACTIVE' });
  await request(`/${family.id}/activate`, 409, 'POST', { version: family.version });
  const generationIds = [];
  for (const name of ['Browser selectable Generation A', 'Browser selectable Generation B']) {
    const generation = await db.vehicleGeneration.create({ data: { modelId, name, status: 'ACTIVE', createdById: actor, updatedById: actor } });
    generationIds.push(generation.id);
  }
  await request(`/${family.id}/members`, 400, 'PATCH', { version: family.version, generationIds: [generationIds[0], generationIds[0]] });
  const linked = await request(`/${family.id}/members`, 200, 'PATCH', { version: family.version, generationIds });
  assert.equal(linked.generations.length, 2);
  await request(`/${family.id}/members`, 409, 'PATCH', { version: family.version, generationIds: [] });
  // Explicit unlink leaves these two fixtures available for browser selection acceptance.
  await request(`/${family.id}/members`, 200, 'PATCH', { version: linked.version, generationIds: [] });
  const otherMake = await db.vehicleMake.findUniqueOrThrow({ where: { id: otherModel.makeId } });
  assert.equal((await request(`/page?makeId=${otherMake.id}`, 200)).total, 0);
  console.log('PASS: live HTTP 401/403, DTO whitelist, duplicate selection, cross-model rejection, activation gate, version conflicts, same-model explicit multi-link/unlink, Make filter.');
} finally { await db.$disconnect(); }
