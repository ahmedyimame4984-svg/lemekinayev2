import type { EmailTemplateDataMap } from '../email.types.js';
import { safeLink, type TemplateContent } from '../email-template-helpers.js';

export function sellerApplicationReceived(
  data: EmailTemplateDataMap['seller-application-received'],
): TemplateContent {
  return {
    details:
      'We received your Seller application. Keep your unique reference for tracking.\n\n' +
      'You can securely track and edit your application before our team starts its review. ' +
      'Editing will reopen if our reviewers request corrections.\n\n' +
      'Your reference is not a password. Email verification is required to access your application.',
    action: { label: 'Track application', url: safeLink(data.trackingUrl, 'trackingUrl') },
  };
}
