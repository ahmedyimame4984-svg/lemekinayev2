import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

import ProductsPage from '../app/admin/catalog/products/page';
import NewProductPage from '../app/admin/catalog/products/new/page';
import ProductIdentityPage from '../app/admin/catalog/products/[id]/identity/page';
import ProductAssetsPage from '../app/admin/catalog/products/[id]/assets/page';
import ProductCompatibilityPage from '../app/admin/catalog/products/[id]/compatibility/page';

beforeEach(() => {
  mocks.redirect.mockReset();
});

describe('Admin seller Product page boundary', () => {
  it.each([
    ['products', ProductsPage],
    ['new Product', NewProductPage],
    ['Product identity', ProductIdentityPage],
    ['Product assets', ProductAssetsPage],
    ['Product compatibility', ProductCompatibilityPage],
  ])('redirects legacy Admin %s page to Product Types', (_label, page) => {
    page();

    expect(mocks.redirect).toHaveBeenCalledWith('/admin/catalog/product-types');
  });
});
