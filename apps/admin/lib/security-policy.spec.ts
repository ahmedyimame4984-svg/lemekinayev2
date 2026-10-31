import { describe, it, expect } from 'vitest';
import { contentSecurityPolicy } from './security-policy';

describe('Admin content security policy', () => {
  it('authorizes only nonce-bearing scripts in production', () => {
    const policy = contentSecurityPolicy('test-nonce', false);
    const scriptDirective = policy
      .split('; ')
      .find((part) => part.startsWith('script-src'));
    expect(scriptDirective).toContain("'nonce-test-nonce'");
    expect(scriptDirective).not.toContain('unsafe-inline');
    expect(scriptDirective).not.toContain('unsafe-eval');
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self'");
    // Private image/PDF previews are fetched with authorization and rendered as
    // short-lived in-memory Blob URLs. They must be allowed by the parent page.
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("frame-src 'self' blob:");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("script-src 'self' blob:");
  });
});
