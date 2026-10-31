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
import { GET as getAttributeGroups } from './attribute-groups/route';
import { GET as getCanonicalProductCatalog } from './canonical-product-catalog/route';
import { POST as postInstallCanonicalProductCatalog } from './canonical-product-catalog/install/route';
import { GET as getProfessionalCatalogBaseline } from './professional-baseline/route';
import { POST as postReconcileProfessionalCatalogBaseline } from './professional-baseline/reconcile/route';
import {
  GET as getCriteriaTemplates,
  POST as postCriteriaTemplate,
} from './criteria-templates/route';
import { GET as getCriteriaTemplatesPage } from './criteria-templates/page/route';
import { GET as getCanonicalCriteriaLibrary } from './criteria-templates/canonical-library/route';
import { POST as postInstallCanonicalCriteriaLibrary } from './criteria-templates/canonical-library/install/route';
import { PATCH as patchCriteriaTemplate } from './criteria-templates/[templateId]/route';
import { GET as getCriteriaTemplateItems } from './criteria-templates/[templateId]/items/route';
import { POST as postCriteriaTemplateItemsBulk } from './criteria-templates/[templateId]/items/bulk/route';
import { GET as getCriteriaTemplateAvailableAttributesPage } from './criteria-templates/[templateId]/available-attributes/page/route';
import { GET as getCriteriaTemplateAvailableAttributeSummary } from './criteria-templates/[templateId]/available-attributes/summary/route';
import { GET as getAttributes } from './attributes/route';
import {
  GET as getAssignments,
  POST as postAssignment,
} from './product-types/[id]/attributes/route';
import { GET as getAvailableAttributes } from './product-types/[id]/available-attributes/route';
import { GET as getAvailableAttributesPage } from './product-types/[id]/available-attributes/page/route';
import { GET as getAvailableAttributeSummary } from './product-types/[id]/available-attributes/summary/route';
import { PATCH as patchAssignment } from './product-types/[id]/attributes/[assignmentId]/route';
import { POST as postBulkAssignments, PATCH as patchBulkAssignmentSettings } from './product-types/[id]/attributes/bulk/route';
import { POST as postBulkRemoveAssignments } from './product-types/[id]/attributes/bulk/remove/route';
import { POST as postRemoveAssignment } from './product-types/[id]/attributes/[assignmentId]/remove/route';
import { POST as postApplyCriteriaTemplate } from './product-types/[id]/criteria-templates/[templateId]/apply/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const productTypeId = '44444444-4444-4444-8444-444444444444';
const assignmentId = '77777777-7777-4777-8777-777777777777';
const attributeId = '55555555-5555-4555-8555-555555555555';
const templateId = '66666666-6666-4666-8666-666666666666';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Product Type attribute BFF routes', () => {
  it('requires the Admin access cookie for attribute reads', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getAttributes(
      new Request(`${adminOrigin}/api/admin/catalog/attributes`),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards attribute and assignment filters', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    await getAttributes(
      new Request(
        `${adminOrigin}/api/admin/catalog/attributes?status=ACTIVE&scope=PRODUCT`,
      ),
    );
    await getAssignments(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes?status=ACTIVE&requirement=MANDATORY`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/catalog/attributes?status=ACTIVE&scope=PRODUCT',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/catalog/product-types/${productTypeId}/attributes?status=ACTIVE&requirement=MANDATORY`,
      { accessToken: token },
    );
  });

  it('forwards paged and summarized Criteria Template Attribute candidates', async () => {
    const groupId = '99999999-9999-4999-8999-999999999999';
    mocks.requestAdminApi
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        pageSize: 50,
        pageCount: 0,
      })
      .mockResolvedValueOnce({
        total: 31,
        ungrouped: 2,
        groupCounts: { [groupId]: 14 },
      });

    const pageResponse = await getCriteriaTemplateAvailableAttributesPage(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates/${templateId}/available-attributes/page?search=brake&groupId=${groupId}&page=2&pageSize=50`,
      ),
      { params: Promise.resolve({ templateId }) },
    );
    const summaryResponse =
      await getCriteriaTemplateAvailableAttributeSummary(
        new Request(
          `${adminOrigin}/api/admin/catalog/criteria-templates/${templateId}/available-attributes/summary`,
        ),
        { params: Promise.resolve({ templateId }) },
      );

    expect(pageResponse.status).toBe(200);
    expect(summaryResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      `/admin/catalog/criteria-templates/${templateId}/available-attributes/page?search=brake&groupId=${groupId}&page=2&pageSize=50`,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/catalog/criteria-templates/${templateId}/available-attributes/summary`,
      { accessToken: token },
    );
  });

  it('forwards Product Type available-attribute reads', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getAvailableAttributes(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/available-attributes`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/available-attributes`,
      { accessToken: token },
    );
  });

  it('forwards paged and summarized Product Type Attribute candidates', async () => {
    const groupId = '99999999-9999-4999-8999-999999999999';
    mocks.requestAdminApi
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        pageSize: 50,
        pageCount: 0,
      })
      .mockResolvedValueOnce({
        total: 37,
        ungrouped: 2,
        groupCounts: { [groupId]: 12 },
      });

    const pageResponse = await getAvailableAttributesPage(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/available-attributes/page?search=brake&groupId=${groupId}&page=2&pageSize=50`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );
    const summaryResponse = await getAvailableAttributeSummary(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/available-attributes/summary`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(pageResponse.status).toBe(200);
    expect(summaryResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      `/admin/catalog/product-types/${productTypeId}/available-attributes/page?search=brake&groupId=${groupId}&page=2&pageSize=50`,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/catalog/product-types/${productTypeId}/available-attributes/summary`,
      { accessToken: token },
    );
  });

  it('forwards same-origin assignment creation and returns 201', async () => {
    const created = {
      id: assignmentId,
      productTypeId,
      attributeId,
      requirement: 'MANDATORY',
      displayMode: 'VISIBLE',
      displayOrder: 10,
      validationRule: null,
      conditionalRule: null,
      searchable: true,
      filterable: true,
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    };
    mocks.requestAdminApi.mockResolvedValue(created);

    const response = await postAssignment(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            attributeId,
            requirement: 'MANDATORY',
            searchable: true,
            filterable: true,
            status: 'ACTIVE',
          }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/attributes`,
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
        body: expect.objectContaining({
          attributeId,
          requirement: 'MANDATORY',
        }),
      }),
    );
  });

  it('forwards Attribute Group reads used by the grouped selector', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getAttributeGroups(
      new Request(
        `${adminOrigin}/api/admin/catalog/attribute-groups?status=ACTIVE`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/attribute-groups?status=ACTIVE',
      { accessToken: token },
    );
  });

  it('forwards same-origin bulk assignment creation atomically', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await postBulkAssignments(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes/bulk`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            attributeIds: [attributeId],
            requirement: 'MANDATORY',
            comparable: true,
            status: 'ACTIVE',
          }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/attributes/bulk`,
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
        body: expect.objectContaining({
          attributeIds: [attributeId],
          comparable: true,
        }),
      }),
    );
  });

  it('forwards different settings per assigned Attribute in one Save All request', async () => {
    const secondAssignmentId = '88888888-8888-4888-8888-888888888888';
    const edits = {
      assignments: [
        { id: assignmentId, version: 1, requirement: 'MANDATORY', filterable: true },
        { id: secondAssignmentId, version: 2, requirement: 'OPTIONAL', searchable: false, sellerEditable: false },
      ],
    };
    mocks.requestAdminApi.mockResolvedValue([
      { id: assignmentId, version: 2, requirement: 'MANDATORY', filterable: true },
      { id: secondAssignmentId, version: 3, requirement: 'OPTIONAL', searchable: false, sellerEditable: false },
    ]);

    const response = await patchBulkAssignmentSettings(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes/bulk`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(edits),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledTimes(1);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/attributes/bulk`,
      { method: 'PATCH', body: edits, accessToken: token },
    );
    await expect(response.json()).resolves.toHaveLength(2);
  });

  it('forwards paged Criteria Template library search and filters', async () => {
    const familyId = '99999999-9999-4999-8999-999999999999';
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await getCriteriaTemplatesPage(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates/page?search=brake&productFamilyId=${familyId}&status=ACTIVE&page=2&pageSize=50`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/criteria-templates/page?search=brake&productFamilyId=${familyId}&status=ACTIVE&page=2&pageSize=50`,
      { accessToken: token },
    );
  });

  it('forwards relevant active Criteria Template reads', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getCriteriaTemplates(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates?productTypeId=${productTypeId}&status=ACTIVE`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/criteria-templates?productTypeId=${productTypeId}&status=ACTIVE`,
      { accessToken: token },
    );
  });

  it('forwards Professional Catalog Baseline status and reconciliation', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      ready: true,
      reconciliationInProgress: false,
      attributes: {
        valid: true,
        validationErrors: [],
        ready: true,
        expected: { attributes: 1243 },
      },
      catalog: {
        valid: true,
        validationErrors: [],
        categories: { expected: 22, installed: 22 },
        partGroups: { expected: 78, installed: 78 },
        productTypes: { expected: 432, installed: 432 },
      },
      criteria: {
        valid: true,
        validationErrors: [],
        templates: { expected: 392, installed: 392 },
        attributes: { expected: 1243, resolved: 1243 },
        productTypeTargets: {
          expectedCodes: 432,
          resolvedCodes: 432,
          unmatchedCodes: [],
        },
        assignments: { expected: 2500, installed: 2500 },
      },
    });

    const statusResponse = await getProfessionalCatalogBaseline();

    expect(statusResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/professional-baseline',
      { accessToken: token, timeoutMs: 60_000 },
    );

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue({ ready: true });

    const reconcileResponse = await postReconcileProfessionalCatalogBaseline(
      new Request(
        `${adminOrigin}/api/admin/catalog/professional-baseline/reconcile`,
        {
          method: 'POST',
          headers: {
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
        },
      ),
    );

    expect(reconcileResponse.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/professional-baseline/reconcile',
      { method: 'POST', accessToken: token, timeoutMs: 300_000 },
    );
  });

  it('forwards canonical Product Catalog status and install actions', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      valid: true,
      validationErrors: [],
      categories: { expected: 22, installed: 22 },
      partGroups: { expected: 78, installed: 78 },
      productTypes: { expected: 432, installed: 432 },
    });

    const statusResponse = await getCanonicalProductCatalog();

    expect(statusResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/canonical-product-catalog',
      { accessToken: token },
    );

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue({
      createdCategories: 22,
      createdPartGroups: 78,
      createdProductTypes: 432,
    });

    const installResponse = await postInstallCanonicalProductCatalog(
      new Request(
        `${adminOrigin}/api/admin/catalog/canonical-product-catalog/install`,
        {
          method: 'POST',
          headers: {
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
        },
      ),
    );

    expect(installResponse.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/canonical-product-catalog/install',
      { method: 'POST', accessToken: token },
    );
  });

  it('forwards canonical Criteria library status and install actions', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      valid: true,
      validationErrors: [],
      templates: { expected: 18, installed: 18 },
      attributes: { expected: 108, resolved: 108 },
      productTypeTargets: {
        expectedCodes: 25,
        resolvedCodes: 10,
        unmatchedCodes: [],
      },
    });

    const statusResponse = await getCanonicalCriteriaLibrary();

    expect(statusResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/criteria-templates/canonical-library',
      { accessToken: token },
    );

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue({
      createdTemplates: 18,
      updatedTemplates: 0,
    });

    const installResponse = await postInstallCanonicalCriteriaLibrary(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates/canonical-library/install`,
        {
          method: 'POST',
          headers: {
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
        },
      ),
    );

    expect(installResponse.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/criteria-templates/canonical-library/install',
      { method: 'POST', accessToken: token },
    );
  });

  it('forwards Criteria Template creation and update mutations', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: templateId,
      code: 'BRAKE_DISC_STANDARD',
      name: 'Brake Disc Standard',
      status: 'DRAFT',
      version: 1,
      itemCount: 0,
    });

    const createResponse = await postCriteriaTemplate(
      new Request(`${adminOrigin}/api/admin/catalog/criteria-templates`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          code: 'BRAKE_DISC_STANDARD',
          name: 'Brake Disc Standard',
        }),
      }),
    );

    expect(createResponse.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/catalog/criteria-templates',
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
      }),
    );

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue({
      id: templateId,
      code: 'BRAKE_DISC_STANDARD',
      name: 'Brake Disc Standard',
      status: 'ACTIVE',
      version: 2,
      itemCount: 0,
    });

    const updateResponse = await patchCriteriaTemplate(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates/${templateId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, status: 'ACTIVE' }),
        },
      ),
      { params: Promise.resolve({ templateId }) },
    );

    expect(updateResponse.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/criteria-templates/${templateId}`,
      expect.objectContaining({
        method: 'PATCH',
        body: { version: 1, status: 'ACTIVE' },
        accessToken: token,
      }),
    );
  });

  it('forwards Template item reads and atomic bulk authoring', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const readResponse = await getCriteriaTemplateItems(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates/${templateId}/items`,
      ),
      { params: Promise.resolve({ templateId }) },
    );
    expect(readResponse.status).toBe(200);

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue([]);

    const bulkResponse = await postCriteriaTemplateItemsBulk(
      new Request(
        `${adminOrigin}/api/admin/catalog/criteria-templates/${templateId}/items/bulk`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            attributeIds: [attributeId],
            requirement: 'MANDATORY',
            filterable: true,
            status: 'ACTIVE',
          }),
        },
      ),
      { params: Promise.resolve({ templateId }) },
    );

    expect(bulkResponse.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/criteria-templates/${templateId}/items/bulk`,
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          attributeIds: [attributeId],
          filterable: true,
        }),
        accessToken: token,
      }),
    );
  });

  it('forwards same-origin Criteria Template application', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      templateId,
      productTypeId,
      createdCount: 2,
      createdAssignmentIds: ['a', 'b'],
      skippedAttributeIds: [attributeId],
    });

    const response = await postApplyCriteriaTemplate(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/criteria-templates/${templateId}/apply`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ assignmentStatus: 'ACTIVE' }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId, templateId }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/criteria-templates/${templateId}/apply`,
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
        body: { assignmentStatus: 'ACTIVE' },
      }),
    );
  });

  it('rejects cross-origin assignment creation before the API call', async () => {
    const response = await postAssignment(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ attributeId }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('maps catalog conflicts to a safe reload message', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null));

    const response = await postAssignment(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ attributeId }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'CATALOG_CONFLICT',
        message: expect.stringContaining('Reload'),
      },
    });
  });

  it('forwards optimistic assignment updates with route ids and version', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: assignmentId,
      productTypeId,
      attributeId,
      requirement: 'OPTIONAL',
      displayMode: 'VISIBLE',
      displayOrder: 20,
      validationRule: null,
      conditionalRule: null,
      searchable: false,
      filterable: true,
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    });

    const response = await patchAssignment(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes/${assignmentId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, displayOrder: 20 }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId, assignmentId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/attributes/${assignmentId}`,
      expect.objectContaining({
        method: 'PATCH',
        accessToken: token,
        body: { version: 1, displayOrder: 20 },
      }),
    );
  });
  it('forwards explicit relationship removal without relying on DELETE request bodies', async () => {
    mocks.requestAdminApi.mockResolvedValue([
      {
        id: assignmentId,
        productTypeId,
        attributeId,
        status: 'DRAFT',
        version: 2,
      },
    ]);

    const response = await postBulkRemoveAssignments(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes/bulk/remove`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            assignments: [{ id: assignmentId, version: 2 }],
          }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/attributes/bulk/remove`,
      {
        method: 'POST',
        body: { assignments: [{ id: assignmentId, version: 2 }] },
        accessToken: token,
      },
    );
  });

  it('forwards one explicit Attribute relationship removal', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: assignmentId,
      productTypeId,
      attributeId,
      status: 'DRAFT',
      version: 2,
    });

    const response = await postRemoveAssignment(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/attributes/${assignmentId}/remove`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 2 }),
        },
      ),
      {
        params: Promise.resolve({
          id: productTypeId,
          assignmentId,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/attributes/${assignmentId}/remove`,
      {
        method: 'POST',
        body: { version: 2 },
        accessToken: token,
      },
    );
  });

});
