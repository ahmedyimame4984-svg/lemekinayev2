import { describe, expect, it } from 'vitest';
import {
  allApplicationDocumentsVerified,
  allowedApplicationActions,
  publicAdminApplicationDetail,
  requiredApplicationDocumentTypes,
  validateApplicationDecision,
  type SellerApplicationDocument,
} from './seller-application-review';

const verifiedDocuments: SellerApplicationDocument[] =
  requiredApplicationDocumentTypes.map((documentType) => ({
    id: documentType,
    documentType,
    originalName: 'verified.pdf',
    status: 'VERIFIED',
    uploadedAt: '2026-10-10T00:00:00Z',
    reviewNote: null,
    isCurrent: true,
  }));

describe('Seller application review safeguards', () => {
  it('allows starting review only from waiting states', () => {
    expect(allowedApplicationActions('SUBMITTED')).toEqual(['START_REVIEW']);
    expect(allowedApplicationActions('RESUBMITTED')).toEqual(['START_REVIEW']);
    expect(allowedApplicationActions('APPROVED')).toEqual([]);
    expect(allowedApplicationActions('REJECTED')).toEqual([]);
    expect(allowedApplicationActions('CHANGES_REQUESTED')).toEqual([]);
  });

  it('rejects premature approval even if the documents are verified', () => {
    expect(validateApplicationDecision('SUBMITTED', { action: 'APPROVE', version: 1 }, verifiedDocuments)).toMatch(/unavailable/u);
  });

  it('requires all four verified documents to approve', () => {
    expect(allApplicationDocumentsVerified(verifiedDocuments)).toBe(true);
    expect(validateApplicationDecision('UNDER_REVIEW', { action: 'APPROVE', version: 2 }, verifiedDocuments)).toBeNull();
    expect(validateApplicationDecision('UNDER_REVIEW', { action: 'APPROVE', version: 2 }, verifiedDocuments.slice(1))).toMatch(/four required/u);
    expect(validateApplicationDecision('UNDER_REVIEW', { action: 'APPROVE', version: 2 }, [
      ...verifiedDocuments.slice(1),
      { ...verifiedDocuments[0], status: 'REJECTED' },
    ])).toMatch(/four required/u);
  });

  it('does not treat superseded verified documents as current approval evidence', () => {
    const documents = [
      ...verifiedDocuments,
      {
        ...verifiedDocuments[0],
        id: 'replacement',
        status: 'PENDING' as const,
        isCurrent: true,
      },
    ].map((document, index) =>
      index === 0 ? { ...document, isCurrent: false } : document,
    );
    expect(allApplicationDocumentsVerified(documents)).toBe(false);
  });

  it('excludes internal storage keys from the application response', () => {
    const example = {
      id: 'app-1',
      referenceCode: 'SLR-APP-2026-ABCDEF123456',
      businessName: 'Example Trading',
      contactName: 'Contact',
      contactEmail: 'contact@example.test',
      contactPhone: '+251900000000',
      businessEmail: 'business@example.test',
      businessPhone: '+251911111111',
      displayName: 'Example',
      sellerType: 'RETAILER',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      address: 'Bole',
      commercialRegistrationNumber: 'CR-1',
      tradeLicenseNumber: 'TL-1',
      tinNumber: 'TIN-1',
      vatRegistrationNumber: 'VAT-1',
      status: 'UNDER_REVIEW' as const,
      version: 2,
      submittedAt: '2026-10-09T00:00:00Z',
      updatedAt: '2026-10-10T00:00:00Z',
      correctionReason: null,
      documents: [{ ...verifiedDocuments[0], storageKey: 'private/application/document.pdf' }],
      internalReviewNote: 'private',
    };
    const result = publicAdminApplicationDetail(example);
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(JSON.stringify(result)).not.toContain('private/application');
    expect(JSON.stringify(result)).not.toContain('internalReviewNote');
    expect(result.documents).toHaveLength(1);
  });

  it('requires a useful applicant-facing reason for rejection and corrections', () => {
    for (const action of ['REJECT', 'REQUEST_CORRECTIONS'] as const) {
      expect(validateApplicationDecision('UNDER_REVIEW', { action, version: 1, reason: 'No' })).toMatch(/reason/u);
      expect(validateApplicationDecision('UNDER_REVIEW', { action, version: 1, reason: 'Details do not match the registration document.' })).toBeNull();
    }
  });

  it('rejects invalid or stale-shaped versions', () => {
    expect(validateApplicationDecision('UNDER_REVIEW', { action: 'REJECT', version: 0, reason: 'Registration information is invalid.' })).toMatch(/version/u);
  });
});
