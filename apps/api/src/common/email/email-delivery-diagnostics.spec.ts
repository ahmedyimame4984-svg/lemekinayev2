import { describe, expect, it } from 'vitest';
import { emailDeliveryFailureCategory } from './email-delivery-diagnostics.js';

describe('private email delivery diagnostics', () => {
  it('labels Gmail authentication rejection without leaking SMTP response text', () => {
    expect(emailDeliveryFailureCategory({
      code: 'EAUTH',
      responseCode: 535,
      response: '535 sensitive user and SMTP details',
    })).toBe('SMTP_AUTH_REJECTED');
  });

  it('labels connection and recipient failures', () => {
    expect(emailDeliveryFailureCategory({ code: 'ETIMEDOUT' }))
      .toBe('SMTP_CONNECTION_FAILED');
    expect(emailDeliveryFailureCategory({ responseCode: 550 }))
      .toBe('SMTP_RECIPIENT_REJECTED');
  });

  it('never logs an unknown raw error or its message', () => {
    const secret = 'private-activation-token-and-password';
    const label = emailDeliveryFailureCategory(new Error(secret));
    expect(label).toBe('EMAIL_DELIVERY_FAILED');
    expect(label).not.toContain(secret);
  });
});
