import { cookies } from 'next/headers';
import type {
  ProductTypePrepareResult,
  ProductTypeRecord,
  ProductTypeSchemaVersionRecord,
} from '@/lib/catalog-contracts';
import type {
  CriteriaTemplateApplyResult,
  CriteriaTemplateRecord,
} from '@/lib/catalog-attribute-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { assertSameOrigin } from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const { id } = await context.params;

    const productType = await requestAdminApi<ProductTypeRecord>(
      `/admin/catalog/product-types/${id}`,
      { accessToken },
    );

    if (productType.currentSchemaVersionId) {
      const schemas = await requestAdminApi<ProductTypeSchemaVersionRecord[]>(
        `/admin/catalog/product-types/${id}/schemas`,
        { accessToken },
      );
      const schema =
        schemas.find(
          (item) => item.id === productType.currentSchemaVersionId,
        ) ?? schemas[0] ?? null;

      return jsonNoStore({
        state: 'READY',
        productType,
        appliedTemplate: null,
        schema,
        candidates: [],
        message: 'Product Type already has a published schema.',
      } satisfies ProductTypePrepareResult);
    }

    if (!['DRAFT', 'ACTIVE'].includes(productType.status)) {
      return jsonNoStore({
        state: 'NEEDS_REVIEW',
        productType,
        appliedTemplate: null,
        schema: null,
        candidates: [],
        message:
          'Only Draft or Active Product Types can use automatic preparation.',
      } satisfies ProductTypePrepareResult);
    }

    const templates = await requestAdminApi<CriteriaTemplateRecord[]>(
      `/admin/catalog/criteria-templates?productTypeId=${encodeURIComponent(id)}&status=ACTIVE`,
      { accessToken },
    );

    const familyMatches = productType.productFamilyId
      ? templates.filter(
          (template) =>
            template.productFamilyId === productType.productFamilyId,
        )
      : [];
    const preferredPool =
      familyMatches.length > 0
        ? familyMatches
        : templates.filter((template) => template.productFamilyId === null);

    if (preferredPool.length !== 1) {
      return jsonNoStore({
        state: 'NEEDS_CRITERIA',
        productType,
        appliedTemplate: null,
        schema: null,
        candidates: preferredPool.map((template) => ({
          id: template.id,
          name: template.name,
          code: template.code,
        })),
        message:
          preferredPool.length === 0
            ? 'No governed Criteria Template can be selected automatically.'
            : 'More than one governed Criteria Template is applicable; choose the correct one in Criteria setup.',
      } satisfies ProductTypePrepareResult);
    }

    const selectedTemplate = preferredPool[0];
    if (!selectedTemplate) {
      throw new Error('Criteria Template selection failed');
    }

    let activeProductType = productType;
    if (productType.status !== 'ACTIVE') {
      activeProductType = await requestAdminApi<ProductTypeRecord>(
        `/admin/catalog/product-types/${id}`,
        {
          method: 'PATCH',
          body: {
            version: productType.version,
            status: 'ACTIVE',
          },
          accessToken,
        },
      );
    }

    const application =
      await requestAdminApi<CriteriaTemplateApplyResult>(
        `/admin/catalog/product-types/${id}/criteria-templates/${selectedTemplate.id}/apply`,
        {
          method: 'POST',
          body: { assignmentStatus: 'ACTIVE' },
          accessToken,
        },
      );

    const schema = await requestAdminApi<ProductTypeSchemaVersionRecord>(
      `/admin/catalog/product-types/${id}/schemas/publish`,
      {
        method: 'POST',
        body: { productTypeVersion: activeProductType.version },
        accessToken,
      },
    );

    const readyProductType: ProductTypeRecord = {
      ...activeProductType,
      version: activeProductType.version + 1,
      currentSchemaVersionId: schema.id,
    };

    return jsonNoStore({
      state: 'READY',
      productType: readyProductType,
      appliedTemplate: {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        code: selectedTemplate.code,
        createdCount: application.createdCount,
      },
      schema,
      candidates: [],
      message: 'Professional criteria applied and schema published.',
    } satisfies ProductTypePrepareResult);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in to continue.',
      },
    },
    401,
  );
}
