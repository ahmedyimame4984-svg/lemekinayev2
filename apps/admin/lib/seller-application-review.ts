export type SellerApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

export type SellerApplicationDocumentType =
  | 'COMMERCIAL_REGISTRATION'
  | 'TRADE_LICENSE'
  | 'TIN_CERTIFICATE'
  | 'VAT_REGISTRATION';

export type SellerApplicationReviewAction =
  | 'START_REVIEW'
  | 'REQUEST_CORRECTIONS'
  | 'APPROVE'
  | 'REJECT';

export interface SellerApplicationSummary {
  id: string;
  referenceCode: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  status: SellerApplicationStatus;
  version: number;
  submittedAt: string;
  updatedAt: string;
}

export interface SellerApplicationDocument {
  id: string;
  documentType: SellerApplicationDocumentType;
  originalName: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  uploadedAt: string;
  reviewNote: string | null;
  isCurrent: boolean;
}

export interface SellerApplicationDetail extends SellerApplicationSummary {
  businessEmail: string;
  businessPhone: string;
  contactPhone: string;
  displayName: string;
  sellerType: string;
  region: string;
  city: string;
  address: string;
  commercialRegistrationNumber: string;
  tradeLicenseNumber: string;
  tinNumber: string;
  vatRegistrationNumber: string;
  correctionReason: string | null;
  documents: SellerApplicationDocument[];
}

export interface SellerApplicationPage {
  items: SellerApplicationSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface SellerApplicationDecision {
  action: SellerApplicationReviewAction;
  version: number;
  reason?: string;
}

export const requiredApplicationDocumentTypes: SellerApplicationDocumentType[] = [
  'COMMERCIAL_REGISTRATION',
  'TRADE_LICENSE',
  'TIN_CERTIFICATE',
  'VAT_REGISTRATION',
];

export const applicationDocumentNames: Record<SellerApplicationDocumentType, string> = {
  COMMERCIAL_REGISTRATION: 'Commercial Registration Certificate',
  TRADE_LICENSE: 'Trade / Business Licence',
  TIN_CERTIFICATE: 'TIN Certificate',
  VAT_REGISTRATION: 'VAT Registration Certificate',
};

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 1000;

export function allowedApplicationActions(
  status: SellerApplicationStatus,
): SellerApplicationReviewAction[] {
  if (status === 'SUBMITTED' || status === 'RESUBMITTED') {
    return ['START_REVIEW'];
  }
  if (status === 'UNDER_REVIEW') {
    return ['REQUEST_CORRECTIONS', 'APPROVE', 'REJECT'];
  }
  return [];
}

export function allApplicationDocumentsVerified(
  documents: SellerApplicationDocument[],
): boolean {
  return requiredApplicationDocumentTypes.every((documentType) => {
    const currentVersions = documents.filter(
      (document) => document.documentType === documentType && document.isCurrent === true,
    );
    return currentVersions.length === 1 && currentVersions[0]?.status === 'VERIFIED';
  });
}

export function validateApplicationDecision(
  status: SellerApplicationStatus,
  decision: SellerApplicationDecision,
  documents: SellerApplicationDocument[] = [],
): string | null {
  if (!allowedApplicationActions(status).includes(decision.action)) {
    return 'This action is unavailable for the current application status.';
  }
  if (!Number.isSafeInteger(decision.version) || decision.version < 1) {
    return 'The application version is invalid. Reload and try again.';
  }
  if (decision.action === 'APPROVE' && !allApplicationDocumentsVerified(documents)) {
    return 'All four required documents must be verified before approval.';
  }
  if (
    decision.action === 'REQUEST_CORRECTIONS' ||
    decision.action === 'REJECT'
  ) {
    const length = decision.reason?.trim().length ?? 0;
    if (length < MIN_REASON_LENGTH || length > MAX_REASON_LENGTH) {
      return 'Provide an applicant-facing reason of 10–1000 characters.';
    }
  }
  return null;
}

export function formatApplicationStatus(status: SellerApplicationStatus): string {
  return status.toLowerCase().replaceAll('_', ' ').replace(/^./u, (char) => char.toUpperCase());
}

/** Only expose the fields needed by authorized Admin reviewers. */
export function publicAdminApplicationDetail(
  application: SellerApplicationDetail,
): SellerApplicationDetail {
  return {
    id: application.id,
    referenceCode: application.referenceCode,
    businessName: application.businessName,
    contactName: application.contactName,
    contactEmail: application.contactEmail,
    contactPhone: application.contactPhone,
    businessEmail: application.businessEmail,
    businessPhone: application.businessPhone,
    displayName: application.displayName,
    sellerType: application.sellerType,
    region: application.region,
    city: application.city,
    address: application.address,
    commercialRegistrationNumber: application.commercialRegistrationNumber,
    tradeLicenseNumber: application.tradeLicenseNumber,
    tinNumber: application.tinNumber,
    vatRegistrationNumber: application.vatRegistrationNumber,
    status: application.status,
    version: application.version,
    submittedAt: application.submittedAt,
    updatedAt: application.updatedAt,
    correctionReason: application.correctionReason,
    documents: application.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      originalName: document.originalName,
      status: document.status,
      uploadedAt: document.uploadedAt,
      reviewNote: document.reviewNote,
      isCurrent: document.isCurrent === true,
    })),
  };
}
