// Requires current-main migrations, vehicle-reconstruction-before.sql and an API build.
// Synthetic fixtures only. Never point this at the original development database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../apps/api/dist/database/database.service.js';
import { GenerationFamilyService } from '../../apps/api/dist/vehicle/generation-family.service.js';
import { MasterDataLifecycleService } from '../../apps/api/dist/master-data-lifecycle/master-data-lifecycle.service.js';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.hostname, '127.0.0.1');
assert.notEqual(url.port || '5432', '5432');
assert.match(url.pathname, /_test$/);
const db = new DatabaseService();
const families = new GenerationFamilyService(db);
const lifecycle = new MasterDataLifecycleService(db);
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const modelId = '22222222-2222-4222-8222-222222222222';
const generationId = '66666666-6666-4666-8666-666666666666';
const configId = '44444444-4444-4444-8444-444444444444';
const type = 'VEHICLE_GENERATION_FAMILY';
const check = async (promise, code) => assert.rejects(promise, (error) => error.response?.code === code);

try {
  await db.$connect();
  assert.equal(await db.vehicleGenerationFamily.count(), 0, 'Use a fresh disposable fixture database');
  await db.user.update({ where: { id: actor }, data: { status: 'ACTIVE', name: 'Disposable Admin' } });
  const reviewer = await db.user.create({ data: { accountType: 'ADMIN', status: 'ACTIVE', name: 'Disposable Reviewer' } });
  const make = await db.vehicleMake.create({ data: { code: 'OTHER_MAKE', name: 'Other Synthetic Make', status: 'ACTIVE', createdById: actor, updatedById: actor } });
  const otherModel = await db.vehicleModel.create({ data: { makeId: make.id, code: 'OTHER_MODEL', name: 'Other Model', status: 'ACTIVE', createdById: actor, updatedById: actor } });
  const otherGen = await db.vehicleGeneration.create({ data: { modelId: otherModel.id, name: 'Other Generation', status: 'ACTIVE', createdById: actor, updatedById: actor } });
  const gen2 = await db.vehicleGeneration.create({ data: { modelId, name: 'Second manual Generation', status: 'ACTIVE', createdById: actor, updatedById: actor } });
  const cat = await db.category.create({ data: { code: 'FAMILY_TEST', name: 'Synthetic fitment fixture', slug: 'family-test', level: 0, createdById: actor, updatedById: actor } });
  const productType = await db.productType.create({ data: { categoryId: cat.id, code: 'FAMILY_TEST', name: 'Synthetic fixture', slug: 'family-test', createdById: actor, updatedById: actor } });
  const schema = await db.productTypeSchemaVersion.create({ data: { productTypeId: productType.id, schemaVersion: 1, schemaHash: '0'.repeat(64), snapshot: {}, publishedById: actor } });
  const product = await db.product.create({ data: { categoryId: cat.id, productTypeId: productType.id, schemaVersionId: schema.id, name: 'Synthetic preservation fixture', createdById: actor, updatedById: actor } });
  const fitment = await db.vehicleCompatibility.create({ data: { productId: product.id, vehicleConfigurationId: configId, generationId, fitmentType: 'EXACT', source: 'ADMIN', createdById: actor, updatedById: actor } });
  const beforeConfig = await db.vehicleConfiguration.findUniqueOrThrow({ where: { id: configId } });
  const beforeFitment = await db.vehicleCompatibility.findUniqueOrThrow({ where: { id: fitment.id } });
  let family = await families.create({ modelId, name: 'Documented synthetic family' }, actor);
  assert.equal(family.startYear, null);
  assert.equal(family.endStatus, 'UNKNOWN');
  await check(families.setMembers(family.id, { version: family.version, generationIds: [otherGen.id] }, actor), 'GENERATION_FAMILY_INVALID_MEMBERS');
  family = await families.setMembers(family.id, { version: family.version, generationIds: [generationId, gen2.id] }, actor);
  assert.equal(family.linkedCount, 2);
  await check(families.setMembers(family.id, { version: family.version, generationIds: [otherGen.id] }, actor), 'GENERATION_FAMILY_INVALID_MEMBERS');
  await check(families.setMembers(family.id, { version: family.version, generationIds: ['00000000-0000-4000-8000-000000000001'] }, actor), 'GENERATION_FAMILY_INVALID_MEMBERS');
  await check(families.update(family.id, { version: 1, name: 'Stale edit' }, actor), 'GENERATION_FAMILY_VERSION_CONFLICT');
  await check(families.activate(family.id, family.version, actor), 'GENERATION_FAMILY_NOT_READY');
  const evidence = await families.addEvidence(family.id, { sourceName: 'Synthetic OEM document', sourceReference: 'TEST-ONLY-001' }, actor);
  const source = evidence.evidence[0];
  await check(families.reviewEvidence(family.id, source.id, { version: 1, familyVersion: family.version, decision: 'VERIFIED' }, actor), 'GENERATION_FAMILY_SELF_REVIEW_BLOCKED');
  await families.reviewEvidence(family.id, source.id, { version: 1, familyVersion: family.version, decision: 'VERIFIED' }, reviewer.id);
  const inspectedFamilyVersion = family.version;
  family = await families.update(family.id, { version: family.version, name: 'Corrected documented synthetic family' }, actor);
  let refreshedSource = (await families.get(family.id)).evidence[0];
  assert.equal(refreshedSource.verificationState, 'UNVERIFIED');
  await check(families.reviewEvidence(family.id, source.id, { version: refreshedSource.version, familyVersion: inspectedFamilyVersion, decision: 'VERIFIED' }, reviewer.id), 'GENERATION_FAMILY_VERSION_CONFLICT');
  await check(families.activate(family.id, family.version, actor), 'GENERATION_FAMILY_NOT_READY');
  await check(families.reviewEvidence(family.id, source.id, { version: 2, familyVersion: family.version, decision: 'VERIFIED' }, reviewer.id), 'GENERATION_FAMILY_VERSION_CONFLICT');
  await families.reviewEvidence(family.id, source.id, { version: refreshedSource.version, familyVersion: family.version, decision: 'VERIFIED' }, reviewer.id);
  family = await families.setMembers(family.id, { version: family.version, generationIds: [generationId] }, actor);
  assert.equal(family.evidence[0].verificationState, 'UNVERIFIED');
  family = await families.setMembers(family.id, { version: family.version, generationIds: [generationId, gen2.id] }, actor);
  refreshedSource = family.evidence[0];
  await check(families.activate(family.id, family.version, actor), 'GENERATION_FAMILY_NOT_READY');
  await families.reviewEvidence(family.id, source.id, { version: refreshedSource.version, familyVersion: family.version, decision: 'VERIFIED' }, reviewer.id);
  family = await families.activate(family.id, family.version, reviewer.id);
  assert.equal(family.status, 'ACTIVE');
  await check(lifecycle.transition('VEHICLE', type, family.id, { version: family.version, targetStatus: 'ARCHIVED' }, actor), 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES');
  const retired = await lifecycle.transition('VEHICLE', type, family.id, { version: family.version, targetStatus: 'DEPRECATED' }, actor);
  family = await families.activate(family.id, retired.version, reviewer.id);
  assert.equal(family.status, 'ACTIVE');
  const unused = await families.create({ modelId, name: 'Unused Draft lifecycle test' }, actor);
  assert.equal((await lifecycle.removalPreflight('VEHICLE', type, unused.id)).canPermanentlyDelete, true);
  await lifecycle.permanentDelete('VEHICLE', type, unused.id, { version: 1, reason: 'Disposable integration test cleanup' }, actor);
  assert.equal(await db.vehicleGenerationFamily.findUnique({ where: { id: unused.id } }), null);
  const concurrent = await families.create({ modelId, name: 'Concurrent edit test' }, actor);
  const outcomes = await Promise.allSettled([
    families.update(concurrent.id, { version: 1, name: 'Concurrent A' }, actor),
    families.update(concurrent.id, { version: 1, name: 'Concurrent B' }, reviewer.id),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1);
  assert.deepEqual(await db.vehicleConfiguration.findUniqueOrThrow({ where: { id: configId } }), beforeConfig);
  assert.deepEqual(await db.vehicleCompatibility.findUniqueOrThrow({ where: { id: fitment.id } }), beforeFitment);
  assert.equal((await families.listPage({ makeId: make.id, page: 1, pageSize: 50 })).total, 0);
  const foreignReplacement = await db.vehicleGenerationFamily.create({ data: { modelId: otherModel.id, code: 'OTHER_REPLACEMENT_TEST', name: 'Other-model replacement test', status: 'ACTIVE', createdById: actor, updatedById: actor } });
  await check(lifecycle.transition('VEHICLE', type, family.id, { version: family.version, targetStatus: 'SUPERSEDED', supersededById: foreignReplacement.id }, actor), 'GENERATION_FAMILY_SUPERSESSION_MODEL_MISMATCH');
  assert.equal((await families.get(family.id)).status, 'ACTIVE');
  await db.vehicleGenerationFamily.delete({ where: { id: foreignReplacement.id } }); // Only the synthetic, unreferenced replacement fixture.
  assert.ok(await db.auditLog.count({ where: { entityType: 'VehicleGenerationFamily', entityId: family.id } }) >= 5);
  // Optional synthetic sessions for local browser acceptance. No real account/credential is used.
  if (process.env.FAMILY_UI_TEST_SESSIONS === '1') {
    const role = await db.role.create({ data: { key: 'FAMILY_UI_TEST', name: 'Disposable Family operator' } });
    for (const key of ['vehicle.manage', 'admin.portal.access', 'admin.audit.read']) {
      const permission = await db.permission.upsert({ where: { key }, update: {}, create: { key } });
      await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
    for (const userId of [actor, reviewer.id]) await db.userRole.create({ data: { userId, roleId: role.id } });
    for (const [userId, label] of [[actor, 'operator'], [reviewer.id, 'reviewer']]) {
      const token = `disposable-family-ui-${label}-`.padEnd(64, 'x');
      await db.session.create({ data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7200000), mfaVerifiedAt: new Date() } });
    }
  }
  console.log('PASS: same-model multi-selection, cross-model/missing/stale rejection, independent evidence invalidated by metadata/membership changes, stale review rejection, activation with optional years, retire/reactivate, cross-model supersession rejection, deletion preflight, real concurrent write conflict, audit, configured-vehicle and fitment preservation.');
} finally { await db.$disconnect(); }
