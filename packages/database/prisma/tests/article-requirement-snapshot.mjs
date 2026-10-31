import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const migration = readFileSync(new URL('../migrations/20261014080000_product_article_requirement_snapshots/migration.sql', import.meta.url), 'utf8');
const modern = { articleRequirements: { brand: 'REQUIRED', identifier: 'OPTIONAL', image: 'NOT_APPLICABLE', minimumImageCount: 0, fitment: 'OPTIONAL' }, offerRequirements: { warranty: 'REQUIRED' } };

/** Run only against an isolated test connection. Every fixture owns a fresh schema. */
export async function runArticlePolicyChecks(db) {
  let checks = 0;
  async function scenario(snapshot, run) {
    const schema = `article_policy_test_${randomUUID().replaceAll('-', '')}`;
    await db.execute(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TYPE "ProductTypeRequirementLevel" AS ENUM ('REQUIRED','OPTIONAL','NOT_APPLICABLE');
      CREATE TYPE "ProductTypeIdentifierRequirement" AS ENUM ('MANUFACTURER_PART_NUMBER','ANY_PART_NUMBER','OPTIONAL','NOT_APPLICABLE');
      CREATE TABLE product_type_schema_versions(id TEXT PRIMARY KEY, product_type_id TEXT, snapshot JSONB, published_at TIMESTAMPTZ);
      CREATE TABLE products(id TEXT PRIMARY KEY, product_type_id TEXT, schema_version_id TEXT, name TEXT);
      CREATE TABLE product_types(id TEXT PRIMARY KEY, brand_requirement TEXT);
      INSERT INTO product_types VALUES ('type','OPTIONAL');`);
    try {
      await db.query(`INSERT INTO product_type_schema_versions VALUES ('old','type',$1::jsonb,now())`, [JSON.stringify(snapshot)]);
      await db.execute(`INSERT INTO products VALUES ('article','type','old','Original Article');`);
      await run();
      checks++;
    } finally {
      await db.execute(`ROLLBACK; SET search_path TO public; DROP SCHEMA ${schema} CASCADE;`);
    }
  }
  await scenario(modern, async () => {
    await db.execute(migration);
    const row = (await db.query('SELECT * FROM products')).rows[0];
    assert.equal(row.brand_requirement, 'REQUIRED'); // Mutable Product Type differs.
    assert.equal(row.warranty_requirement, 'REQUIRED');
    assert.equal(row.minimum_image_count, 0);
    await db.query(`INSERT INTO product_type_schema_versions VALUES ('new','type',$1::jsonb,now())`, [JSON.stringify({ articleRequirements: { brand: 'OPTIONAL' } })]);
    await db.execute(`UPDATE product_types SET brand_requirement='OPTIONAL'; UPDATE products SET name='Edited Article';`);
    assert.equal((await db.query('SELECT brand_requirement FROM products')).rows[0].brand_requirement, 'REQUIRED');
    for (const change of ["brand_requirement='OPTIONAL'", "schema_version_id='new'", "product_type_id='different'", "minimum_image_count=2"]) {
      await assert.rejects(db.execute(`UPDATE products SET ${change}`), /immutable/);
    }
    // An old API that omits new fields still receives the exact bound policy.
    await db.execute(`INSERT INTO products(id,product_type_id,schema_version_id,name) VALUES ('second','type','old','Second');`);
    assert.equal((await db.query("SELECT brand_requirement FROM products WHERE id='second'")).rows[0].brand_requirement, 'REQUIRED');
    await assert.rejects(db.execute(`INSERT INTO products(id,product_type_id,schema_version_id,name) VALUES ('bad','different','old','Bad');`));
  });
  await scenario({ requirements: { oemReference: 'REQUIRED', minimumImageCount: 2.0 } }, async () => {
    await db.execute(migration);
    const row = (await db.query('SELECT * FROM products')).rows[0];
    assert.equal(row.oem_reference_requirement, 'REQUIRED');
    assert.equal(row.minimum_image_count, 2);
    assert.equal(row.identifier_requirement, 'ANY_PART_NUMBER');
  });
  for (const malformed of [null, { articleRequirements: [] }, { offerRequirements: null }, { articleRequirements: { brand: 'UNKNOWN' } }, { articleRequirements: { minimumImageCount: -1 } }, { articleRequirements: { minimumImageCount: 21 } }, { articleRequirements: { minimumImageCount: 1.5 } }, { articleRequirements: { minimumImageCount: '2' } }]) {
    await scenario(malformed, async () => {
      await assert.rejects(db.execute(migration));
      await db.execute('ROLLBACK');
      assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='products' AND column_name='brand_requirement'")).rows[0].n, 0);
      assert.equal((await db.query('SELECT name FROM products')).rows[0].name, 'Original Article');
    });
  }
  for (const invalidBinding of ["UPDATE products SET schema_version_id='missing'", "UPDATE products SET product_type_id='different'", 'UPDATE product_type_schema_versions SET published_at=NULL']) {
    await scenario(modern, async () => {
      await db.execute(invalidBinding);
      await assert.rejects(db.execute(migration));
      await db.execute('ROLLBACK');
      assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='products' AND column_name='brand_requirement'")).rows[0].n, 0);
    });
  }
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.ARTICLE_POLICY_TEST_DATABASE_URL;
  if (!url) throw new Error('Set ARTICLE_POLICY_TEST_DATABASE_URL to an isolated PostgreSQL test database.');
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const count = await runArticlePolicyChecks({ execute: sql => client.query(sql), query: (sql, params) => client.query(sql, params) });
    console.log(`PASS: ${count} isolated Article snapshot migration scenarios`);
  } finally { await client.end(); }
}
