import { SellerApplicationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerApplicationDraftService } from './seller-application-draft.service.js';
import type { SellerApplicationEditService } from './seller-application-edit.service.js';
import { SellerApplicationWorkspaceController } from './seller-application-workspace.controller.js';

const principal = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
const fullInput = {
  version: 2,
  contactName: 'Seller Owner', contactEmail: 'forged@example.com',
  contactPhone: '+251911111111',
  businessName: 'Auto Parts', displayName: 'Auto Parts',
  sellerType: 'RETAILER', businessEmail: 'business@example.com',
  businessPhone: '+251911111111', region: 'Addis Ababa', city: 'Addis Ababa',
  address: 'Bole, Addis Ababa', commercialRegistrationNumber: 'CR-123',
  tradeLicenseNumber: 'TL-123', tinNumber: 'TIN-123', vatRegistrationNumber: 'VAT-123',
  termsAccepted: 'true',
} as const;

function setup(status: SellerApplicationStatus) {
  const drafts = {
    requireAccount: vi.fn().mockResolvedValue({ userId: principal.userId, email: 'verified@example.com' }),
    get: vi.fn().mockResolvedValue({ contactEmail: 'verified@example.com' }),
  };
  const database = {
    sellerApplication: {
      findFirst: vi.fn().mockResolvedValue({ id: 'application-id', status }),
    },
  };
  const edits = { update: vi.fn().mockResolvedValue({ version: 3 }) };
  const controller = new SellerApplicationWorkspaceController(
    drafts as unknown as SellerApplicationDraftService,
    database as unknown as DatabaseService,
    edits as unknown as SellerApplicationEditService,
  );
  return { controller, drafts, database, edits };
}

describe('Account-owned Seller application editor', () => {
  it('permits editing a submitted application before Admin starts review', async () => {
    const { controller, database, edits } = setup(SellerApplicationStatus.SUBMITTED);
    await controller.update(principal as never, { ...fullInput } as never, {});
    expect(database.sellerApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: principal.userId } }),
    );
    expect(edits.update).toHaveBeenCalledWith(
      'application-id',
      expect.objectContaining({ contactEmail: 'verified@example.com' }),
      {},
    );
  });

  it('locks changes as soon as Admin marks the application UNDER_REVIEW', async () => {
    const { controller, edits } = setup(SellerApplicationStatus.UNDER_REVIEW);
    await expect(controller.update(principal as never, { ...fullInput } as never, {}))
      .rejects.toMatchObject({ response: { code: 'SELLER_APPLICATION_REVIEW_LOCKED' } });
    expect(edits.update).not.toHaveBeenCalled();
  });

  it('allows requested corrections to be resubmitted by the same account', async () => {
    const { controller, edits } = setup(SellerApplicationStatus.CHANGES_REQUESTED);
    await controller.update(principal as never, { ...fullInput } as never, {});
    expect(edits.update).toHaveBeenCalledOnce();
  });
});
