import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SellerListingMedia, SellerListingMediaEmptyState } from './seller-listing-media';

describe('Seller Listing media editor', () => {
  it('renders the seller-specific media workflow without depending on a missing API export', () => {
    const html = renderToStaticMarkup(
      createElement(SellerListingMedia, {
        listingId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(html).toContain('Listing images and documents');
    expect(html).toContain('Loading Listing media');
  });
  it('does not claim there are no images when loading failed', () => {
    const html = renderToStaticMarkup(createElement(SellerListingMediaEmptyState, {
      loaded: false, loading: false, count: 0,
    }));
    expect(html).not.toContain('No verified Listing media uploaded yet.');
  });

  it('shows the empty state only after a successful empty response', () => {
    const html = renderToStaticMarkup(createElement(SellerListingMediaEmptyState, {
      loaded: true, loading: false, count: 0,
    }));
    expect(html).toContain('No verified Listing media uploaded yet.');
    const withImages = renderToStaticMarkup(createElement(SellerListingMediaEmptyState, {
      loaded: true, loading: false, count: 1,
    }));
    expect(withImages).toBe('');
  });

});
