import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SellerArticleNumberFields } from './seller-article-number-fields';
import { emptyPendingArticleIdentifiers } from '@/lib/seller-article-identifiers';
import type { SellerArticleProductType } from '@/lib/seller-contracts';

function render(policy: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE') {
  return renderToStaticMarkup(createElement(SellerArticleNumberFields, {
    value: emptyPendingArticleIdentifiers, onChange: () => {}, brands: [],
    gtinAllowed: policy !== 'NOT_APPLICABLE', gtinRequired: policy === 'REQUIRED',
    productType: { oeReferenceRequirement: policy, crossReferenceRequirement: policy } as SellerArticleProductType,
  }));
}

describe('published Article number controls', () => {
  it('hides fields that do not apply', () => {
    const html = render('NOT_APPLICABLE');
    expect(html).not.toContain('GTIN');
    expect(html).not.toContain('OE reference');
    expect(html).not.toContain('Cross reference');
    expect(html).not.toContain('Reference issuer');
  });
  it('marks required fields', () => {
    const html = render('REQUIRED');
    expect(html).toContain('GTIN number *');
    expect(html).toContain('OE reference *');
    expect(html).toContain('Cross reference *');
  });
  it('allows optional values and contains no media controls', () => {
    const html = render('OPTIONAL');
    expect(html).toContain('GTIN number (optional)');
    expect(html).toContain('OE reference (optional)');
    expect(html).not.toContain('type="file"');
  });
  it('shows the checksum error at the GTIN field with an accessible invalid state', () => {
    const html = renderToStaticMarkup(createElement(SellerArticleNumberFields, {
      value: { ...emptyPendingArticleIdentifiers, gtinType: 'GTIN_13', gtin: '4006381333932' },
      onChange: () => {}, brands: [], gtinAllowed: true,
      productType: {
        oeReferenceRequirement: 'NOT_APPLICABLE',
        crossReferenceRequirement: 'NOT_APPLICABLE',
      } as SellerArticleProductType,
    }));
    expect(html).toContain('invalid check digit');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-describedby=');
  });

  it('clears the GTIN error when a valid check digit is entered', () => {
    const html = renderToStaticMarkup(createElement(SellerArticleNumberFields, {
      value: { ...emptyPendingArticleIdentifiers, gtinType: 'GTIN_13', gtin: '4006381333931' },
      onChange: () => {}, brands: [], gtinAllowed: true,
      productType: {
        oeReferenceRequirement: 'NOT_APPLICABLE',
        crossReferenceRequirement: 'NOT_APPLICABLE',
      } as SellerArticleProductType,
    }));
    expect(html).not.toContain('invalid check digit');
    expect(html).toContain('aria-invalid="false"');
  });
});
