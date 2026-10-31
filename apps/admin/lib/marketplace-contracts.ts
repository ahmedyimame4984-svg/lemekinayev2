export type SellerType =
  | 'IMPORTER'
  | 'DISTRIBUTOR'
  | 'WHOLESALER'
  | 'RETAILER'
  | 'HYBRID'
  | 'OTHER';

export type SellerVerificationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

export type SellerApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SellerStatus =
  | 'APPLICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'BLOCKED';

export type SellerListingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'OUT_OF_STOCK'
  | 'INACTIVE'
  | 'ARCHIVED';

export type ProductCondition = 'NEW' | 'USED' | 'REFURBISHED' | 'OTHER';

export interface SellerRecord {
  id: string;
  userId: string;
  sellerCode: string;
  businessName: string;
  displayName: string;
  sellerType: SellerType;
  verificationStatus: SellerVerificationStatus;
  approvalStatus: SellerApprovalStatus;
  status: SellerStatus;
  version: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerInvitationResult {
  delivery: 'QUEUED' | 'SENT';
}

export interface SellerSummary {
  total: number;
  active: number;
  suspended: number;
  pendingReview: number;
}

export interface SellerPage {
  items: SellerRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateSellerInput {
  userId: string;
  sellerCode: string;
  businessName: string;
  displayName: string;
  sellerType: SellerType;
}

export interface ProvisionSellerAccountInput {
  name: string;
  phone: string;
  email?: string;
  sellerCode: string;
  businessName: string;
  displayName: string;
  sellerType: SellerType;
}

export interface SellerProvisioningRecord {
  userId: string;
  sellerId: string;
  activationToken: string;
  expiresAt: string;
}

export interface UpdateSellerInput {
  version: number;
  businessName?: string;
  displayName?: string;
  sellerType?: SellerType;
  verificationStatus?: SellerVerificationStatus;
  approvalStatus?: SellerApprovalStatus;
  status?: SellerStatus;
  decisionReason?: string;
}

export interface ListingPriceRecord {
  id: string;
  basePrice: number;
  sellingPrice: number;
  promotionalPrice: number | null;
  currency: string;
  minOrderQuantity: number;
  version: number;
}

export interface SellerListingRecord {
  id: string;
  sellerId: string;
  productId: string;
  sellerSku: string;
  condition: ProductCondition;
  sellerTitle: string | null;
  sellerDescription: string | null;
  warrantyInformation: string | null;
  deliveryInformation: string | null;
  commercialTerms: string | null;
  status: SellerListingStatus;
  reviewIntent?: boolean;
  rejectionReason: string | null;
  version: number;
  price: ListingPriceRecord | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingTransitionInput {
  version: number;
}

export interface RejectListingInput extends ListingTransitionInput {
  reason: string;
}
