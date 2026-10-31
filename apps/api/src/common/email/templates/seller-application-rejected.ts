import type { EmailTemplateDataMap } from '../email.types.js';
import { requiredText, type TemplateContent } from '../email-template-helpers.js';

export function sellerApplicationRejected(
  data: EmailTemplateDataMap['seller-application-rejected'],
): TemplateContent {
  const reason = requiredText(data.reason, 'reason');
  return {
    details:
      `Your Seller application was not approved.\n\nReason: ${reason}\n\n` +
      'Please contact Lemekinaye Support if you need clarification.',
  };
}
