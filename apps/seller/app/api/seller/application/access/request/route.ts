import { parseApplicationAccessInput } from '@/lib/application-access';
import { SellerApiError, requestSellerApi } from '@/lib/server/seller-api';
import {
  assertSameOrigin,
  readJsonObject,
  RequestInputError,
} from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

/**
 * Backend dependency: POST /seller/registration/access/request must issue a
 * rate-limited OTP to the application's verified contact email, returning an
 * indistinguishable response for matched and unmatched applications.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);

    let input;
    try {
      input = parseApplicationAccessInput(await readJsonObject(request));
    } catch (error) {
      if (error instanceof RequestInputError) throw error;
      throw new RequestInputError(
        400,
        'Enter a valid application reference and contact email.',
      );
    }

    try {
      await requestSellerApi<unknown>('/seller/registration/access/request', {
        method: 'POST',
        body: input,
        timeoutMs: 10_000,
      });
    } catch (error) {
      if (error instanceof SellerApiError && error.status === 429) {
        return jsonNoStore(
          {
            error: {
              code: 'ACCESS_RATE_LIMITED',
              message: 'Please wait before requesting another access code.',
            },
          },
          429,
        );
      }
      // Do not leak the upstream 404 or any identity-matching information.
      return jsonNoStore(
        {
          error: {
            code: 'APPLICATION_TRACKING_UNAVAILABLE',
            message: 'Application tracking is currently unavailable. Please try again later.',
          },
        },
        503,
      );
    }

    return jsonNoStore(
      {
        message:
          'If the application reference and email match, a verification code will be sent to that email.',
      },
      202,
    );
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
