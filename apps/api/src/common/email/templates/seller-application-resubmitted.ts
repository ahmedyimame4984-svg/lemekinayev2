import type { EmailTemplateDataMap } from '../email.types.js';
import { safeLink, type TemplateContent } from '../email-template-helpers.js';

export function sellerApplicationResubmitted(
  data: EmailTemplateDataMap['seller-application-resubmitted'],
): TemplateContent {
  return {
    details: 'Your corrections have been received for review.',
    action: { label: 'Track application', url: safeLink(data.trackingUrl, 'trackingUrl') },
  };
}
