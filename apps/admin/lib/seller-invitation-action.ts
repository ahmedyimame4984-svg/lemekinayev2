import type { SellerRecord } from './marketplace-contracts';

type SellerInviteState = Pick<
  SellerRecord,
  'verificationStatus' | 'approvalStatus' | 'status'
>;

/** A Seller must activate credentials before becoming operational. */
export function sellerAccountAction(
  seller: SellerInviteState,
): 'REACTIVATE' | null {
  if (
    seller.verificationStatus !== 'VERIFIED' ||
    seller.approvalStatus !== 'APPROVED'
  ) {
    return null;
  }
  if (seller.status === 'SUSPENDED') return 'REACTIVATE';
  return null;
}
