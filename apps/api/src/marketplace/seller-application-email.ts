import type { SendEmailInput } from '../common/email/email.types.js';
import type { ApplicationEmailPayload } from './seller-application-email.types.js';

/** Maps marketplace-specific events into the platform's reusable email API. */
export function sellerApplicationEmail(
  payload: ApplicationEmailPayload,
  sellerOrigin: string,
  toEmail: string,
): SendEmailInput {
  const origin = new URL(sellerOrigin);
  if (
    origin.protocol !== 'https:' &&
    !(
      origin.protocol === 'http:' &&
      (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1')
    )
  ) {
    throw new Error('Seller origin must be HTTPS');
  }

  const trackingUrl = new URL('/application', origin).toString();
  const referenceCode = payload.referenceCode;
  switch (payload.kind) {
    case 'SUBMITTED':
      return {
        template: 'seller-application-received',
        subject: 'Lemekinaye — Seller application received',
        toEmail,
        data: { referenceCode, trackingUrl },
      };
    case 'RESUBMITTED':
      return {
        template: 'seller-application-resubmitted',
        subject: 'Lemekinaye — Application updates received',
        toEmail,
        data: { referenceCode, trackingUrl },
      };
    case 'CORRECTIONS_REQUESTED':
      return {
        template: 'seller-corrections-requested',
        subject: 'Lemekinaye — Action required on your Seller application',
        toEmail,
        data: {
          referenceCode,
          trackingUrl,
          reason: payload.reason ?? 'Please check your application.',
        },
      };
    case 'APPLICATION_APPROVED':
      return {
        template: 'seller-application-approved',
        subject: 'Lemekinaye — Your Seller business is approved',
        toEmail,
        data: { referenceCode, loginUrl: new URL('/login', origin).toString() },
      };
    case 'REJECTED':
      return {
        template: 'seller-application-rejected',
        subject: 'Lemekinaye — Seller application decision',
        toEmail,
        data: {
          referenceCode,
          reason: payload.reason ?? 'Please contact support.',
        },
      };
    case 'APPROVED': {
      if (!payload.activationToken) {
        throw new Error('Activation token is required');
      }
      const activationUrl = new URL('/activate', origin);
      // Keep the single-use token out of web server and reverse-proxy URL logs.
      activationUrl.hash = new URLSearchParams({
        token: payload.activationToken,
      }).toString();
      return {
        template: 'seller-account-invitation',
        subject: 'Lemekinaye — Seller application approved',
        toEmail,
        data: { referenceCode, activationUrl: activationUrl.toString() },
      };
    }
    case 'ACCESS_CODE':
      if (!payload.code) {
        throw new Error('Verification code is required');
      }
      return {
        template: 'seller-application-access-code',
        subject: 'Lemekinaye — Verify your Seller application access',
        toEmail,
        data: { referenceCode, code: payload.code },
      };
    case 'CONTACT_EMAIL_CHANGED':
      return {
        template: 'seller-contact-email-changed',
        subject: 'Lemekinaye — Application contact email changed',
        toEmail,
        data: { referenceCode },
      };
  }
}
