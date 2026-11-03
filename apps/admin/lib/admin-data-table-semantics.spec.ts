import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const semanticTableFiles = [
  {
    path: '../components/categories-management.tsx',
    tables: 1,
    columns: 5,
  },
  {
    path: '../components/part-groups-management.tsx',
    tables: 1,
    columns: 5,
  },
  {
    path: '../components/brands-management.tsx',
    tables: 1,
    columns: 4,
  },
  {
    path: '../components/supplier-master-management.tsx',
    tables: 1,
    columns: 5,
  },
  {
    path: '../components/sellers-management.tsx',
    tables: 1,
    columns: 7,
  },
  {
    path: '../components/product-types-management.tsx',
    tables: 1,
    columns: 7,
  },
  {
    path: '../components/vehicles-management.tsx',
    tables: 2,
    columns: 9,
  },
  {
    path: '../components/vehicle-master-configuration-management.tsx',
    tables: 2,
    columns: 12,
  },
  {
    path: '../components/admin-accounts-management.tsx',
    tables: 1,
    columns: 5,
  },
  {
    path: '../components/audit-history-management.tsx',
    tables: 1,
    columns: 5,
  },
] as const;

describe('Admin data-table semantics', () => {
  it.each(semanticTableFiles)(
    'keeps complete semantic table structure in $path',
    ({ path, tables, columns }) => {
      const source = read(path);

      expect(count(source, 'role="table"')).toBe(tables);
      expect(count(source, 'role="columnheader"')).toBe(columns);
      expect(count(source, 'role="cell"')).toBe(columns);
      expect(count(source, 'role="row"')).toBe(tables * 2);
      expect(count(source, 'aria-label=')).toBeGreaterThanOrEqual(tables);

      const hiddenSemanticHeader =
        /className="[^"]*(?:row--header|table__row--header)[^"]*"[\s\S]{0,220}?aria-hidden="true"/u;
      expect(source).not.toMatch(hiddenSemanticHeader);
    },
  );

  it('keeps native interactive controls inside semantic cells instead of replacing their roles', () => {
    const vehicleSource = read('../components/vehicles-management.tsx');
    const supplierSource = read('../components/supplier-master-management.tsx');
    const sellerSource = read('../components/sellers-management.tsx');
    const auditSource = read('../components/audit-history-management.tsx');

    expect(vehicleSource).not.toContain('onEdit');
    expect(vehicleSource).toContain(
      '<span role="cell">\n            <a',
    );
    expect(supplierSource).toContain(
      'className="supplier-master-table__actions" role="cell"',
    );
    expect(sellerSource).toContain(
      'className="seller-governance-table__actions" role="cell"',
    );
    expect(auditSource).toContain(
      '<div role="cell">\n                <details',
    );
    expect(auditSource).not.toContain(
      'className="audit-history-row__metadata" role="cell"',
    );
  });

  it('keeps entity-specific Audit History as a list, not a fake table', () => {
    const source = read('../components/audit-history-management.tsx');

    expect(source).toContain(
      'role="list" aria-label="Entity audit events"',
    );
    expect(source).toContain(
      '<article className="audit-history-row" role="listitem"',
    );
  });
});

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}
