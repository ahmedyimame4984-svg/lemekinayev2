import { describe, expect, it } from 'vitest';
import { listingMediaIssues, type ListingMediaReadiness } from './seller-listing-readiness';

const baseline: ListingMediaReadiness = {
  imageApplicable: true, documentApplicable: true,
  imageCount: 2, minimumImages: 2, maximumImages: 6,
  documentCount: 0, minimumDocuments: 0,
  hasPrimaryImage: true, complete: true,
};

describe('Seller one-page listing readiness guidance', () => {
  it('does not claim readiness before media policy finishes loading', () => {
    expect(listingMediaIssues(null)).toContain('Image and document requirements are still loading.');
  });
  it('reports missing images, missing main photo and missing documents', () => {
    const issues = listingMediaIssues({
      ...baseline, imageCount: 1, hasPrimaryImage: false,
      minimumDocuments: 1,
    }).join(' ');
    expect(issues).toContain('at least 2 product image');
    expect(issues).toContain('main product photo');
    expect(issues).toContain('required document');
  });
  it('enforces maximum even when minimum is satisfied', () => {
    expect(listingMediaIssues({ ...baseline, imageCount: 7 })).toEqual([
      'Remove images above the maximum of 6.',
    ]);
  });
  it('allows correctly configured optional or non-applicable images', () => {
    expect(listingMediaIssues({ ...baseline, imageCount: 0, minimumImages: 0, hasPrimaryImage: false }))
      .toEqual([]);
    expect(listingMediaIssues({
      ...baseline, imageApplicable: false, imageCount: 0,
      minimumImages: 0, maximumImages: 0, hasPrimaryImage: false,
    })).toEqual([]);
  });
  it('does not hide unexpected media on a not-applicable Product Type', () => {
    expect(listingMediaIssues({
      ...baseline, imageApplicable: false, documentApplicable: false,
    }).join(' ')).toMatch(/not applicable/);
  });
  it('accepts complete media configurations', () => {
    expect(listingMediaIssues(baseline)).toEqual([]);
  });
});
