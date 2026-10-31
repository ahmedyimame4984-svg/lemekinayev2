export const applicationSteps = [
  'Contact', 'Business', 'Registration & Tax', 'Documents', 'Review',
] as const;

export const applicationFields = [
  'contactName', 'contactPhone', 'businessName', 'displayName',
  'sellerType', 'businessEmail', 'businessPhone', 'region', 'city',
  'address', 'commercialRegistrationNumber', 'tradeLicenseNumber',
  'tinNumber', 'vatRegistrationNumber',
] as const;

export type ApplicationValues = Record<(typeof applicationFields)[number], string>;

export const initialApplicationValues: ApplicationValues = {
  contactName: '', contactPhone: '', businessName: '', displayName: '',
  sellerType: 'RETAILER', businessEmail: '', businessPhone: '',
  region: '', city: '', address: '', commercialRegistrationNumber: '',
  tradeLicenseNumber: '', tinNumber: '', vatRegistrationNumber: '',
};

export interface ApplicationDocumentRecord {
  documentType: string;
  originalName: string;
  uploadedAt: string;
  status?: string;
  reviewNote?: string | null;
}

export interface ApplicationDraft {
  step: number;
  version: number;
  values: Partial<ApplicationValues>;
  updatedAt: string;
  documents: ApplicationDocumentRecord[];
}

export interface ReviewEvent {
  action: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface SellerApplicationDetail extends ApplicationValues {
  referenceCode: string;
  contactEmail: string;
  status: 'SUBMITTED' | 'RESUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
  version: number;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  correctionReason: string | null;
  canEdit: boolean;
  documents: ApplicationDocumentRecord[];
  reviewEvents: ReviewEvent[];
}

export interface SellerApplicationWorkspace {
  contactEmail: string;
  draft: ApplicationDraft | null;
  application: SellerApplicationDetail | null;
}

export function editableApplicationStatus(status: string) {
  return status === 'SUBMITTED' || status === 'RESUBMITTED' || status === 'CHANGES_REQUESTED';
}
