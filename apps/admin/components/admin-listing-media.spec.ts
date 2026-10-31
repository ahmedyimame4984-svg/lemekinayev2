import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminListingMedia } from './admin-listing-media';

describe('Admin Seller Listing media review', () => {
  it('loads the review component without importing missing Admin API exports', () => {
    const html = renderToStaticMarkup(
      createElement(AdminListingMedia, {
        listingId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(html).toContain('Seller-specific Listing images and documents');
    expect(html).toContain('Loading private media');
  });
});
