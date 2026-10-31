import { describe, expect, it } from 'vitest';
import {
  adminWorkspaceSection,
  adminWorkspaceTitle,
  safeAdminReturnTo,
} from './navigation';

describe('Admin return path', () => {
  it('allows an internal Admin path', () => {
    expect(safeAdminReturnTo('/admin/catalog?page=2')).toBe(
      '/admin/catalog?page=2',
    );
  });

  it('defaults missing paths to the overview', () => {
    expect(safeAdminReturnTo()).toBe('/admin');
  });

  it('blocks protocol-relative redirects', () => {
    expect(safeAdminReturnTo('//attacker.example/admin')).toBe('/admin');
  });

  it('blocks non-Admin paths', () => {
    expect(safeAdminReturnTo('/login')).toBe('/admin');
  });

  it.each([
    ['/admin/vehicles', '/admin/vehicles/makes'],
    ['/admin/sourcing/offers?page=2', '/admin/sourcing/suppliers?page=2'],
    [
      '/admin/marketplace/listings#review',
      '/admin/marketplace/sellers#review',
    ],
    [
      '/admin/catalog/product-structure',
      '/admin/catalog/part-groups',
    ],
    [
      '/admin/catalog/workspace?categoryId=cat-1',
      '/admin/catalog/product-types?categoryId=cat-1',
    ],
    [
      '/admin/catalog/products/old-id/assets?tab=images',
      '/admin/catalog/product-types?tab=images',
    ],
    [
      '/admin/catalog/product-types/new?categoryId=cat-1#definition',
      '/admin/catalog/product-types?categoryId=cat-1&create=1#definition',
    ],
    [
      '/admin/catalog/product-types/pt-1/edit',
      '/admin/catalog/product-types?productTypeId=pt-1',
    ],
    [
      '/admin/catalog/product-types/pt-1/attributes?focus=technical',
      '/admin/catalog/product-types?focus=technical&productTypeId=pt-1',
    ],
  ])('canonicalizes compatibility-only Admin route %s', (path, expected) => {
    expect(safeAdminReturnTo(path)).toBe(expected);
  });

  it.each([
    '/admin/sourcing/offers-old',
    '/admin/marketplace/listings-archive',
    '/admin/catalog/products-v2',
    '/admin/catalog/workspace-tools',
  ])('does not rewrite a route lookalike %s', (path) => {
    expect(safeAdminReturnTo(path)).toBe(path);
  });

  it.each([
    '/administrator',
    '/admin/../../login',
    '/admin\\..\\login',
    'https://attacker.example/admin',
  ])('rejects misleading return path %s', (path) => {
    expect(safeAdminReturnTo(path)).toBe('/admin');
  });
});


describe('Admin workspace title', () => {
  it.each([
    ['/admin', 'Platform overview'],
    ['/admin/imports', 'Imports & Jobs'],
    ['/admin/catalog/categories', 'Categories'],
    ['/admin/catalog/workspace', 'Product Types'],
    ['/admin/catalog/product-types', 'Product Types'],
    ['/admin/catalog/product-types/new', 'Create Product Type'],
    ['/admin/catalog/part-groups', 'Part Groups'],
    ['/admin/catalog/product-types/abc/edit', 'Edit Product Type'],
    ['/admin/catalog/product-types/abc/attributes', 'Product Type schema'],
    ['/admin/catalog/products', 'Product Types'],
    ['/admin/catalog/products/new', 'Product Types'],
    ['/admin/catalog/products/abc/identity', 'Product Types'],
    ['/admin/catalog/products/abc/assets', 'Product Types'],
    ['/admin/catalog/products/abc/compatibility', 'Product Types'],
    ['/admin/catalog/attributes', 'Attribute Library'],
    ['/admin/vehicles/makes', 'Vehicle makes'],
    ['/admin/vehicles/models', 'Vehicle models'],
    ['/admin/vehicles/configurations', 'Configured Vehicles Library'],
    [
      '/admin/vehicles/configurations/masters',
      'Advanced Vehicle Master Libraries',
    ],
    ['/admin/sourcing/offers', 'Supplier Master'],
    ['/admin/sourcing/suppliers', 'Supplier Master'],
    ['/admin/marketplace/sellers', 'Seller governance'],
    ['/admin/marketplace/listings', 'Seller governance'],
    ['/admin/accounts', 'Admin accounts'],
    ['/admin/audit', 'Audit History'],
  ])('maps %s to %s', (pathname, title) => {
    expect(adminWorkspaceTitle(pathname)).toBe(title);
  });
});


describe('Admin workspace section', () => {
  it.each([
    ['/admin', 'Overview'],
    ['/admin/imports', 'Operations'],
    ['/admin/catalog/product-types', 'Catalog'],
    ['/admin/catalog/attributes', 'Catalog'],
    ['/admin/vehicles/configurations', 'Vehicles'],
    ['/admin/sourcing/suppliers', 'Sourcing'],
    ['/admin/marketplace/sellers', 'Marketplace'],
    ['/admin/accounts', 'Administration'],
    ['/admin/audit', 'Administration'],
  ])('maps %s to %s without repeating the page title', (pathname, section) => {
    expect(adminWorkspaceSection(pathname)).toBe(section);
  });
});
