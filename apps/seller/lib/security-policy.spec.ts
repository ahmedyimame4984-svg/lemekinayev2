import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './security-policy';

describe('Seller content security policy', () => {
  it('allows local document previews without enabling embedded plugins', () => {
    const policy = contentSecurityPolicy('test-nonce', false);

    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("frame-src 'self' blob:");
    expect(policy).toContain("object-src 'none'");
  });
});
