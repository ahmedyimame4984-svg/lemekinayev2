import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  requestAdminApi: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
  })),
}));

vi.mock('@/lib/server/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(
      readonly status: number,
      readonly retryAfter: string | null,
      readonly apiCode?: string,
      readonly apiMessage?: string,
    ) {
      super('Admin API request failed');
    }
  },
  requestAdminApi: mocks.requestAdminApi,
}));

import { AdminApiError } from '@/lib/server/admin-api';
import { GET as getCategories, POST as postCategory } from './categories/route';
import {
  GET as getCategory,
  PATCH as patchCategory,
} from './categories/[id]/route';
import { GET as getCategoriesPage } from './categories/page/route';
import { GET as getProductFamiliesPage } from './product-families/page/route';
import { GET as getProductTypes, POST as postProductType } from './product-types/route';
import {
  GET as getProductType,
  PATCH as patchProductType,
} from './product-types/[id]/route';
import { GET as getProductTypesPage } from './product-types/page/route';
import { GET as getProductTypeSummary } from './product-types/summary/route';
import { GET as exportProductTypes } from './product-types/export/route';
import { POST as previewProductTypeImport } from './product-types/import/preview/route';
import { POST as commitProductTypeImport } from './product-types/import/commit/route';
import { POST as prepareProductType } from './product-types/[id]/prepare/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const categoryId = '11111111-1111-4111-8111-111111111111';
const productTypeId = '22222222-2222-4222-8222-222222222222';
const productFamilyId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin core catalog BFF routes', () => {
  it('requires the Admin access cookie for core catalog reads', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const categoryResponse = await getCategories();
    const productTypeResponse = await getProductTypes(
      new Request(adminOrigin + '/api/admin/catalog/product-types'),
    );

    expect(categoryResponse.status).toBe(401);
    expect(productTypeResponse.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards scalable Category and Part Group hierarchy reads', async () => {
    mocks.requestAdminApi
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        pageSize: 50,
        pageCount: 0,
      })
      .mockResolvedValueOnce({
        id: categoryId,
        parentId: null,
        code: 'BRAKING',
        name: 'Braking',
        slug: 'braking',
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
        pageCount: 0,
      });

    await getCategoriesPage(
      new Request(
        adminOrigin +
          '/api/admin/catalog/categories/page?search=brake&status=ACTIVE&rootOnly=true&page=2&pageSize=50',
      ),
    );
    await getCategory(
      new Request(
        adminOrigin + '/api/admin/catalog/categories/' + categoryId,
      ),
      { params: Promise.resolve({ id: categoryId }) },
    );
    await getProductFamiliesPage(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-families/page?search=disc&categorySearch=brake&status=ACTIVE&page=1&pageSize=50',
      ),
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/categories/page?search=brake&status=ACTIVE&rootOnly=true&page=2&pageSize=50',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/categories/' + categoryId,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      '/admin/catalog/product-families/page?search=disc&status=ACTIVE&categorySearch=brake&page=1&pageSize=50',
      { accessToken: token },
    );
  });

  it('forwards same-origin Category creation', async () => {
    const body = {
      code: 'BRAKING',
      name: 'Braking',
      slug: 'braking',
      status: 'DRAFT',
    };
    mocks.requestAdminApi.mockResolvedValue({
      id: categoryId,
      parentId: null,
      ...body,
      description: null,
      sortOrder: 0,
      level: 0,
      isLeaf: true,
      version: 1,
    });

    const response = await postCategory(
      new Request(adminOrigin + '/api/admin/catalog/categories', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/categories',
      { method: 'POST', body, accessToken: token },
    );
  });

  it('forwards optimistic Category updates instead of creating duplicates', async () => {
    const body = { version: 2, name: 'Braking System', status: 'ACTIVE' };
    mocks.requestAdminApi.mockResolvedValue({
      id: categoryId,
      code: 'BRAKING',
      version: 3,
      name: body.name,
      status: body.status,
    });

    const response = await patchCategory(
      new Request(adminOrigin + '/api/admin/catalog/categories/' + categoryId, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: categoryId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/categories/' + categoryId,
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('forwards Product Type filters and same-origin creation', async () => {
    mocks.requestAdminApi.mockResolvedValueOnce([]);
    await getProductTypes(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-types?categoryId=' +
          categoryId +
          '&productFamilyId=' +
          productFamilyId +
          '&status=ACTIVE',
      ),
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/product-types?status=ACTIVE&categoryId=' +
        categoryId +
        '&productFamilyId=' +
        productFamilyId,
      { accessToken: token },
    );

    const body = {
      categoryId,
      code: 'BRAKE_PAD',
      name: 'Brake Pad',
      slug: 'brake-pad',
      status: 'DRAFT',
    };
    mocks.requestAdminApi.mockResolvedValueOnce({
      id: productTypeId,
      ...body,
      description: null,
      sortOrder: 0,
      version: 1,
      currentSchemaVersionId: null,
    });

    const response = await postProductType(
      new Request(adminOrigin + '/api/admin/catalog/product-types', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/product-types',
      { method: 'POST', body, accessToken: token },
    );
  });

  it('forwards scalable Product Type page, summary, and direct reads', async () => {
    mocks.requestAdminApi
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        pageSize: 50,
        pageCount: 0,
      })
      .mockResolvedValueOnce({
        total: 120,
        published: 82,
        draft: 14,
        needsPublication: 31,
      })
      .mockResolvedValueOnce({
        id: productTypeId,
        categoryId,
        productFamilyId,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
      });

    await getProductTypesPage(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-types/page?search=brake&status=ACTIVE&sortBy=NAME&sortDirection=DESC&page=2&pageSize=50',
      ),
    );
    await getProductTypeSummary();
    await getProductType(
      new Request(
        adminOrigin + '/api/admin/catalog/product-types/' + productTypeId,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/product-types/page?search=brake&status=ACTIVE&sortBy=NAME&sortDirection=DESC&page=2&pageSize=50',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/product-types/summary',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      '/admin/catalog/product-types/' + productTypeId,
      { accessToken: token },
    );
  });

  it('downloads filtered Product Type CSV exports', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      filename: 'lemekinaye-product-types.csv',
      csv: 'code,name\r\nBRAKE_PAD,Brake Pad\r\n',
    });

    const response = await exportProductTypes(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-types/export?search=brake&status=ACTIVE&categoryId=' +
          categoryId +
          '&productFamilyId=' +
          productFamilyId +
          '&sortBy=CODE&sortDirection=DESC',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain(
      'lemekinaye-product-types.csv',
    );
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/product-types/export?search=brake&status=ACTIVE&categoryId=' +
        categoryId +
        '&productFamilyId=' +
        productFamilyId +
        '&sortBy=CODE&sortDirection=DESC',
      { accessToken: token, timeoutMs: 20_000 },
    );
  });

  it('forwards same-origin Product Type CSV preview and commit', async () => {
    const body = {
      csv:
        'code,name,categoryCode,partGroupCode\n' +
        'BRAKE_PAD,Brake Pad,BRAKING,DISC_BRAKES\n',
    };
    mocks.requestAdminApi
      .mockResolvedValueOnce({
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        rows: [],
      })
      .mockResolvedValueOnce({
        createdCount: 1,
        createdCodes: ['BRAKE_PAD'],
      });

    const preview = await previewProductTypeImport(
      new Request(
        adminOrigin + '/api/admin/catalog/product-types/import/preview',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(body),
        },
      ),
    );
    expect(preview.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/product-types/import/preview',
      {
        method: 'POST',
        body,
        accessToken: token,
        timeoutMs: 20_000,
      },
    );

    const committed = await commitProductTypeImport(
      new Request(
        adminOrigin + '/api/admin/catalog/product-types/import/commit',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(body),
        },
      ),
    );
    expect(committed.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/product-types/import/commit',
      {
        method: 'POST',
        body,
        accessToken: token,
        timeoutMs: 30_000,
      },
    );
  });

  it('rejects cross-origin Product Type CSV preview before contacting the API', async () => {
    const response = await previewProductTypeImport(
      new Request(
        adminOrigin + '/api/admin/catalog/product-types/import/preview',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({
            csv: 'code,name,categoryCode,partGroupCode',
          }),
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards optimistic Product Type updates', async () => {
    const body = { version: 1, name: 'Front Brake Pad' };
    mocks.requestAdminApi.mockResolvedValue({
      id: productTypeId,
      categoryId,
      code: 'BRAKE_PAD',
      name: body.name,
      version: 2,
    });

    const response = await patchProductType(
      new Request(adminOrigin + '/api/admin/catalog/product-types/' + productTypeId, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/product-types/' + productTypeId,
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('prepares a new Product Type in one safe server-side workflow', async () => {
    const templateId = '44444444-4444-4444-8444-444444444444';
    const schemaId = '55555555-5555-4555-8555-555555555555';
    const created = {
      id: productTypeId,
      categoryId,
      productFamilyId,
      parentId: null,
      code: 'BRAKE_PAD',
      name: 'Brake Pad',
      slug: 'brake-pad',
      description: null,
      sortOrder: 0,
      status: 'DRAFT',
      version: 1,
      currentSchemaVersionId: null,
    };
    const active = { ...created, status: 'ACTIVE', version: 2 };

    mocks.requestAdminApi
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce([
        {
          id: templateId,
          productFamilyId,
          code: 'BRAKE_PAD_STANDARD',
          name: 'Brake Pad Standard Criteria',
          status: 'ACTIVE',
          itemCount: 12,
        },
      ])
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce({
        templateId,
        productTypeId,
        createdCount: 12,
        createdAssignmentIds: [],
        skippedAttributeIds: [],
      })
      .mockResolvedValueOnce({
        id: schemaId,
        productTypeId,
        schemaVersion: 1,
        schemaHash: 'a'.repeat(64),
        snapshot: { attributes: [{ code: 'ATTR_WIDTH' }] },
        publishedAt: '2026-10-04T18:00:00.000Z',
      });

    const response = await prepareProductType(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-types/' +
          productTypeId +
          '/prepare',
        {
          method: 'POST',
          headers: {
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: 'READY',
      productType: {
        id: productTypeId,
        status: 'ACTIVE',
        version: 3,
        currentSchemaVersionId: schemaId,
      },
      appliedTemplate: {
        id: templateId,
        createdCount: 12,
      },
      schema: { id: schemaId },
    });

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/product-types/' + productTypeId,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/criteria-templates?productTypeId=' +
        productTypeId +
        '&status=ACTIVE',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      '/admin/catalog/product-types/' + productTypeId,
      {
        method: 'PATCH',
        body: { version: 1, status: 'ACTIVE' },
        accessToken: token,
      },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      4,
      '/admin/catalog/product-types/' +
        productTypeId +
        '/criteria-templates/' +
        templateId +
        '/apply',
      {
        method: 'POST',
        body: { assignmentStatus: 'ACTIVE' },
        accessToken: token,
      },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      5,
      '/admin/catalog/product-types/' + productTypeId + '/schemas/publish',
      {
        method: 'POST',
        body: { productTypeVersion: 2 },
        accessToken: token,
      },
    );
  });

  it('leaves a Product Type in professional Criteria review when no safe Template exists', async () => {
    const created = {
      id: productTypeId,
      categoryId,
      productFamilyId,
      status: 'DRAFT',
      version: 1,
      currentSchemaVersionId: null,
    };
    mocks.requestAdminApi
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce([]);

    const response = await prepareProductType(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-types/' +
          productTypeId +
          '/prepare',
        {
          method: 'POST',
          headers: {
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: 'NEEDS_CRITERIA',
      candidates: [],
      productType: { id: productTypeId, status: 'DRAFT' },
    });
    expect(mocks.requestAdminApi).toHaveBeenCalledTimes(2);
  });

  it('does not guess when multiple governed Criteria Templates match', async () => {
    const created = {
      id: productTypeId,
      categoryId,
      productFamilyId,
      status: 'DRAFT',
      version: 1,
      currentSchemaVersionId: null,
    };
    mocks.requestAdminApi
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce([
        {
          id: '44444444-4444-4444-8444-444444444444',
          productFamilyId,
          code: 'BRAKE_A',
          name: 'Brake A',
          status: 'ACTIVE',
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          productFamilyId,
          code: 'BRAKE_B',
          name: 'Brake B',
          status: 'ACTIVE',
        },
      ]);

    const response = await prepareProductType(
      new Request(
        adminOrigin +
          '/api/admin/catalog/product-types/' +
          productTypeId +
          '/prepare',
        {
          method: 'POST',
          headers: {
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: 'NEEDS_CRITERIA',
      candidates: [
        { code: 'BRAKE_A' },
        { code: 'BRAKE_B' },
      ],
    });
    expect(mocks.requestAdminApi).toHaveBeenCalledTimes(2);
  });

  it('rejects cross-origin Product Type creation', async () => {
    const response = await postProductType(
      new Request(adminOrigin + '/api/admin/catalog/product-types', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({
          categoryId,
          code: 'BRAKE_PAD',
          name: 'Brake Pad',
          slug: 'brake-pad',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('maps Product Type category lifecycle conflicts to corrective guidance', async () => {
    mocks.requestAdminApi.mockRejectedValue(
      new AdminApiError(
        409,
        null,
        'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE',
        'An active product type requires an active category',
      ),
    );

    const response = await postProductType(
      new Request(adminOrigin + '/api/admin/catalog/product-types', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          categoryId,
          code: 'BRAKE_PAD',
          name: 'Brake Pad',
          slug: 'brake-pad',
          status: 'ACTIVE',
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE',
        message:
          'Activate the selected category first, or keep the Product Type in Draft.',
      },
    });
  });
});
