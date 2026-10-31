import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const schema = read('../../packages/database/prisma/schema.prisma');
const migration = read('../../packages/database/prisma/migrations/20261009163000_vehicle_generation_family/migration.sql');
const checkSql = read('../../packages/database/prisma/tests/vehicle-generation-family-contract.sql');
const smokeSql = read('../../packages/database/prisma/tests/vehicle-generation-family-cross-model.sql');

describe('generation family schema foundation: additive, fail closed', () => {
  it('adds a model-scoped draft family master and nullable composite FK', () => {
    assert.match(schema, /model VehicleGenerationFamily \{/);
    assert.match(schema, /@@unique\(\[modelId, code\]\)/);
    assert.match(schema, /@@unique\(\[id, modelId\]\)/);
    assert.match(schema, /familyId\s+String\?\s+@map\("family_id"\)/);
    assert.match(schema, /@relation\(fields: \[familyId, modelId\], references: \[id, modelId\], onDelete: Restrict, onUpdate: Restrict\)/);
    assert.match(migration, /ADD COLUMN "family_id" UUID;/);
    assert.match(migration, /FOREIGN KEY \("family_id", "model_id"\)\s+REFERENCES "vehicle_generation_families"\("id", "model_id"\)/);
    assert.match(migration, /DEFAULT 'DRAFT'/);
    assert.match(migration, /DEFAULT 'UNKNOWN'/);
    assert.match(migration, /vehicle_generation_families_year_order_chk/);
    assert.match(migration, /vehicle_generation_families_end_status_year_chk/);
    assert.match(smokeSql, /Generation Family accepted a reversed year range/);
    assert.match(checkSql, /Cross-model family links must be rejected/);
    assert.match(smokeSql, /FOREIGN KEY|foreign_key_violation/);
    assert.match(smokeSql, /violated_constraint <> 'vehicle_generations_family_id_model_id_fkey'/);
    assert.match(smokeSql, /Same-model Generation Family link was not accepted/);
    assert.match(smokeSql, /Cross-model Generation Family link was wrongly accepted/);
    assert.match(smokeSql, /\bBEGIN;/);
    assert.match(smokeSql, /\bROLLBACK;/);
    assert.match(smokeSql, /Refusing family FK test outside disposable test\/staging\/ci DB/);
  });

  it('contains no destructive or implicit data migration', () => {
    const statements = migration.replace(/--[^\n]*/g, '');
    assert.doesNotMatch(statements, /\b(?:DELETE FROM|DROP (?:TABLE|COLUMN|INDEX)|TRUNCATE|INSERT INTO|UPDATE\s+"?vehicle_|SET\s+"?status"?\s*=)\b/i);
    // CURRENT may occur in a CHECK constraint, but not as a new family default.
    assert.doesNotMatch(statements, /\bDEFAULT\s+'CURRENT'/i);
    // Important existing identities/links still live on the same generation table.
    assert.match(schema, /derivativeId\s+String\?\s+@map\("derivative_id"\)/);
    assert.match(schema, /trims\s+VehicleTrim\[\]/);
    assert.match(schema, /configurations\s+VehicleConfiguration\[\]/);
  });
});

const fixture = () => ({
  families: [
    { id: 'family-a', modelId: 'model-a', code: 'FAMILY', status: 'DRAFT' },
    { id: 'family-b', modelId: 'model-b', code: 'FAMILY', status: 'DRAFT' },
  ],
  generations: [
    { id: 'gen-a1', modelId: 'model-a', derivativeId: 'body-a', familyId: null },
    { id: 'gen-a2', modelId: 'model-a', derivativeId: null, familyId: null },
    { id: 'gen-b1', modelId: 'model-b', derivativeId: null, familyId: null },
  ],
  trims: [
    { id: 'trim-a1', generationId: 'gen-a1' },
    { id: 'trim-a2', generationId: 'gen-a2' },
  ],
  configurations: [
    { id: 'vehicle-a1', code: 'IMMUTABLE-001', generationId: 'gen-a1', trimId: 'trim-a1', status: 'DRAFT' },
    { id: 'vehicle-a2', code: 'IMMUTABLE-002', generationId: 'gen-a2', trimId: 'trim-a2', status: 'ACTIVE' },
  ],
  fitments: [
    { id: 'fitment-1', productId: 'product-1', vehicleConfigurationId: 'vehicle-a1' },
    { id: 'fitment-2', productId: 'product-1', vehicleConfigurationId: 'vehicle-a2' },
  ],
});

// A test-only model of the migration's nullable composite FK. These checks
// exercise synthetic relationships, not a live database or an application API.
// The unchanged migration contract tests bind this rule to the actual DDL.
const assignFamily = (data, generationId, familyId) => {
  const generation = data.generations.find((row) => row.id === generationId);
  if (!generation) throw new Error('Unknown generation');
  if (familyId !== null && !data.families.some(
    (family) => family.id === familyId && family.modelId === generation.modelId,
  )) throw new Error('Generation Family composite FK violation');
  generation.familyId = familyId;
};

describe('Generation Family self-contained synthetic relationships', () => {
  it('keeps family optional, including generations without a Body Line', () => {
    const data = fixture();
    const before = structuredClone(data);
    for (const generation of data.generations) {
      assignFamily(data, generation.id, null);
    }
    assert.deepEqual(data, before);
    assignFamily(data, 'gen-a2', 'family-a');
    assignFamily(data, 'gen-a2', null);
    assert.deepEqual(data, before);
  });

  it('links multiple distinct generations to one model-scoped family', () => {
    const data = fixture();
    const before = structuredClone(data);
    assignFamily(data, 'gen-a1', 'family-a');
    assignFamily(data, 'gen-a2', 'family-a');
    assert.deepEqual(data.generations, before.generations.map((generation) => ({
      ...generation,
      familyId: generation.modelId === 'model-a' ? 'family-a' : null,
    })));
    assert.equal(new Set(data.generations.map((row) => row.id)).size, 3);
    assert.deepEqual(data.families, before.families);
  });

  it('rejects another model or a missing family without changing valid links', () => {
    const data = fixture();
    assignFamily(data, 'gen-a1', 'family-a');
    const before = structuredClone(data);
    // Identical family codes across models must not permit cross-model linking.
    assert.throws(() => assignFamily(data, 'gen-a1', 'family-b'), /composite FK/);
    assert.deepEqual(data, before);
    assert.throws(() => assignFamily(data, 'gen-b1', 'family-a'), /composite FK/);
    assert.deepEqual(data, before);
    assert.throws(() => assignFamily(data, 'gen-a2', 'missing'), /composite FK/);
    assert.deepEqual(data, before);
  });

  it('preserves configured-vehicle identities, lifecycle and fitment references', () => {
    const data = fixture();
    const before = structuredClone(data);
    assignFamily(data, 'gen-a1', 'family-a');
    assignFamily(data, 'gen-a2', 'family-a');
    assert.deepEqual(data.configurations, before.configurations);
    assert.deepEqual(data.trims, before.trims);
    assert.deepEqual(data.fitments, before.fitments);
    for (const fitment of data.fitments) {
      const configuration = data.configurations.find((row) => row.id === fitment.vehicleConfigurationId);
      assert.ok(configuration);
      const trim = data.trims.find((row) => row.id === configuration.trimId);
      assert.ok(trim);
      assert.equal(trim.generationId, configuration.generationId);
      assert.ok(data.generations.some((row) => row.id === configuration.generationId));
    }
    // Only the explicitly selected family links may differ anywhere in the graph.
    for (const generation of data.generations) assignFamily(data, generation.id, null);
    assert.deepEqual(data, before);
  });
});
