import { describe, expect, it } from 'vitest';
import { resolveSellerEmailOrigin } from './seller-email-origin.js';

describe('Seller invitation and tracking link origin', () => {
  it('accepts a local development URL with a protocol', () => {
    expect(resolveSellerEmailOrigin('http://localhost:3002', 'development'))
      .toBe('http://localhost:3002');
  });

  it('accepts an HTTPS production origin', () => {
    expect(resolveSellerEmailOrigin('https://seller.example.com', 'production'))
      .toBe('https://seller.example.com');
  });

  it.each([
    'localhost:3002',
    'http://example.com',
    'ftp://seller.example.com',
    'https://seller.example.com/activate?token=test',
    'https://user:secret@seller.example.com',
  ])('rejects unsafe or malformed origins: %s', (origin) => {
    expect(() => resolveSellerEmailOrigin(origin, 'development'))
      .toThrow('SELLER_APP_ORIGIN');
  });

  it('requires configuration in production and allows local development fallback', () => {
    expect(() => resolveSellerEmailOrigin(undefined, 'production'))
      .toThrow('SELLER_APP_ORIGIN');
    expect(resolveSellerEmailOrigin(undefined, 'development'))
      .toBe('http://127.0.0.1:5002');
    expect(() => resolveSellerEmailOrigin('http://localhost:3002', 'production'))
      .toThrow('SELLER_APP_ORIGIN');
  });
});
