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
    ) {
      super('Admin API request failed');
    }
  },
  requestAdminApi: mocks.requestAdminApi,
}));

import { AdminApiError } from '@/lib/server/admin-api';
import {
  GET as getAttributes,
  POST as postAttribute,
} from './attributes/route';
import {
  GET as getAttribute,
  PATCH as patchAttribute,
} from './attributes/[id]/route';
import { GET as getAttributesPage } from './attributes/page/route';
import { GET as getAttributeSummary } from './attributes/summary/route';
import { GET as exportAttributes } from './attributes/export/route';
import { POST as previewAttributeImport } from './attributes/import/preview/route';
import { POST as commitAttributeImport } from './attributes/import/commit/route';
import {
  GET as getValues,
  POST as postValue,
} from './attributes/[id]/values/route';
import { PATCH as patchValue } from './attributes/[id]/values/[valueId]/route';
import {
  GET as getAttributeGroups,
  POST as postAttributeGroup,
} from './attribute-groups/route';
import { PATCH as patchAttributeGroup } from './attribute-groups/[id]/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const attributeId = '55555555-5555-4555-8555-555555555555';
const valueId = '66666666-6666-4666-8666-666666666666';
const groupId = '77777777-7777-4777-8777-777777777777';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin attribute master BFF routes', () => {
  it('requires the Admin access cookie for attribute reads', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getAttributes(
      new Request(`${adminOrigin}/api/admin/catalog/attributes`),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards Attribute Group reads, creation, and versioned updates', async () => {
    mocks.requestAdminApi.mockResolvedValueOnce([]);
    const listed = await getAttributeGroups(
      new Request(
        `${adminOrigin}/api/admin/catalog/attribute-groups?status=ACTIVE`,
      ),
    );
    expect(listed.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/attribute-groups?status=ACTIVE',
      { accessToken: token },
    );

    const createBody = {
      code: 'BRAKING',
      name: 'Braking',
      sortOrder: 10,
      status: 'DRAFT',
    };
    mocks.requestAdminApi.mockResolvedValueOnce({
      id: groupId,
      ...createBody,
      description: null,
      version: 1,
    });
    const created = await postAttributeGroup(
      new Request(`${adminOrigin}/api/admin/catalog/attribute-groups`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(createBody),
      }),
    );
    expect(created.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/attribute-groups',
      { method: 'POST', body: createBody, accessToken: token },
    );

    const updateBody = { version: 1, name: 'Braking System' };
    mocks.requestAdminApi.mockResolvedValueOnce({
      id: groupId,
      version: 2,
      name: updateBody.name,
    });
    const updated = await patchAttributeGroup(
      new Request(
        `${adminOrigin}/api/admin/catalog/attribute-groups/${groupId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(updateBody),
        },
      ),
      { params: Promise.resolve({ id: groupId }) },
    );
    expect(updated.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      `/admin/catalog/attribute-groups/${groupId}`,
      { method: 'PATCH', body: updateBody, accessToken: token },
    );
  });

  it('forwards attribute filters', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getAttributes(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes?status=ACTIVE&scope=PRODUCT&valueSource=STATIC&dataType=SELECT`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/attributes?status=ACTIVE&dataType=SELECT&scope=PRODUCT&valueSource=STATIC',
      { accessToken: token },
    );
  });

  it('forwards paged, summary, and direct Attribute reads', async () => {
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
        ungrouped: 8,
        groupCounts: { [groupId]: 42 },
      })
      .mockResolvedValueOnce({
        id: attributeId,
        code: 'ATTR_FUEL_TYPE',
        name: 'Fuel Type',
      });

    await getAttributesPage(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/page?search=fuel&groupId=${groupId}&status=ACTIVE&scope=PRODUCT&dataType=SELECT&page=2&pageSize=50&sortBy=UPDATED_AT&sortDirection=DESC`,
      ),
    );
    await getAttributeSummary();
    await getAttribute(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/${attributeId}`,
      ),
      { params: Promise.resolve({ id: attributeId }) },
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      `/admin/catalog/attributes/page?search=fuel&groupId=${groupId}&status=ACTIVE&dataType=SELECT&scope=PRODUCT&page=2&pageSize=50&sortBy=UPDATED_AT&sortDirection=DESC`,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog/attributes/summary',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      `/admin/catalog/attributes/${attributeId}`,
      { accessToken: token },
    );
  });

  it('forwards the Ungrouped Attribute queue explicitly', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      pageCount: 0,
    });

    await getAttributesPage(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/page?ungrouped=true&page=1&pageSize=50`,
      ),
    );

    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/attributes/page?ungrouped=true&page=1&pageSize=50',
      { accessToken: token },
    );
  });

  it('downloads filtered Attribute CSV exports', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      filename: 'lemekinaye-attributes.csv',
      csv: 'code,name\r\nATTR_TEST,Test\r\n',
    });

    const response = await exportAttributes(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/export?search=fuel&status=ACTIVE&sortBy=CODE&sortDirection=DESC`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain(
      'lemekinaye-attributes.csv',
    );
    await expect(response.text()).resolves.toContain('ATTR_TEST,Test');
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/attributes/export?search=fuel&status=ACTIVE&sortBy=CODE&sortDirection=DESC',
      { accessToken: token, timeoutMs: 20_000 },
    );
  });

  it('forwards same-origin Attribute CSV preview and atomic commit', async () => {
    const body = {
      csv: 'code,name,dataType,scope\nATTR_TEST,Test,TEXT,PRODUCT\n',
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
        createdCodes: ['ATTR_TEST'],
      });

    const preview = await previewAttributeImport(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/import/preview`,
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
      '/admin/catalog/attributes/import/preview',
      {
        method: 'POST',
        body,
        accessToken: token,
        timeoutMs: 20_000,
      },
    );

    const committed = await commitAttributeImport(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/import/commit`,
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
      '/admin/catalog/attributes/import/commit',
      {
        method: 'POST',
        body,
        accessToken: token,
        timeoutMs: 30_000,
      },
    );
  });

  it('rejects cross-origin Attribute CSV preview before contacting the API', async () => {
    const response = await previewAttributeImport(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/import/preview`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ csv: 'code,name,dataType,scope' }),
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards same-origin attribute creation and returns 201', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: attributeId,
      code: 'ATTR_FUEL_TYPE',
      name: 'Fuel Type',
      dataType: 'SELECT',
      scope: 'PRODUCT',
      valueSource: 'STATIC',
      unit: null,
      description: null,
      status: 'DRAFT',
      version: 1,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    });

    const response = await postAttribute(
      new Request(`${adminOrigin}/api/admin/catalog/attributes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          code: 'ATTR_FUEL_TYPE',
          name: 'Fuel Type',
          groupId,
          dataType: 'SELECT',
          scope: 'PRODUCT',
          valueSource: 'STATIC',
          exampleValue: 'Diesel',
          repeatable: false,
          translatable: true,
          status: 'DRAFT',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/attributes',
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
        body: expect.objectContaining({
          code: 'ATTR_FUEL_TYPE',
          groupId,
          valueSource: 'STATIC',
          exampleValue: 'Diesel',
          translatable: true,
        }),
      }),
    );
  });

  it('rejects cross-origin attribute creation before contacting the API', async () => {
    const response = await postAttribute(
      new Request(`${adminOrigin}/api/admin/catalog/attributes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({
          code: 'ATTR_FUEL_TYPE',
          name: 'Fuel Type',
          dataType: 'SELECT',
          scope: 'PRODUCT',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards optimistic attribute updates with the route id and version', async () => {
    mocks.requestAdminApi.mockResolvedValue({ id: attributeId, version: 2 });

    const response = await patchAttribute(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/${attributeId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            version: 1,
            name: 'Fuel Type Updated',
          }),
        },
      ),
      { params: Promise.resolve({ id: attributeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/attributes/${attributeId}`,
      expect.objectContaining({
        method: 'PATCH',
        accessToken: token,
        body: {
          version: 1,
          name: 'Fuel Type Updated',
        },
      }),
    );
  });

  it('forwards static allowed-value reads and status filters', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getValues(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/${attributeId}/values?status=ACTIVE`,
      ),
      { params: Promise.resolve({ id: attributeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/attributes/${attributeId}/values?status=ACTIVE`,
      { accessToken: token },
    );
  });

  it('forwards allowed-value creation and versioned updates', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: valueId,
      attributeId,
      code: 'DIESEL',
      label: 'Diesel',
      description: null,
      sortOrder: 0,
      status: 'DRAFT',
      version: 1,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    });

    const created = await postValue(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/${attributeId}/values`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            code: 'DIESEL',
            label: 'Diesel',
            status: 'DRAFT',
          }),
        },
      ),
      { params: Promise.resolve({ id: attributeId }) },
    );

    expect(created.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenLastCalledWith(
      `/admin/catalog/attributes/${attributeId}/values`,
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
        body: {
          code: 'DIESEL',
          label: 'Diesel',
          status: 'DRAFT',
        },
      }),
    );

    mocks.requestAdminApi.mockResolvedValue({
      id: valueId,
      attributeId,
      version: 2,
    });

    const updated = await patchValue(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/${attributeId}/values/${valueId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, label: 'Diesel Fuel' }),
        },
      ),
      { params: Promise.resolve({ id: attributeId, valueId }) },
    );

    expect(updated.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenLastCalledWith(
      `/admin/catalog/attributes/${attributeId}/values/${valueId}`,
      expect.objectContaining({
        method: 'PATCH',
        accessToken: token,
        body: { version: 1, label: 'Diesel Fuel' },
      }),
    );
  });

  it('maps attribute lifecycle conflicts to a safe reload message', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null));

    const response = await patchAttribute(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes/${attributeId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, status: 'INACTIVE' }),
        },
      ),
      { params: Promise.resolve({ id: attributeId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'CATALOG_CONFLICT',
        message: expect.stringContaining('Reload'),
      },
    });
  });
});
