import type { EmailTemplateDataMap } from '../email.types.js';
import { requiredText, safeLink, type TemplateContent } from '../email-template-helpers.js';

export function sellerCorrectionsRequested(
  data: EmailTemplateDataMap['seller-corrections-requested'],
): TemplateContent {
  const reason = requiredText(data.reason, 'reason');
  return {
    details: `Our review team requested corrections. You can now edit the full application.\n\nReason: ${reason}`,
    action: { label: 'Update application', url: safeLink(data.trackingUrl, 'trackingUrl') },
  };
}
