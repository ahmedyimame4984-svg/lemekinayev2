import { describe, expect, it } from 'vitest';
import { renderEmailTemplate } from '../common/email/email-template.renderer.js';
import { sellerApplicationEmail } from './seller-application-email.js';

const origin = 'https://seller.example.test';
const toEmail = 'applicant@example.test';
const referenceCode = 'SLR-APP-2026-ABCDEF123456';

describe('seller application notification adapter', () => {
  it('maps submission to the reusable template, reference and tracking link', () => {
    const request = sellerApplicationEmail(
      { kind: 'SUBMITTED', referenceCode },
      origin,
      toEmail,
    );
    expect(request.template).toBe('seller-application-received');
    expect(request.toEmail).toBe(toEmail);
    const email = renderEmailTemplate(request);
    expect(email.text).toContain(referenceCode);
    expect(email.text).toContain('https://seller.example.test/application');
    expect(email.text).toMatch(/edit your application before/u);
    expect(email.html).toContain('<a href=');
  });

  it('includes an applicant-facing rejection reason', () => {
    const request = sellerApplicationEmail(
      { kind: 'REJECTED', referenceCode, reason: 'The submitted trade licence is not valid.' },
      origin,
      toEmail,
    );
    expect(request.template).toBe('seller-application-rejected');
    expect(renderEmailTemplate(request).text).toContain('The submitted trade licence is not valid.');
  });

  it('maps all queued marketplace events to registered templates', () => {
    const kinds = [
      'SUBMITTED',
      'RESUBMITTED',
      'CORRECTIONS_REQUESTED',
      'REJECTED',
      'APPROVED',
      'APPLICATION_APPROVED',
      'ACCESS_CODE',
      'CONTACT_EMAIL_CHANGED',
    ] as const;
    const templates = kinds.map((kind) => {
      const request = sellerApplicationEmail({
        kind,
        referenceCode,
        reason: 'Please provide valid documents.',
        activationToken: 'x'.repeat(43),
        code: '123456',
      }, origin, toEmail);
      expect(renderEmailTemplate(request).text).toContain(referenceCode);
      return request.template;
    });
    expect(new Set(templates).size).toBe(kinds.length);
  });

  it('sends an approval notification with login URL and no invitation', () => {
    const request = sellerApplicationEmail(
      { kind: 'APPLICATION_APPROVED', referenceCode },
      origin,
      toEmail,
    );
    expect(request.template).toBe('seller-application-approved');
    const rendered = renderEmailTemplate(request);
    expect(rendered.text).toContain('sign in with your existing verified email');
    expect(rendered.text).toContain('https://seller.example.test/login');
    expect(rendered.text).not.toContain('/activate#token=');
  });

  it('sends rejection reason without creating new credentials', () => {
    const request = sellerApplicationEmail(
      { kind: 'REJECTED', referenceCode, reason: 'Trade license verification failed.' },
      origin,
      toEmail,
    );
    expect(renderEmailTemplate(request).text).toContain('Trade license verification failed.');
    expect(renderEmailTemplate(request).text).not.toContain('/activate#token=');
  });

  it('keeps invitation tokens in the fragment, not in web server query logs', () => {
    const request = sellerApplicationEmail(
      { kind: 'APPROVED', referenceCode, activationToken: 'x'.repeat(43) },
      origin,
      toEmail,
    );
    const rendered = renderEmailTemplate(request);
    expect(rendered.text).toContain('/activate#token=');
    expect(rendered.text).not.toContain('/activate?token=');
  });

  it('requires an activation token and an HTTPS origin outside localhost', () => {
    expect(() => sellerApplicationEmail(
      { kind: 'APPROVED', referenceCode },
      origin,
      toEmail,
    )).toThrow();
    expect(() => sellerApplicationEmail(
      { kind: 'APPROVED', referenceCode, activationToken: 'secret' },
      'http://example.org',
      toEmail,
    )).toThrow();
  });
});
