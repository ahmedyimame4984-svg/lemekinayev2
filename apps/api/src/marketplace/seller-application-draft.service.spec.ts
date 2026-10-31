import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerRegistrationDocumentStorage } from './seller-registration-document-storage.service.js';
import { SellerApplicationDraftService } from './seller-application-draft.service.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sampleDraft = {
  userId, version: 2, step: 2,
  values: { contactName: 'Seller Owner', businessName: 'Auto Parts' },
  documents: [],
  updatedAt: new Date(),
};

function setup() {
  const user = {
    findUnique: vi.fn().mockResolvedValue({
      id: userId, email: 'seller@example.com', emailVerifiedAt: new Date(),
      accountType: 'SELLER', status: 'ACTIVE',
    }),
  };
  const sellerApplication = { findFirst: vi.fn().mockResolvedValue(null) };
  const sellerApplicationDraft = {
    findUnique: vi.fn().mockResolvedValue(sampleDraft),
    create: vi.fn().mockResolvedValue(sampleDraft),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const sellerApplicationDraftDocument = {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  };
  const database = {
    user, sellerApplication, sellerApplicationDraft, sellerApplicationDraftDocument,
    $transaction: vi.fn((callback: (client: unknown) => unknown) =>
      callback({ sellerApplicationDraftDocument })),
  };
  const storage = {
    store: vi.fn().mockResolvedValue({
      documentType: 'VAT_REGISTRATION', originalName: 'vat.pdf',
      storageKey: userId + '/vat.pdf', mimeType: 'application/pdf', sizeBytes: 9,
    }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const service = new SellerApplicationDraftService(
    database as unknown as DatabaseService,
    storage as unknown as SellerRegistrationDocumentStorage,
  );
  return { database, storage, service };
}

describe('SellerApplicationDraftService', () => {
  it('restores the verified Seller email and last saved step', async () => {
    const { service } = setup();
    const result = await service.get(userId);
    expect(result.contactEmail).toBe('seller@example.com');
    expect(result.draft).toMatchObject({ step: 2, version: 2 });
    expect(result.application).toBeNull();
  });

  it('saves only allowed business fields and increments draft version', async () => {
    const { service, database } = setup();
    await service.save(userId, {
      step: 3, version: 2,
      values: { contactName: 'Seller Owner', businessName: 'Auto Parts' },
    });
    expect(database.sellerApplicationDraft.updateMany).toHaveBeenCalledWith({
      where: { userId, version: 2 },
      data: expect.objectContaining({
        step: 3, version: { increment: 1 },
        values: { contactName: 'Seller Owner', businessName: 'Auto Parts' },
      }),
    });
  });

  it('rejects browser-supplied contact email, identity and extraneous draft fields', async () => {
    const { service, database } = setup();
    await expect(service.save(userId, {
      step: 0, version: 2,
      values: { contactEmail: 'attacker@example.com' },
    })).rejects.toMatchObject({ response: { code: 'SELLER_DRAFT_FIELDS_UNEXPECTED' } });
    expect(database.sellerApplicationDraft.updateMany).not.toHaveBeenCalled();
  });

  it('does not allow overwriting another tab\'s newer draft version', async () => {
    const { service, database } = setup();
    database.sellerApplicationDraft.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.save(userId, {
      step: 2, version: 1, values: { contactName: 'Seller Owner' },
    })).rejects.toMatchObject({ response: { code: 'SELLER_DRAFT_VERSION_CONFLICT' } });
  });

  it('denies drafts after a business application is submitted', async () => {
    const { service, database } = setup();
    database.sellerApplication.findFirst.mockResolvedValue({ id: 'app-id' });
    await expect(service.save(userId, {
      step: 1, version: 2, values: { contactName: 'Seller Owner' },
    })).rejects.toMatchObject({ response: { code: 'SELLER_APPLICATION_ALREADY_SUBMITTED' } });
  });

  it('denies draft access to an unverified Seller account', async () => {
    const { service, database } = setup();
    database.user.findUnique.mockResolvedValue({
      id: userId, email: 'seller@example.com', emailVerifiedAt: null,
      accountType: 'SELLER', status: 'ACTIVE',
    });
    await expect(service.get(userId)).rejects.toMatchObject({
      response: { code: 'SELLER_ACCOUNT_VERIFICATION_REQUIRED' },
    });
  });
});
