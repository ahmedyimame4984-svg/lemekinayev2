import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SellerListingCompletion } from './seller-listing-completion';

describe('single-page Seller Listing completion', () => {
  it('keeps the final uploader, preview and review action in one page', () => {
    const html = renderToStaticMarkup(createElement(SellerListingCompletion, {
      listingId: '11111111-1111-4111-8111-111111111111',
      onSubmitted: vi.fn(), onSaveDraft: vi.fn(),
    }));
    expect(html).toContain('Private Draft saved');
    expect(html).toContain('Preview your Listing');
    expect(html).toContain('Listing images and documents');
    expect(html).toContain('Submit for Admin review');
    expect(html).toContain('Save Draft');
    expect(html).not.toContain('Upload successful');
  });
});
