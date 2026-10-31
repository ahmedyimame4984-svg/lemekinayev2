import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SellerApplicationDetail } from '@/lib/seller-application-review';
import { SellerApplicationDocuments } from './seller-application-documents';

const document = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  documentType: 'TRADE_LICENSE' as const,
  originalName: 'trade-license.pdf',
  status: 'PENDING' as const,
  uploadedAt: '2026-10-10T00:00:00.000Z',
  reviewNote: null,
  isCurrent: true,
};

function sampleApplication(
  status: SellerApplicationDetail['status'],
): SellerApplicationDetail {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    referenceCode: 'SLR-APP-2026-ABCDEF123456',
    businessName: 'Example Business',
    contactName: 'Example',
    contactEmail: 'example@test.invalid',
    contactPhone: '+251900000000',
    businessEmail: 'example@test.invalid',
    businessPhone: '+251900000000',
    displayName: 'Example',
    sellerType: 'RETAILER',
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    address: 'Bole',
    commercialRegistrationNumber: 'CR-100',
    tradeLicenseNumber: 'TL-100',
    tinNumber: 'TIN-100',
    vatRegistrationNumber: 'VAT-100',
    status,
    version: 1,
    submittedAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
    correctionReason: null,
    documents: [document],
  };
}

describe('Seller application document viewer access', () => {
  it.each(['SUBMITTED', 'RESUBMITTED', 'CHANGES_REQUESTED'] as const)(
    'offers preview and download before review in %s',
    (status) => {
      const html = renderToStaticMarkup(
        createElement(SellerApplicationDocuments, {
          application: sampleApplication(status),
          working: false,
          onReview: async () => undefined,
        }),
      );
      expect(html).toContain('Download');
      expect(html).toContain('View full screen');
      expect(html).toContain('trade-license.pdf');
      expect(html).not.toContain('Verify document');
      expect(html).not.toContain('Reject document');
    },
  );

  it('shows verification actions only after Admin starts reviewing', () => {
    const html = renderToStaticMarkup(
      createElement(SellerApplicationDocuments, {
        application: sampleApplication('UNDER_REVIEW'),
        working: false,
        onReview: async () => undefined,
      }),
    );
    expect(html).toContain('Download');
    expect(html).toContain('View full screen');
    expect(html).toContain('Verify document');
    expect(html).toContain('Reject document');
  });

  it('keeps independent review fields and view actions beside every document', () => {
    const application = sampleApplication('UNDER_REVIEW');
    application.documents.push({
      ...document,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      documentType: 'TIN_CERTIFICATE',
      originalName: 'tin-certificate.pdf',
    });

    const html = renderToStaticMarkup(
      createElement(SellerApplicationDocuments, {
        application,
        working: false,
        onReview: async () => undefined,
      }),
    );

    expect(html).toContain('trade-license.pdf');
    expect(html).toContain('tin-certificate.pdf');
    expect((html.match(/View full screen/gu) ?? [])).toHaveLength(2);
    expect((html.match(/Verify document/gu) ?? [])).toHaveLength(2);
    expect((html.match(/Reject document/gu) ?? [])).toHaveLength(2);
    expect((html.match(/<textarea\b/gu) ?? [])).toHaveLength(2);
    expect(html).not.toContain('Select verification document');
  });

  it('does not offer preview links when an application is missing documents', () => {
    const application = sampleApplication('SUBMITTED');
    application.documents = [];
    const html = renderToStaticMarkup(
      createElement(SellerApplicationDocuments, {
        application,
        working: false,
        onReview: async () => undefined,
      }),
    );
    expect(html).toContain('0 of 4 uploaded');
    expect((html.match(/Missing document/gu) ?? [])).toHaveLength(4);
    expect(html).not.toContain('View full screen');
    expect(html).not.toContain('href="/api/admin/seller-applications/');
  });
});
