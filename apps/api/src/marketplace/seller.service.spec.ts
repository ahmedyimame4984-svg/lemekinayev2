import {
  AccountStatus,
  AccountType,
  SellerApprovalStatus,
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import type { DatabaseService } from '../database/database.service.js';
import { AdminSellerSortBy } from './dto/seller.dto.js';
import { SellerService } from './seller.service.js';

describe('SellerService', () => {
  const seller = {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const user = { findUnique: vi.fn(), update: vi.fn() };
  const auditLog = { create: vi.fn() };
  const database = {
    seller,
    user,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ seller, user, auditLog }),
    ),
  };
  const service = new SellerService(database as unknown as DatabaseService);

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const sellerUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const now = new Date('2026-10-01T06:00:00.000Z');

  beforeEach(() => {
    // clearAllMocks retains unconsumed mockResolvedValueOnce results, leaking
    // stale Seller approval versions into later lifecycle tests.
    vi.resetAllMocks();
    database.$transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ seller, user, auditLog }),
    );
    user.findUnique.mockResolvedValue({
      id: sellerUserId,
      accountType: AccountType.SELLER,
    });
    seller.create.mockResolvedValue({
      id: sellerId,
      userId: sellerUserId,
      sellerCode: 'SEL-001',
      businessName: 'Demo Seller',
      displayName: 'Demo Seller',
      sellerType: SellerType.RETAILER,
      verificationStatus: SellerVerificationStatus.PENDING,
      approvalStatus: SellerApprovalStatus.PENDING,
      status: SellerStatus.APPLICATION,
      version: 1,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    user.update.mockResolvedValue({});
    seller.updateMany.mockResolvedValue({ count: 1 });
    auditLog.create.mockResolvedValue({});
  });

  it('summarizes Seller governance without loading Seller records', async () => {
    seller.groupBy.mockResolvedValue([
      { status: SellerStatus.APPLICATION, _count: { _all: 7 } },
      { status: SellerStatus.ACTIVE, _count: { _all: 24 } },
      { status: SellerStatus.SUSPENDED, _count: { _all: 3 } },
      { status: SellerStatus.INACTIVE, _count: { _all: 2 } },
    ]);
    seller.count.mockResolvedValue(9);

    await expect(service.getAdminSummary()).resolves.toEqual({
      total: 36,
      active: 24,
      suspended: 3,
      pendingReview: 9,
    });

    expect(seller.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    expect(seller.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: SellerStatus.APPLICATION },
          {
            verificationStatus: {
              in: [
                SellerVerificationStatus.PENDING,
                SellerVerificationStatus.UNDER_REVIEW,
              ],
            },
          },
          { approvalStatus: SellerApprovalStatus.PENDING },
        ],
      },
    });
    expect(seller.findMany).not.toHaveBeenCalled();
  });

  it('pages Seller governance records with server-side search and lifecycle filters', async () => {
    const record = {
      id: sellerId,
      userId: sellerUserId,
      sellerCode: 'SEL-001',
      businessName: 'Demo Seller',
      displayName: 'Demo Seller',
      sellerType: SellerType.RETAILER,
      verificationStatus: SellerVerificationStatus.VERIFIED,
      approvalStatus: SellerApprovalStatus.APPROVED,
      status: SellerStatus.ACTIVE,
      version: 2,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    seller.count.mockResolvedValue(73);
    seller.findMany.mockResolvedValue([record]);

    await expect(
      service.listAdminPage({
        search: 'demo',
        status: SellerStatus.ACTIVE,
        verificationStatus: SellerVerificationStatus.VERIFIED,
        approvalStatus: SellerApprovalStatus.APPROVED,
        sellerType: SellerType.RETAILER,
        sortBy: AdminSellerSortBy.BUSINESS_NAME,
        sortDirection: AdminSortDirection.ASC,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [record],
      total: 73,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: SellerStatus.ACTIVE,
      approvalStatus: SellerApprovalStatus.APPROVED,
      verificationStatus: SellerVerificationStatus.VERIFIED,
      sellerType: SellerType.RETAILER,
      OR: [
        { sellerCode: { contains: 'demo', mode: 'insensitive' } },
        { businessName: { contains: 'demo', mode: 'insensitive' } },
        { displayName: { contains: 'demo', mode: 'insensitive' } },
      ],
    };
    expect(seller.count).toHaveBeenCalledWith({ where });
    expect(seller.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [
        { businessName: 'asc' },
        { sellerCode: 'asc' },
        { id: 'asc' },
      ],
      skip: 25,
      take: 25,
    });
  });

  it('uses recently updated Seller governance order by default', async () => {
    seller.count.mockResolvedValue(0);
    seller.findMany.mockResolvedValue([]);

    await service.listAdminPage({
      page: 1,
      pageSize: 50,
    });

    expect(seller.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
    );
  });

  it('creates a governed Seller profile only for SELLER accounts', async () => {
    const result = await service.createAdmin(
      {
        userId: sellerUserId,
        sellerCode: ' sel-001 ',
        businessName: ' Demo Seller ',
        displayName: ' Demo Seller ',
        sellerType: SellerType.RETAILER,
      },
      actorId,
    );

    expect(seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: sellerUserId,
          sellerCode: 'SEL-001',
        }),
      }),
    );
    expect(result.id).toBe(sellerId);
    expect(auditLog.create).toHaveBeenCalled();
  });

  it('rejects Seller profile creation for a non-Seller account', async () => {
    user.findUnique.mockResolvedValue({
      id: sellerUserId,
      accountType: AccountType.CUSTOMER,
    });

    await expect(
      service.createAdmin(
        {
          userId: sellerUserId,
          sellerCode: 'SEL-001',
          businessName: 'Demo Seller',
          displayName: 'Demo Seller',
          sellerType: SellerType.RETAILER,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_ACCOUNT_TYPE_REQUIRED' },
    });
  });

  it('requires activated Seller credentials before Admin activation', async () => {
    seller.findUnique.mockResolvedValue({
      id: sellerId,
      userId: sellerUserId,
      version: 1,
      verificationStatus: SellerVerificationStatus.VERIFIED,
      approvalStatus: SellerApprovalStatus.APPROVED,
      status: SellerStatus.APPLICATION,
      approvedAt: now,
      user: { sellerCredential: null },
    });

    await expect(
      service.updateAdmin(
        sellerId,
        { version: 1, status: SellerStatus.ACTIVE },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_CREDENTIAL_REQUIRED' },
    });
  });

  it('activates the linked User when the governed Seller becomes Active', async () => {
    seller.findUnique
      .mockResolvedValueOnce({
        id: sellerId,
        userId: sellerUserId,
        version: 1,
        verificationStatus: SellerVerificationStatus.VERIFIED,
        approvalStatus: SellerApprovalStatus.APPROVED,
        status: SellerStatus.APPLICATION,
        approvedAt: now,
        user: { sellerCredential: { userId: sellerUserId } },
      })
      .mockResolvedValueOnce({
        id: sellerId,
        userId: sellerUserId,
        sellerCode: 'SEL-001',
        businessName: 'Demo Seller',
        displayName: 'Demo Seller',
        sellerType: SellerType.RETAILER,
        verificationStatus: SellerVerificationStatus.VERIFIED,
        approvalStatus: SellerApprovalStatus.APPROVED,
        status: SellerStatus.ACTIVE,
        version: 2,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      });

    const result = await service.updateAdmin(
      sellerId,
      { version: 1, status: SellerStatus.ACTIVE },
      actorId,
    );

    expect(user.update).toHaveBeenCalledWith({
      where: { id: sellerUserId },
      data: { status: AccountStatus.ACTIVE },
    });
    expect(result.status).toBe(SellerStatus.ACTIVE);
  });

  it('requires business application review instead of direct Seller approval even with credentials', async () => {
    seller.findUnique.mockResolvedValueOnce({
      id: sellerId,
      userId: sellerUserId,
      version: 1,
      verificationStatus: SellerVerificationStatus.VERIFIED,
      approvalStatus: SellerApprovalStatus.PENDING,
      status: SellerStatus.APPLICATION,
      approvedAt: null,
      user: {
        status: AccountStatus.PROVISIONED,
        sellerCredential: { userId: sellerUserId },
      },
    });

    await expect(service.updateAdmin(
      sellerId,
      { version: 1, approvalStatus: SellerApprovalStatus.APPROVED },
      actorId,
    )).rejects.toMatchObject({
      response: { code: 'SELLER_APPROVAL_THROUGH_APPLICATION_REQUIRED' },
    });
    expect(seller.updateMany).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it('keeps an approved Seller without credentials pending an invitation', async () => {
    seller.findUnique
      .mockResolvedValueOnce({
        id: sellerId,
        userId: sellerUserId,
        version: 1,
        verificationStatus: SellerVerificationStatus.VERIFIED,
        approvalStatus: SellerApprovalStatus.APPROVED,
        status: SellerStatus.APPLICATION,
        approvedAt: null,
        user: {
          status: AccountStatus.PROVISIONED,
          sellerCredential: null,
        },
      })
      .mockResolvedValueOnce({
        id: sellerId,
        userId: sellerUserId,
        sellerCode: 'SEL-001',
        businessName: 'Demo Seller',
        displayName: 'Demo Seller',
        sellerType: SellerType.RETAILER,
        verificationStatus: SellerVerificationStatus.VERIFIED,
        approvalStatus: SellerApprovalStatus.APPROVED,
        status: SellerStatus.APPLICATION,
        version: 2,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      });

    await service.updateAdmin(
      sellerId,
      { version: 1, verificationStatus: SellerVerificationStatus.VERIFIED },
      actorId,
    );
    expect(seller.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: SellerStatus.ACTIVE }),
      }),
    );
    expect(user.update).not.toHaveBeenCalled();
  });

  it('requires verified, approved and active Seller state for operations', async () => {
    seller.findUnique.mockResolvedValue({
      id: sellerId,
      userId: sellerUserId,
      sellerCode: 'SEL-001',
      businessName: 'Demo Seller',
      displayName: 'Demo Seller',
      sellerType: SellerType.RETAILER,
      verificationStatus: SellerVerificationStatus.VERIFIED,
      approvalStatus: SellerApprovalStatus.APPROVED,
      status: SellerStatus.ACTIVE,
      version: 2,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
      user: {
        accountType: AccountType.SELLER,
        status: AccountStatus.ACTIVE,
      },
    });

    await expect(
      service.requireOperationalSellerByUser(sellerUserId),
    ).resolves.toMatchObject({ id: sellerId, status: SellerStatus.ACTIVE });
  });
});
