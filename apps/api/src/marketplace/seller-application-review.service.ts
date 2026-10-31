import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  Prisma,
  SellerApplicationDocumentStatus,
  SellerApplicationDocumentType,
  SellerApplicationStatus,
  SellerApprovalStatus,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerApplicationMailService } from './seller-application-mail.service.js';
import type {
  ApplicationDecisionDto,
  ApplicationDocumentDecisionDto,
  ApplicationPageQueryDto,
} from './dto/seller-application-review.dto.js';

const requiredDocuments = Object.values(SellerApplicationDocumentType);

@Injectable()
export class SellerApplicationReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly mail: SellerApplicationMailService,
  ) {}

  async list(query: ApplicationPageQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();
    const where: Prisma.SellerApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { referenceCode: { contains: search, mode: 'insensitive' as const } },
              { businessName: { contains: search, mode: 'insensitive' as const } },
              { contactEmail: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.database.sellerApplication.count({ where }),
      this.database.sellerApplication.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          referenceCode: true,
          businessName: true,
          contactName: true,
          contactEmail: true,
          status: true,
          version: true,
          submittedAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async get(id: string) {
    const application = await this.database.sellerApplication.findUnique({
      where: { id },
      include: {
        documents: {
          where: { isCurrent: true },
          select: {
            id: true,
            documentType: true,
            originalName: true,
            status: true,
            uploadedAt: true,
            reviewNote: true,
            isCurrent: true,
          },
        },
      },
    });
    if (!application) throw this.notFound();
    const { documents, ...fields } = application;
    return { ...fields, documents };
  }

  async decide(id: string, input: ApplicationDecisionDto, actorId: string) {
    try {
      await this.database.$transaction(async (tx) => {
        const application = await tx.sellerApplication.findUnique({
          where: { id },
          include: { documents: { where: { isCurrent: true } } },
        });
        if (!application) throw this.notFound();

        if (application.version !== input.version) throw this.conflict();
        const from = application.status;
        const startable =
          from === SellerApplicationStatus.SUBMITTED ||
          from === SellerApplicationStatus.RESUBMITTED;
        if (
          (input.action === 'START_REVIEW' && !startable) ||
          (input.action !== 'START_REVIEW' && from !== SellerApplicationStatus.UNDER_REVIEW)
        ) {
          throw this.conflict();
        }
        const reason = input.reason?.trim();
        if (
          (input.action === 'REQUEST_CORRECTIONS' || input.action === 'REJECT') &&
          (!reason || reason.length < 10)
        ) {
          throw new BadRequestException({
            code: 'APPLICATION_DECISION_REASON_REQUIRED',
            message: 'An applicant-facing reason of at least 10 characters is required',
          });
        }

        if (input.action === 'APPROVE' && !requiredDocuments.every((type) => {
          const matching = application.documents.filter((doc) => doc.documentType === type);
          return matching.length === 1 && matching[0]?.status === SellerApplicationDocumentStatus.VERIFIED;
        })) {
          throw new ConflictException({
            code: 'APPLICATION_DOCUMENTS_NOT_VERIFIED',
            message: 'All four current verification documents must be verified',
          });
        }

        const next = input.action === 'START_REVIEW'
          ? SellerApplicationStatus.UNDER_REVIEW
          : input.action === 'REQUEST_CORRECTIONS'
            ? SellerApplicationStatus.CHANGES_REQUESTED
            : input.action === 'APPROVE'
              ? SellerApplicationStatus.APPROVED
              : SellerApplicationStatus.REJECTED;

        const claimed = await tx.sellerApplication.updateMany({
          where: { id, version: input.version, status: from },
          data: {
            version: { increment: 1 },
            status: next,
            ...(input.action === 'START_REVIEW' ? { reviewedAt: new Date() } : {}),
            ...(input.action === 'REQUEST_CORRECTIONS'
              ? { correctionReason: reason } : {}),
            ...(input.action === 'APPROVE' ? { correctionReason: null, approvedAt: new Date() } : {}),
          },
        });
        if (claimed.count !== 1) throw this.conflict();

        if (input.action === 'APPROVE') {
          if (!application.ownerUserId) {
            throw new ConflictException({
              code: 'APPLICATION_ACCOUNT_REQUIRED',
              message: 'The applicant must create and verify a Seller account before approval.',
            });
          }
          const owner = await tx.user.findUnique({
            where: { id: application.ownerUserId },
            select: {
              id: true,
              email: true,
              status: true,
              accountType: true,
              emailVerifiedAt: true,
              sellerCredential: { select: { userId: true } },
              sellerProfile: { select: { id: true } },
            },
          });
          if (
            !owner ||
            owner.accountType !== AccountType.SELLER ||
            owner.status !== AccountStatus.ACTIVE ||
            !owner.emailVerifiedAt ||
            !owner.sellerCredential ||
            owner.sellerProfile ||
            owner.email?.toLowerCase() !== application.contactEmail.toLowerCase()
          ) {
            throw new ConflictException({
              code: 'APPLICATION_ACCOUNT_NOT_VERIFIED',
              message: 'A verified Seller account must own this application before approval.',
            });
          }

          const seller = await tx.seller.create({
            data: {
              userId: owner.id,
              sellerCode: application.referenceCode.replace('SLR-APP-', 'SLR-'),
              businessName: application.businessName,
              displayName: application.displayName,
              sellerType: application.sellerType,
              verificationStatus: SellerVerificationStatus.VERIFIED,
              approvalStatus: SellerApprovalStatus.APPROVED,
              status: SellerStatus.ACTIVE,
              approvedAt: new Date(),
              createdById: actorId,
              updatedById: actorId,
            },
          });
          await tx.sellerApplication.update({
            where: { id },
            data: { provisionedSellerId: seller.id },
          });
          await this.mail.queue(tx, {
            applicationId: id,
            eventKey: `approved:${id}:${input.version + 1}`,
            recipient: application.contactEmail,
            payload: {
              kind: 'APPLICATION_APPROVED',
              referenceCode: application.referenceCode,
            },
          });
        } else if (input.action === 'REJECT' || input.action === 'REQUEST_CORRECTIONS') {
          await this.mail.queue(tx, {
            applicationId: id,
            eventKey: `${input.action.toLowerCase()}:${id}:${input.version + 1}`,
            recipient: application.contactEmail,
            payload: {
              kind: input.action === 'REJECT' ? 'REJECTED' : 'CORRECTIONS_REQUESTED',
              referenceCode: application.referenceCode,
              reason,
            },
          });
        }

        await tx.sellerApplicationReviewEvent.create({
          data: {
            applicationId: id,
            actorId,
            action: input.action,
            fromStatus: from,
            toStatus: next,
            version: input.version + 1,
            reason: reason || null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: `SELLER_APPLICATION_${input.action}`,
            entityType: 'SellerApplication',
            entityId: id,
            metadata: {
              fromStatus: from,
              toStatus: next,
              version: input.version + 1,
            },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')) {
        throw this.conflict();
      }
      throw error;
    }
    return this.get(id);
  }

  async reviewDocument(
    applicationId: string,
    documentId: string,
    input: ApplicationDocumentDecisionDto,
    actorId: string,
  ) {
    await this.database.$transaction(async (tx) => {
      const application = await tx.sellerApplication.findUnique({
        where: { id: applicationId },
        select: { status: true, version: true },
      });
      if (!application) throw this.notFound();
      if (application.status !== SellerApplicationStatus.UNDER_REVIEW ||
        application.version !== input.version) throw this.conflict();
      const updated = await tx.sellerApplicationDocument.updateMany({
        where: { id: documentId, applicationId, isCurrent: true },
        data: {
          status: input.status,
          reviewNote: input.status === SellerApplicationDocumentStatus.REJECTED
            ? input.reason!.trim()
            : null,
          reviewedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw this.conflict();
      const updatedApplication = await tx.sellerApplication.updateMany({
        where: { id: applicationId, version: input.version, status: SellerApplicationStatus.UNDER_REVIEW },
        data: { version: { increment: 1 } },
      });
      if (updatedApplication.count !== 1) throw this.conflict();
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SELLER_APPLICATION_DOCUMENT_REVIEWED',
          entityType: 'SellerApplication',
          entityId: applicationId,
          metadata: { documentId, status: input.status, version: input.version + 1 },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.get(applicationId);
  }

  private notFound() {
    return new NotFoundException({
      code: 'SELLER_APPLICATION_NOT_FOUND',
      message: 'The Seller application was not found',
    });
  }

  private conflict() {
    return new ConflictException({
      code: 'SELLER_APPLICATION_VERSION_CONFLICT',
      message: 'Application review changed; reload before continuing',
    });
  }
}
