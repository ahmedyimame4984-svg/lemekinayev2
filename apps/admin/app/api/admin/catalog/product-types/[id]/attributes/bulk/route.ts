import { cookies } from 'next/headers';
import type {
  BulkCreateProductTypeAttributeAssignmentsInput,
  BulkDeleteProductTypeAttributeAssignmentsInput,
  BulkUpdateProductTypeAttributeAssignmentsInput,
  ProductTypeAttributeAssignmentRecord,
} from '@/lib/catalog-attribute-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as BulkCreateProductTypeAttributeAssignmentsInput;
    const { id } = await context.params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const assignments = await requestAdminApi<
      ProductTypeAttributeAssignmentRecord[]
    >(`/admin/catalog/product-types/${id}/attributes/bulk`, {
      method: 'POST',
      body,
      accessToken,
    });

    return jsonNoStore(assignments, 201);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as BulkUpdateProductTypeAttributeAssignmentsInput;
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const assignments = await requestAdminApi<
      ProductTypeAttributeAssignmentRecord[]
    >(`/admin/catalog/product-types/${id}/attributes/bulk`, {
      method: 'PATCH',
      body,
      accessToken,
    });

    return jsonNoStore(assignments);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as BulkDeleteProductTypeAttributeAssignmentsInput;
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const assignments = await requestAdminApi<
      ProductTypeAttributeAssignmentRecord[]
    >(`/admin/catalog/product-types/${id}/attributes/bulk`, {
      method: 'DELETE',
      body,
      accessToken,
    });

    return jsonNoStore(assignments);
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
