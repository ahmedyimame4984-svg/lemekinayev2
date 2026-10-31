import { AccountStatus, AccountType, SellerApplicationDocumentStatus, SellerApplicationDocumentType, SellerApplicationStatus, SellerType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SellerApplicationReviewService } from './seller-application-review.service.js';

const application = {
  id: 'application-id', version: 2, ownerUserId: 'user-id',
  status: SellerApplicationStatus.UNDER_REVIEW,
  contactEmail: 'seller@example.com', referenceCode: 'SLR-APP-2026-ABC',
  businessName: 'Business', displayName: 'Business',
  sellerType: SellerType.RETAILER,
  documents: Object.values(SellerApplicationDocumentType).map(documentType => ({
    documentType, status: SellerApplicationDocumentStatus.VERIFIED,
  })),
};

function setup() {
  const tx = {
    sellerApplication: {
      findUnique: vi.fn().mockResolvedValue(application),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-id', email: 'seller@example.com',
        accountType: AccountType.SELLER, status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(), sellerCredential: { userId: 'user-id' },
        sellerProfile: null,
      }),
      create: vi.fn(),
    },
    seller: { create: vi.fn().mockResolvedValue({ id: 'seller-id' }) },
    sellerApplicationReviewEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const database = {
    sellerApplication: tx.sellerApplication,
    $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const mail = { queue: vi.fn() };
  const service = new SellerApplicationReviewService(database as never, mail as never);
  return { service, tx, mail };
}

describe('Seller application account-first decisions', () => {
  it('approves a verified existing account without a new User or invitation', async () => {
    const { service, tx, mail } = setup();
    await service.decide('application-id', { action: 'APPROVE', version: 2 }, 'actor-id');
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.seller.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-id', status: 'ACTIVE' }),
    }));
    expect(mail.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      payload: { kind: 'APPLICATION_APPROVED', referenceCode: application.referenceCode },
    }));
  });

  it('keeps rejected applicants signed up and queues the reason', async () => {
    const { service, tx, mail } = setup();
    await service.decide('application-id', {
      action: 'REJECT', version: 2, reason: 'The trade license was not verifiable.',
    }, 'actor-id');
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.seller.create).not.toHaveBeenCalled();
    expect(mail.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      payload: expect.objectContaining({ kind: 'REJECTED' }),
    }));
  });

  it('refuses approval until the application has a verified account owner', async () => {
    const { service, tx } = setup();
    tx.sellerApplication.findUnique.mockResolvedValue({
      ...application, ownerUserId: null,
    });
    await expect(service.decide(
      'application-id', { action: 'APPROVE', version: 2 }, 'actor-id',
    )).rejects.toMatchObject({
      response: { code: 'APPLICATION_ACCOUNT_REQUIRED' },
    });
    expect(tx.seller.create).not.toHaveBeenCalled();
  });
});
