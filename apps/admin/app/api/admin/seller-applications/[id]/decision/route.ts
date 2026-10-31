import { cookies } from 'next/headers';
import {
  publicAdminApplicationDetail,
  type SellerApplicationDecision,
  type SellerApplicationDetail,
  type SellerApplicationReviewAction,
} from '@/lib/seller-application-review';
import { requestAdminApi } from '@/lib/server/admin-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { safeErrorResponse, jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const allowedActions = new Set<SellerApplicationReviewAction>([
  'START_REVIEW',
  'REQUEST_CORRECTIONS',
  'APPROVE',
  'REJECT',
]);

function parseDecision(input: Record<string, unknown>): SellerApplicationDecision | null {
  const action = input.action;
  const version = input.version;
  const reason = input.reason;

  if (
    typeof action !== 'string' ||
    !allowedActions.has(action as SellerApplicationReviewAction) ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    return null;
  }

  const requiresReason = action === 'REQUEST_CORRECTIONS' || action === 'REJECT';
  if (requiresReason && (typeof reason !== 'string' ||
    reason.trim().length < 10 || reason.trim().length > 1000)) {
    return null;
  }

  return {
    action: action as SellerApplicationReviewAction,
    version,
    ...(requiresReason ? { reason: (reason as string).trim() } : {}),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const { id } = await context.params;
    const decision = parseDecision(body);
    if (!UUID_PATTERN.test(id) || !decision) {
      return jsonNoStore(
        { error: { code: 'INVALID_DECISION', message: 'Check the action, application version and reason.' } },
        400,
      );
    }

    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return jsonNoStore(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
        401,
      );
    }

    // API must recheck permission, version, status and verified documents
    // atomically, audit the change, and queue the corresponding notification.
    const result = await requestAdminApi<SellerApplicationDetail>(
      `/admin/seller-applications/${id}/decision`,
      { method: 'POST', body: decision, accessToken },
    );
    return jsonNoStore(publicAdminApplicationDetail(result));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
