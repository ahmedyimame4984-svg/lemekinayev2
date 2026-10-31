import type { EmailTemplateDataMap } from '../email.types.js';
import { requiredText, type TemplateContent } from '../email-template-helpers.js';

export function sellerApplicationAccessCode(
  data: EmailTemplateDataMap['seller-application-access-code'],
): TemplateContent {
  const code = requiredText(data.code, 'code');
  if (!/^\d{6}$/u.test(code)) throw new Error('Invalid email verification code');
  return {
    details:
      `Your one-time verification code is ${code}. It expires in 10 minutes.\n\n` +
      'Do not share this code. If you did not request it, ignore this message.',
  };
}
