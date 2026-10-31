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
  requestAdminApi: mocks.requestAdminApi,
}));

import { GET as getProducts, POST as postProduct } from './route';
import { POST as createArticle } from './create-article/route';
import { GET as getProduct, PATCH as patchProduct } from './[id]/route';
import { GET as getArticleRelations } from './[id]/relations/route';
import { GET as getArticleValidation } from './[id]/validation/route';
import { POST as postAsset } from './[id]/assets/route';
import { PATCH as patchAsset } from './[id]/assets/[assetId]/route';
import { POST as inspectArticleImport } from './import/file/inspect/route';
import { POST as previewArticleImport } from './import/file/preview/route';
import { POST as commitArticleImport } from './import/file/commit/route';
import { GET as getArticleImportJobs } from './import/jobs/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const categoryId = '11111111-1111-4111-8111-111111111111';
const productTypeId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin seller-owned Product BFF boundary', () => {
  it('keeps Product reads available for future moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getProducts(
      new Request(
        adminOrigin +
          '/api/admin/products?status=ACTIVE&categoryId=' +
          categoryId +
          '&productTypeId=' +
          productTypeId,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products?status=ACTIVE&categoryId=' +
        categoryId +
        '&productTypeId=' +
        productTypeId,
      { accessToken: token },
    );
  });

  it('keeps Product detail reads available for future moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: productId,
      name: 'Seller-created Brake Pad Set',
    });

    const response = await getProduct(
      new Request(adminOrigin + '/api/admin/products/' + productId),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/' + productId,
      { accessToken: token },
    );
  });

  it('keeps Article relations read-only and available for moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getArticleRelations(
      new Request(
        adminOrigin +
          '/api/admin/products/' +
          productId +
          '/relations?type=SUPERSEDES&status=ACTIVE',
      ),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/' +
        productId +
        '/relations?type=SUPERSEDES&status=ACTIVE',
      { accessToken: token },
    );
  });

  it('keeps Article readiness validation read-only and available for moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      articleId: productId,
      readyForActivation: false,
      issues: [{ code: 'ARTICLE_FITMENT_REQUIRED' }],
    });

    const response = await getArticleValidation(
      new Request(
        adminOrigin +
          '/api/admin/products/' +
          productId +
          '/validation',
      ),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/' + productId + '/validation',
      { accessToken: token },
    );
  });

  it('allows the explicit approved-catalog Article import BFF workflow', async () => {
    mocks.requestAdminApi
      .mockResolvedValueOnce({
        fileName: 'articles.csv',
        format: 'CSV',
        sheetName: null,
        headers: ['Name'],
        totalRows: 1,
      })
      .mockResolvedValueOnce({
        datasetReference: 'batch-1',
        fileName: 'articles.csv',
        format: 'CSV',
        sheetName: null,
        headers: ['Name'],
        totalRows: 1,
        includedRows: 1,
        excludedRows: 0,
        validRows: 1,
        invalidRows: 0,
        warningRows: 0,
        canCommit: true,
        previewFingerprint: 'a'.repeat(64),
        rows: [],
      })
      .mockResolvedValueOnce({
        jobId: 'abababab-abab-4aba-8aba-abababababab',
        datasetReference: 'batch-1',
        previewFingerprint: 'a'.repeat(64),
        createdCount: 1,
        excludedRows: 0,
        warningRows: 0,
        items: [],
      })
      .mockResolvedValueOnce([]);

    const sourceBody = {
      fileName: 'articles.csv',
      format: 'CSV',
      fileBase64: 'TmFtZQpQYWQK',
    };

    expect(
      (
        await inspectArticleImport(
          new Request(
            adminOrigin + '/api/admin/products/import/file/inspect',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                origin: adminOrigin,
              },
              body: JSON.stringify(sourceBody),
            },
          ),
        )
      ).status,
    ).toBe(200);

    const previewBody = {
      ...sourceBody,
      datasetReference: 'batch-1',
      mapping: { name: 'Name', attributeColumns: {} },
      defaults: {
        productTypeId,
        schemaVersion: 1,
      },
    };
    expect(
      (
        await previewArticleImport(
          new Request(
            adminOrigin + '/api/admin/products/import/file/preview',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                origin: adminOrigin,
              },
              body: JSON.stringify(previewBody),
            },
          ),
        )
      ).status,
    ).toBe(200);

    expect(
      (
        await commitArticleImport(
          new Request(
            adminOrigin + '/api/admin/products/import/file/commit',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                origin: adminOrigin,
              },
              body: JSON.stringify({
                ...previewBody,
                expectedPreviewFingerprint: 'a'.repeat(64),
              }),
            },
          ),
        )
      ).status,
    ).toBe(201);

    expect((await getArticleImportJobs()).status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/products/import/file/inspect',
      expect.objectContaining({ method: 'POST', accessToken: token }),
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/products/import/file/preview',
      expect.objectContaining({ method: 'POST', accessToken: token }),
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      '/admin/products/import/file/commit',
      expect.objectContaining({ method: 'POST', accessToken: token }),
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      4,
      '/admin/products/import/jobs',
      { accessToken: token },
    );
  });

  it.each([
    ['create Product', () => postProduct()],
    ['create Manufacturer Article', () => createArticle()],
    ['update Product', () => patchProduct()],
    ['add Product asset', () => postAsset()],
    ['update Product asset', () => patchAsset()],
  ])('blocks Admin write action: %s', async (_label, action) => {
    const response = await action();

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SELLER_PRODUCT_OWNED' },
    });
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
