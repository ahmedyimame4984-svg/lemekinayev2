import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CanonicalReferenceReadOnlyGuard } from './canonical-reference-readonly.guard.js';

const guard = new CanonicalReferenceReadOnlyGuard();

function allowed(method: string, path: string): boolean {
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context);
}

describe('Autotechdoc-owned reference master read-only enforcement', () => {
  it.each([
    ['/api/v1/admin/catalog/product-types', 'POST'],
    ['/api/v1/admin/catalog/product-types/abc', 'PATCH'],
    ['/api/v1/admin/catalog/product-types/import/commit', 'POST'],
    ['/api/v1/admin/catalog/product-types/abc/schemas/publish', 'POST'],
    ['/api/v1/admin/catalog/categories', 'POST'],
    ['/api/v1/admin/catalog/product-families', 'POST'],
    ['/api/v1/admin/catalog/canonical-product-catalog/install', 'POST'],
    ['/api/v1/admin/catalog/professional-baseline/reconcile', 'POST'],
    ['/api/v1/admin/reference-data/replace', 'POST'],
    ['/api/v1/admin/catalog/attributes/abc', 'PATCH'],
    ['/api/v1/admin/catalog/lifecycle/PRODUCT_TYPE/abc', 'PATCH'],
    ['/api/v1/admin/catalog/lifecycle/PRODUCT_TYPE/abc/restore', 'POST'],
    ['/api/v1/admin/vehicles/models', 'POST'],
    ['/api/v1/admin/vehicles/makes/abc', 'PATCH'],
    ['/api/v1/admin/vehicles/generations', 'POST'],
    ['/api/v1/admin/vehicles/configurations/abc', 'PATCH'],
    ['/api/v1/admin/vehicles/lifecycle/VEHICLE_MODEL/abc', 'PATCH'],
  ])('rejects canonical write %s %s', (path, method) => {
    expect(() => allowed(method, path)).toThrow(ForbiddenException);
  });

  it.each([
    ['/api/v1/admin/catalog/product-types/abc', 'GET'],
    ['/api/v1/admin/vehicles/models', 'GET'],
    ['/api/v1/admin/catalog/product-types/abc/marketplace-rules', 'PATCH'],
    ['/api/v1/admin/catalog/product-types/abc/attributes/assignment', 'PATCH'],
    ['/api/v1/admin/catalog/product-types/abc/attributes', 'POST'],
    ['/api/v1/admin/catalog/lifecycle/CRITERIA_TEMPLATE/abc', 'PATCH'],
    ['/api/v1/admin/vehicles/identifiers/resolve', 'POST'],
  ])('retains allowed read or consumer-side write %s %s', (path, method) => {
    expect(allowed(method, path)).toBe(true);
  });
});
