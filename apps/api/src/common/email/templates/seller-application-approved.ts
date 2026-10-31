import type { EmailTemplateDataMap } from '../email.types.js';
import { safeLink, type TemplateContent } from '../email-template-helpers.js';

export function sellerApplicationApproved(
  data: EmailTemplateDataMap['seller-application-approved'],
): TemplateContent {
  return {
    details:
      'Your Seller business application has been approved. ' +
      'You can now sign in with your existing verified email and password. ' +
      'No invitation, new password, or activation link is required.',
    action: { label: 'Sign in to Seller Portal', url: safeLink(data.loginUrl, 'loginUrl') },
  };
}
