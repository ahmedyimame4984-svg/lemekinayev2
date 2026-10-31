import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SellerManagementTabs } from './seller-management-tabs';

describe('SellerManagementTabs', () => {
  it.each([
    ['sellers', 0],
    ['applications', 1],
    ['listings', 2],
  ] as const)('marks the %s Seller management tab active', (activeTab, activeIndex) => {
    const markup = renderToStaticMarkup(
      createElement(SellerManagementTabs, { activeTab }),
    );
    const links = [...markup.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gu)];

    expect(markup).toContain('class="catalog-tabs"');
    expect(links).toHaveLength(3);
    expect(links[0]?.[1]).toContain('href="/admin/marketplace/sellers"');
    expect(links[1]?.[1]).toContain('href="/admin/marketplace/sellers?tab=applications"');
    expect(links[2]?.[1]).toContain('href="/admin/marketplace/listings"');
    expect(links[0]?.[2]).toBe('Sellers');
    expect(links[1]?.[2]).toBe('Open Applications');
    expect(links[2]?.[2]).toBe('Listing Reviews');
    expect(links[activeIndex]?.[1]).toContain('aria-current="page"');
    for (const [index, link] of links.entries()) {
      if (index !== activeIndex) expect(link[1]).not.toContain('aria-current="page"');
    }
  });
});
