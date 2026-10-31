import type { EmailTemplateDataMap } from '../email.types.js';
import { safeLink, type TemplateContent } from '../email-template-helpers.js';

export function sellerEmailVerification(
  data: EmailTemplateDataMap['seller-email-verification'],
): TemplateContent {
  return {
    details:
      'Confirm your email address to complete account registration. ' +
      'This one-time verification link is valid for 30 minutes. ' +
      'Do not share the link. You can submit your business application after verification.',
    action: {
      label: 'Verify email address',
      url: safeLink(data.verificationUrl, 'verificationUrl'),
    },
    showActionUrl: true,
  };
}
