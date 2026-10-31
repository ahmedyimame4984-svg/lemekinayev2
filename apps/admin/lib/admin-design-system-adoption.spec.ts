import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const statusPrimitiveFiles = [
  '../components/categories-management.tsx',
  '../components/part-groups-management.tsx',
  '../components/product-types-management.tsx',
  '../components/attribute-master-management.tsx',
  '../components/brands-management.tsx',
  '../components/criteria-template-management.tsx',
  '../components/supplier-master-management.tsx',
  '../components/sellers-management.tsx',
  '../components/vehicles-management.tsx',
  '../components/vehicle-master-configuration-management.tsx',
  '../components/admin-accounts-management.tsx',
] as const;

const statePrimitiveFiles = [
  '../components/categories-management.tsx',
  '../components/part-groups-management.tsx',
  '../components/product-types-management.tsx',
  '../components/brands-management.tsx',
  '../components/supplier-master-management.tsx',
  '../components/sellers-management.tsx',
  '../components/vehicles-management.tsx',
  '../components/vehicle-master-configuration-management.tsx',
  '../components/admin-accounts-management.tsx',
] as const;

describe('Admin design-system primitive adoption', () => {
  it.each(statusPrimitiveFiles)(
    '%s uses the shared canonical status badge',
    (relativePath) => {
      const source = read(relativePath);
      expect(source).toContain('<AdminStatusBadge');
      expect(source).not.toMatch(/function\s+(?:statusTone|statusClass)\s*\(/u);
      expect(source).not.toContain('category-status category-status--');
    },
  );

  it.each(statePrimitiveFiles)(
    '%s uses shared loading and empty states',
    (relativePath) => {
      const source = read(relativePath);
      expect(source).toContain('<AdminLoadingState');
      expect(source).toContain('<AdminEmptyState');
    },
  );
});

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
