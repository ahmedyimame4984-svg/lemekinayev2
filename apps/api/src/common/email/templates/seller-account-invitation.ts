import type { EmailTemplateDataMap } from '../email.types.js';
import { safeLink, type TemplateContent } from '../email-template-helpers.js';

export function sellerAccountInvitation(
  data: EmailTemplateDataMap['seller-account-invitation'],
): TemplateContent {
  return {
    details:
      'Your application has been approved. Activate your Seller account using the single-use invitation below.\n\n' +
      'The invitation expires according to the activation period set by Lemekinaye. ' +
      'Never share your activation link. We will not send you a password.',
    action: { label: 'Activate Seller account', url: safeLink(data.activationUrl, 'activationUrl') },
  };
}
