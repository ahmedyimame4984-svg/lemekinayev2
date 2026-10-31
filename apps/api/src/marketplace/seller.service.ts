import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  Prisma,
  SellerApprovalStatus,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminSellerSortBy } from './dto/seller.dto.js';
import type {
  AdminSellerPageQueryDto,
  AdminSellerQueryDto,
  CreateSellerDto,
  SellerAdminSummaryResponseDto,
  SellerPageResponseDto,
  SellerResponseDto,
  UpdateSellerDto,
} from './dto/seller.dto.js';

const sellerSelect = {
  id: true,
  userId: true,
  sellerCode: true,
  businessName: true,
  displayName: true,
  sellerType: true,
  verificationStatus: true,
  approvalStatus: true,
  status: true,
  version: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SellerSelect;

type SellerRecord = Prisma.SellerGetPayload<{ select: typeof sellerSelect }>;

@Injectable()
export class SellerService {
  constructor(private readonly database: DatabaseService) {}

  async listAdmin(query: AdminSellerQueryDto): Promise<SellerResponseDto[]> {
    const records = await this.database.seller.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.approvalStatus
          ? { approvalStatus: query.approvalStatus }
          : {}),
        ...(query.verificationStatus
          ? { verificationStatus: query.verificationStatus }
          : {}),
      },
      select: sellerSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toResponse(record));
  }

  async listAdminPage(
    query: AdminSellerPageQueryDto,
  ): Promise<SellerPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.SellerWhereInput = {
      status: query.status,
      approvalStatus: query.approvalStatus,
      verificationStatus: query.verificationStatus,
      sellerType: query.sellerType,
      ...(search
        ? {
            OR: [
              { sellerCode: { contains: search, mode: 'insensitive' } },
              { businessName: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const direction =
      query.sortDirection === AdminSortDirection.ASC ? 'asc' : 'desc';
    const orderBy: Prisma.SellerOrderByWithRelationInput[] =
      query.sortBy === AdminSellerSortBy.CREATED_AT
        ? [{ createdAt: direction }, { id: 'asc' }]
        : query.sortBy === AdminSellerSortBy.BUSINESS_NAME
          ? [{ businessName: direction }, { sellerCode: 'asc' }, { id: 'asc' }]
          : query.sortBy === AdminSellerSortBy.DISPLAY_NAME
            ? [{ displayName: direction }, { sellerCode: 'asc' }, { id: 'asc' }]
            : query.sortBy === AdminSellerSortBy.SELLER_CODE
              ? [{ sellerCode: direction }, { id: 'asc' }]
              : query.sortBy === AdminSellerSortBy.SELLER_TYPE
                ? [{ sellerType: direction }, { businessName: 'asc' }, { id: 'asc' }]
                : query.sortBy === AdminSellerSortBy.STATUS
                  ? [{ status: direction }, { businessName: 'asc' }, { id: 'asc' }]
                  : query.sortBy === AdminSellerSortBy.VERIFICATION_STATUS
                    ? [{ verificationStatus: direction }, { businessName: 'asc' }, { id: 'asc' }]
                    : query.sortBy === AdminSellerSortBy.APPROVAL_STATUS
                      ? [{ approvalStatus: direction }, { businessName: 'asc' }, { id: 'asc' }]
                      : [{ updatedAt: direction }, { id: 'asc' }];

    const [total, records] = await Promise.all([
      this.database.seller.count({ where }),
      this.database.seller.findMany({
        where,
        select: sellerSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.toResponse(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getAdminSummary(): Promise<SellerAdminSummaryResponseDto> {
    const [grouped, pendingReview] = await Promise.all([
      this.database.seller.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.database.seller.count({
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
      }),
    ]);

    const counts = new Map(
      grouped.map((entry) => [entry.status, entry._count._all]),
    );

    return {
      total: grouped.reduce((sum, entry) => sum + entry._count._all, 0),
      active: counts.get(SellerStatus.ACTIVE) ?? 0,
      suspended: counts.get(SellerStatus.SUSPENDED) ?? 0,
      pendingReview,
    };
  }

  async getAdmin(id: string): Promise<SellerResponseDto> {
    const record = await this.database.seller.findUnique({
      where: { id },
      select: sellerSelect,
    });
    if (!record) throw this.notFound();
    return this.toResponse(record);
  }

  async createAdmin(
    input: CreateSellerDto,
    actorId: string,
  ): Promise<SellerResponseDto> {
    const user = await this.database.user.findUnique({
      where: { id: input.userId },
      select: { id: true, accountType: true },
    });
    if (!user) {
      throw new BadRequestException({
        code: 'SELLER_USER_NOT_FOUND',
        message: 'The selected Seller user does not exist',
      });
    }
    if (user.accountType !== AccountType.SELLER) {
      throw new BadRequestException({
        code: 'SELLER_ACCOUNT_TYPE_REQUIRED',
        message: 'Seller profiles can only be linked to SELLER accounts',
      });
    }

    try {
      const created = await this.database.$transaction(
        async (transaction) => {
          const seller = await transaction.seller.create({
            data: {
              userId: input.userId,
              sellerCode: input.sellerCode.trim().toUpperCase(),
              businessName: input.businessName.trim(),
              displayName: input.displayName.trim(),
              sellerType: input.sellerType,
              createdById: actorId,
              updatedById: actorId,
            },
            select: sellerSelect,
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'SELLER_PROFILE_CREATED',
              entityType: 'Seller',
              entityId: seller.id,
              metadata: {
                userId: seller.userId,
                sellerCode: seller.sellerCode,
              },
            },
          });
          return seller;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toResponse(created);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateAdmin(
    id: string,
    input: UpdateSellerDto,
    actorId: string,
  ): Promise<SellerResponseDto> {
    const existing = await this.database.seller.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        version: true,
        verificationStatus: true,
        approvalStatus: true,
        status: true,
        approvedAt: true,
        user: {
          select: {
            status: true,
            sellerCredential: { select: { userId: true } },
          },
        },
      },
    });
    if (!existing) throw this.notFound();
    if (existing.version !== input.version) {
      throw new ConflictException({
        code: 'SELLER_VERSION_CONFLICT',
        message: 'Seller profile changed since it was loaded',
      });
    }

    // Business approvals must come through application document review.
    // The review service creates the operational Seller profile atomically.
    if (
      input.approvalStatus === SellerApprovalStatus.APPROVED &&
      existing.approvalStatus !== SellerApprovalStatus.APPROVED
    ) {
      throw new BadRequestException({
        code: 'SELLER_APPROVAL_THROUGH_APPLICATION_REQUIRED',
        message: 'Approve the verified Seller business application, not the Seller status.',
      });
    }

    const verificationStatus =
      input.verificationStatus ?? existing.verificationStatus;
    const approvalStatus = input.approvalStatus ?? existing.approvalStatus;
    // Manually provisioned Sellers can set credentials before Admin approval.
    // Once both gates pass, finalize their activation automatically.
    const activateAlreadyCredentialedSeller =
      input.status === undefined &&
      existing.status === SellerStatus.APPLICATION &&
      existing.user.status === AccountStatus.PROVISIONED &&
      Boolean(existing.user.sellerCredential) &&
      verificationStatus === SellerVerificationStatus.VERIFIED &&
      approvalStatus === SellerApprovalStatus.APPROVED;
    const status = activateAlreadyCredentialedSeller
      ? SellerStatus.ACTIVE
      : (input.status ?? existing.status);

    if (
      approvalStatus === SellerApprovalStatus.APPROVED &&
      verificationStatus !== SellerVerificationStatus.VERIFIED
    ) {
      throw new BadRequestException({
        code: 'SELLER_VERIFICATION_REQUIRED',
        message: 'Seller verification must be VERIFIED before approval',
      });
    }
    if (
      status === SellerStatus.ACTIVE &&
      (approvalStatus !== SellerApprovalStatus.APPROVED ||
        verificationStatus !== SellerVerificationStatus.VERIFIED)
    ) {
      throw new BadRequestException({
        code: 'SELLER_APPROVAL_REQUIRED',
        message:
          'Seller must be verified and approved before becoming ACTIVE',
      });
    }
    if (
      status === SellerStatus.ACTIVE &&
      !existing.user.sellerCredential
    ) {
      throw new BadRequestException({
        code: 'SELLER_CREDENTIAL_REQUIRED',
        message:
          'Seller credentials must be activated before the Seller becomes ACTIVE',
      });
    }

    const accountStatus = this.accountStatusForSellerStatus(status);

    try {
      await this.database.$transaction(
        async (transaction) => {
          const result = await transaction.seller.updateMany({
            where: { id, version: input.version },
            data: {
              ...(input.businessName !== undefined
                ? { businessName: input.businessName.trim() }
                : {}),
              ...(input.displayName !== undefined
                ? { displayName: input.displayName.trim() }
                : {}),
              ...(input.sellerType !== undefined
                ? { sellerType: input.sellerType }
                : {}),
              ...(input.verificationStatus !== undefined
                ? { verificationStatus: input.verificationStatus }
                : {}),
              ...(input.approvalStatus !== undefined
                ? { approvalStatus: input.approvalStatus }
                : {}),
              ...(input.status !== undefined || activateAlreadyCredentialedSeller
                ? { status }
                : {}),
              ...(approvalStatus === SellerApprovalStatus.APPROVED &&
              existing.approvalStatus !== SellerApprovalStatus.APPROVED
                ? { approvedAt: new Date() }
                : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          if (result.count !== 1) {
            throw new ConflictException({
              code: 'SELLER_VERSION_CONFLICT',
              message: 'Seller profile changed since it was loaded',
            });
          }
          if (input.status !== undefined || activateAlreadyCredentialedSeller) {
            await transaction.user.update({
              where: { id: existing.userId },
              data: { status: accountStatus },
            });
          }

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'SELLER_PROFILE_UPDATED',
              entityType: 'Seller',
              entityId: id,
              metadata: {
                previousVersion: input.version,
                nextVersion: input.version + 1,
                verificationStatus,
                approvalStatus,
                status,
                accountStatus:
                  input.status === undefined && !activateAlreadyCredentialedSeller
                    ? undefined
                    : accountStatus,
                activatedOnApproval: activateAlreadyCredentialedSeller,
                decisionReason: input.decisionReason?.trim() || undefined,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getAdmin(id);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async requireOperationalSellerByUser(userId: string): Promise<SellerResponseDto> {
    const seller = await this.database.seller.findUnique({
      where: { userId },
      select: {
        ...sellerSelect,
        user: {
          select: {
            accountType: true,
            status: true,
          },
        },
      },
    });
    if (
      !seller ||
      seller.user.accountType !== AccountType.SELLER ||
      seller.user.status !== AccountStatus.ACTIVE ||
      seller.status !== SellerStatus.ACTIVE ||
      seller.approvalStatus !== SellerApprovalStatus.APPROVED ||
      seller.verificationStatus !== SellerVerificationStatus.VERIFIED
    ) {
      throw new ForbiddenException({
        code: 'SELLER_NOT_OPERATIONAL',
        message: 'An approved, verified, active Seller account is required',
      });
    }
    return this.toResponse(seller);
  }

  private accountStatusForSellerStatus(status: SellerStatus): AccountStatus {
    switch (status) {
      case SellerStatus.ACTIVE:
        return AccountStatus.ACTIVE;
      case SellerStatus.SUSPENDED:
        return AccountStatus.SUSPENDED;
      case SellerStatus.BLOCKED:
        return AccountStatus.RESTRICTED;
      case SellerStatus.INACTIVE:
        return AccountStatus.DEACTIVATED;
      case SellerStatus.APPLICATION:
      default:
        return AccountStatus.PROVISIONED;
    }
  }

  private toResponse(record: SellerRecord): SellerResponseDto {
    return {
      id: record.id,
      userId: record.userId,
      sellerCode: record.sellerCode,
      businessName: record.businessName,
      displayName: record.displayName,
      sellerType: record.sellerType,
      verificationStatus: record.verificationStatus,
      approvalStatus: record.approvalStatus,
      status: record.status,
      version: record.version,
      approvedAt: record.approvedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'SELLER_NOT_FOUND',
      message: 'Seller profile was not found',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof ConflictException) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'SELLER_DUPLICATE',
        message: 'Seller user or Seller code already exists',
      });
    }
    throw error;
  }
}
