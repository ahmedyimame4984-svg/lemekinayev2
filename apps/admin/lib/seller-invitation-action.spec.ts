import { describe, expect, it } from 'vitest';
import { sellerAccountAction } from './seller-invitation-action';

describe('Seller governance invitation actions', () => {
  const approved = {
    verificationStatus: 'VERIFIED' as const,
    approvalStatus: 'APPROVED' as const,
  };

  it('does not offer invitations during account-first onboarding', () => {
    expect(sellerAccountAction({ ...approved, status: 'APPLICATION' })).toBeNull();
  });

  it('preserves Reactivate for previously suspended Sellers', () => {
    expect(sellerAccountAction({ ...approved, status: 'SUSPENDED' })).toBe('REACTIVATE');
  });

  it.each([
    { ...approved, status: 'ACTIVE' as const },
    { ...approved, status: 'INACTIVE' as const },
    { ...approved, status: 'BLOCKED' as const },
    { verificationStatus: 'PENDING' as const, approvalStatus: 'APPROVED' as const, status: 'APPLICATION' as const },
    { verificationStatus: 'VERIFIED' as const, approvalStatus: 'PENDING' as const, status: 'APPLICATION' as const },
  ])('does not invite inactive, blocked, operational or unapproved Sellers', (seller) => {
    expect(sellerAccountAction(seller)).toBeNull();
  });
});
