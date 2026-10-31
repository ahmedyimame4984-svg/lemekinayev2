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

vi.mock('@/lib/server/admin-api', () => {
  class AdminApiError extends Error {
    constructor(
      readonly status: number,
      readonly retryAfter: string | null,
      readonly apiCode?: string,
      readonly apiMessage?: string,
    ) {
      super(`Admin API request failed with status ${status}`);
      this.name = 'AdminApiError';
    }
  }

  return {
    AdminApiError,
    requestAdminApi: mocks.requestAdminApi,
  };
});

import { POST as inspectImport } from './file/inspect/route';
import { POST as previewImport } from './file/preview/route';
import { POST as commitImport } from './file/commit/route';
import { GET as listJobs } from './jobs/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

function jsonRequest(path: string, body: unknown): Request {
  return new Request(adminOrigin + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(adminOrigin).origin,
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  });
}

describe('Admin professional Article import BFF', () => {
  it('forwards source inspection securely', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      fileName: 'articles.csv',
      format: 'CSV',
      sheetName: null,
      headers: ['Name'],
      totalRows: 1,
    });

    const body = {
      fileName: 'articles.csv',
      format: 'CSV',
      fileBase64: 'TmFtZQpQYWQK',
    };
    const response = await inspectImport(
      jsonRequest('/api/admin/products/import/file/inspect', body),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/import/file/inspect',
      {
        method: 'POST',
        body,
        accessToken: token,
        timeoutMs: 30_000,
      },
    );
  });

  it('forwards mapped preview and commit with longer import timeouts', async () => {
    const previewBody = {
      datasetReference: 'supplier-2026-10',
      fileName: 'articles.csv',
      format: 'CSV',
      fileBase64: 'TmFtZQpQYWQK',
      mapping: {
        name: 'Name',
        attributeColumns: {},
      },
      defaults: {
        productTypeId: '11111111-1111-4111-8111-111111111111',
        schemaVersion: 2,
      },
    };
    mocks.requestAdminApi.mockResolvedValueOnce({
      datasetReference: previewBody.datasetReference,
      previewFingerprint: 'a'.repeat(64),
      canCommit: true,
    });

    const previewResponse = await previewImport(
      jsonRequest('/api/admin/products/import/file/preview', previewBody),
    );
    expect(previewResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/products/import/file/preview',
      {
        method: 'POST',
        body: previewBody,
        accessToken: token,
        timeoutMs: 45_000,
      },
    );

    const commitBody = {
      ...previewBody,
      expectedPreviewFingerprint: 'a'.repeat(64),
    };
    mocks.requestAdminApi.mockResolvedValueOnce({
      jobId: '22222222-2222-4222-8222-222222222222',
      datasetReference: previewBody.datasetReference,
      createdCount: 1,
    });

    const commitResponse = await commitImport(
      jsonRequest('/api/admin/products/import/file/commit', commitBody),
    );
    expect(commitResponse.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/products/import/file/commit',
      {
        method: 'POST',
        body: commitBody,
        accessToken: token,
        timeoutMs: 60_000,
      },
    );
  });

  it('lists recent committed import jobs', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await listJobs();

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/import/jobs',
      { accessToken: token },
    );
  });

  it('requires an authenticated Admin session', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await inspectImport(
      jsonRequest('/api/admin/products/import/file/inspect', {
        fileName: 'articles.csv',
        format: 'CSV',
        fileBase64: 'TmFtZQpQYWQK',
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('rejects cross-site import writes before forwarding them', async () => {
    const request = new Request(
      adminOrigin + '/api/admin/products/import/file/preview',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({
          datasetReference: 'blocked',
        }),
      },
    );

    const response = await previewImport(request);

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
