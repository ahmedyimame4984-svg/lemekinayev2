import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CanonicalReferenceReadOnlyGuard } from './canonical-reference-readonly.guard.js';

describe('Canonical ownership enforcement', () => {
  const guard = new CanonicalReferenceReadOnlyGuard();

  function request(method: string, path: string) {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method, path }),
      }),
    } as unknown as ExecutionContext;

    return () => guard.canActivate(context);
  }

  const forbidden = [
    ['POST', '/api/v1/admin/catalog/product-types'],
    ['PATCH', '/api/v1/admin/catalog/product-types/abc'],
    ['POST', '/api/v1/admin/catalog/categories'],
    ['POST', '/api/v1/admin/catalog/product-families'],
    ['POST', '/api/v1/admin/catalog/attributes'],
    ['POST', '/api/v1/admin/catalog/product-types/import/commit'],
    ['POST', '/api/v1/admin/catalog/product-types/abc/schemas/publish'],
    ['POST', '/api/v1/admin/vehicles/makes'],
    ['POST', '/api/v1/admin/vehicles/models'],
    ['POST', '/api/v1/admin/vehicles/configurations'],
    ['PATCH', '/api/v1/admin/vehicles/configurations/abc'],
    ['POST', '/api/v1/admin/reference-data/replace'],
    ['PATCH', '/api/v1/admin/catalog/lifecycle/PRODUCT_TYPE/abc'],
  ];

  it.each(forbidden)(
    'blocks canonical mutation %s %s',
    (method, path) => {
      expect(request(method, path)).toThrow(
        ForbiddenException,
      );
    },
  );

  const permitted = [
    ['GET', '/api/v1/admin/catalog/product-types'],
    ['GET', '/api/v1/admin/vehicles/makes'],
    ['GET', '/api/v1/admin/vehicles/configurations/library'],
    ['PATCH', '/api/v1/admin/catalog/product-types/abc/marketplace-rules'],
    ['PATCH', '/api/v1/admin/catalog/product-types/abc/attributes/assignment'],
  ];

  it.each(permitted)(
    'permits reference read or local configuration %s %s',
    (method, path) => {
      expect(request(method, path)()).toBe(true);
    },
  );
});
