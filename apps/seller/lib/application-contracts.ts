export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

export interface ApplicantApplication {
  referenceCode: string;
  status: ApplicationStatus;
  version: number;
  correctionReason: string | null;
  submittedAt: string;
  updatedAt: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessName: string;
  displayName: string;
  sellerType: string;
  businessEmail: string;
  businessPhone: string;
  region: string;
  city: string;
  address: string;
  commercialRegistrationNumber: string;
  tradeLicenseNumber: string;
  tinNumber: string;
  vatRegistrationNumber: string;
  documents: Array<{
    id: string;
    documentType: 'COMMERCIAL_REGISTRATION' | 'TRADE_LICENSE' | 'TIN_CERTIFICATE' | 'VAT_REGISTRATION';
    originalName: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    uploadedAt: string;
  }>;
}

export function applicationCanEdit(status: ApplicationStatus): boolean {
  return ['SUBMITTED', 'CHANGES_REQUESTED', 'RESUBMITTED'].includes(status);
}
