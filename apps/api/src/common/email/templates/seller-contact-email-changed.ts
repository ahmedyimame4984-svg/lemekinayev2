import type { TemplateContent } from '../email-template-helpers.js';

export function sellerContactEmailChanged(): TemplateContent {
  return {
    details:
      'The contact email address for this Seller application was changed. ' +
      'If you did not authorize this change, contact Lemekinaye Support immediately.',
  };
}
