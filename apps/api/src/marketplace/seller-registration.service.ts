import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  Prisma,
  AccountType,
  AccountStatus,
  SellerApplicationDocumentType,
  SellerApplicationStatus,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { SellerApplicationMailService } from './seller-application-mail.service.js';
import type {
  CreateSellerApplicationDto,
  SellerApplicationSubmittedDto,
} from './dto/seller-registration.dto.js';
import {
  type StoredSellerRegistrationDocument,
  type SellerRegistrationUpload,
  SellerRegistrationDocumentStorage,
} from './seller-registration-document-storage.service.js';

export interface SellerRegistrationFiles {
  commercialRegistrationDocument?: SellerRegistrationUpload[];
  tradeLicenseDocument?: SellerRegistrationUpload[];
  tinCertificateDocument?: SellerRegistrationUpload[];
  vatRegistrationDocument?: SellerRegistrationUpload[];
}

const requiredDocuments: Array<{
  field: keyof SellerRegistrationFiles;
  type: SellerApplicationDocumentType;
}> = [
  {
    field: 'commercialRegistrationDocument',
    type: SellerApplicationDocumentType.COMMERCIAL_REGISTRATION,
  },
  {
    field: 'tradeLicenseDocument',
    type: SellerApplicationDocumentType.TRADE_LICENSE,
  },
  {
    field: 'tinCertificateDocument',
    type: SellerApplicationDocumentType.TIN_CERTIFICATE,
  },
  {
    field: 'vatRegistrationDocument',
    type: SellerApplicationDocumentType.VAT_REGISTRATION,
  },
];

@Injectable()
export class SellerRegistrationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly documents: SellerRegistrationDocumentStorage,
    private readonly mail: SellerApplicationMailService,
  ) {}

  async getOnboardingStatus(userId: string) {
    const [seller, application] = await Promise.all([
      this.database.seller.findUnique({
        where: { userId },
        select: { status: true, approvalStatus: true, verificationStatus: true },
      }),
      this.database.sellerApplication.findFirst({
        where: { ownerUserId: userId },
        orderBy: { submittedAt: 'desc' },
        select: {
          referenceCode: true,
          status: true,
          correctionReason: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      canSell:
        seller?.status === 'ACTIVE' &&
        seller.approvalStatus === 'APPROVED' &&
        seller.verificationStatus === 'VERIFIED',
      application,
    };
  }

  async submit(
    input: CreateSellerApplicationDto,
    files: SellerRegistrationFiles,
    sourceIpHash: string,
    userId: string,
  ): Promise<SellerApplicationSubmittedDto> {
    const normalized = {
      contactName: input.contactName.trim(),
      contactEmail: '',
      contactPhone: this.normalizePhone(input.contactPhone),
      businessName: input.businessName.trim(),
      displayName: input.displayName.trim(),
      sellerType: input.sellerType,
      businessEmail: input.businessEmail.trim().toLowerCase(),
      businessPhone: this.normalizePhone(input.businessPhone),
      region: input.region.trim(),
      city: input.city.trim(),
      address: input.address.trim(),
      commercialRegistrationNumber:
        input.commercialRegistrationNumber.trim().toUpperCase(),
      tradeLicenseNumber: input.tradeLicenseNumber.trim().toUpperCase(),
      tinNumber: input.tinNumber.trim().toUpperCase(),
      vatRegistrationNumber: input.vatRegistrationNumber.trim().toUpperCase(),
    };

    const owner = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, status: true, accountType: true },
    });
    if (
      !owner || owner.accountType !== AccountType.SELLER ||
      owner.status !== AccountStatus.ACTIVE || !owner.emailVerifiedAt ||
      !owner.email
    ) {
      throw new ForbiddenException({
        code: 'SELLER_VERIFIED_ACCOUNT_REQUIRED',
        message: 'Sign in with the verified email address used for your application.',
      });
    }
    normalized.contactEmail = owner.email!.toLowerCase();
    await this.assertApplicationCanBeSubmitted(normalized);

    const draft = await this.database.sellerApplicationDraft.findUnique({
      where: { userId },
      include: { documents: true },
    });

    const uploads = requiredDocuments.map(({ field, type }) => {
      const upload = files[field]?.[0];
      const saved = draft?.documents.find(doc => doc.documentType === type);
      if (!upload && !saved) {
        throw new ConflictException({
          code: 'SELLER_REGISTRATION_DOCUMENTS_REQUIRED',
          message: 'All four required business verification documents are required',
        });
      }
      return { upload, saved, type };
    });

    const applicationId = randomUUID();
    const stored: StoredSellerRegistrationDocument[] = [];
    try {
      for (const { upload, saved, type } of uploads) {
        if (upload) {
          const document = await this.documents.store(applicationId, type, upload);
          stored.push(document);
        } else if (saved) {
          stored.push({
            documentType: saved.documentType,
            storageKey: saved.storageKey,
            originalName: saved.originalName,
            mimeType: saved.mimeType,
            sizeBytes: saved.sizeBytes,
          });
        }
      }

      const referenceCode = this.referenceCode();
      const application = await this.database.$transaction(
        async (transaction) => {
          const created = await transaction.sellerApplication.create({
            data: {
              id: applicationId,
              referenceCode,
              ...normalized,
              ownerUserId: userId,
              status: SellerApplicationStatus.SUBMITTED,
              documents: {
                create: stored.map((document) => ({
                  documentType: document.documentType,
                  storageKey: document.storageKey,
                  originalName: document.originalName,
                  mimeType: document.mimeType,
                  sizeBytes: document.sizeBytes,
                })),
              },
            },
            select: {
              id: true,
              referenceCode: true,
              submittedAt: true,
            },
          });

          await this.mail.queue(transaction, {
            applicationId: created.id,
            eventKey: `submitted:${created.id}`,
            recipient: normalized.contactEmail,
            payload: {
              kind: 'SUBMITTED',
              referenceCode: created.referenceCode,
            },
          });

          // Draft metadata is retired atomically with successful submission.
          // Stored files stay available to the submitted application's documents.
          if (draft) {
            await transaction.sellerApplicationDraft.deleteMany({ where: { userId } });
          }

          await transaction.auditLog.create({
            data: {
              action: 'SELLER_APPLICATION_SUBMITTED',
              entityType: 'SellerApplication',
              entityId: created.id,
              actorId: userId,
              metadata: {
                referenceCode: created.referenceCode,
                sourceIpHash,
                documentTypes: stored.map((document) => document.documentType),
              },
            },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        referenceCode: application.referenceCode,
        submittedAt: application.submittedAt,
      };
    } catch (error) {
      await this.documents.remove(stored.filter(document =>
        !draft?.documents.some(saved => saved.storageKey === document.storageKey),
      ).map(document => document.storageKey));
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SELLER_APPLICATION_ALREADY_EXISTS',
          message:
            'A Seller application already exists for the supplied business or contact details',
        });
      }
      throw error;
    }
  }

  private async assertApplicationCanBeSubmitted(input: {
    contactEmail: string;
    contactPhone: string;
    commercialRegistrationNumber: string;
    tradeLicenseNumber: string;
    tinNumber: string;
    vatRegistrationNumber: string;
  }): Promise<void> {
    const existingApplication = await this.database.sellerApplication.findFirst({
        where: {
          status: {
            in: [
              SellerApplicationStatus.SUBMITTED,
              SellerApplicationStatus.RESUBMITTED,
              SellerApplicationStatus.CHANGES_REQUESTED,
              SellerApplicationStatus.UNDER_REVIEW,
              SellerApplicationStatus.APPROVED,
            ],
          },
          OR: [
            {
              contactEmail: {
                equals: input.contactEmail,
                mode: 'insensitive',
              },
            },
            { contactPhone: input.contactPhone },
            {
              commercialRegistrationNumber:
                input.commercialRegistrationNumber,
            },
            { tradeLicenseNumber: input.tradeLicenseNumber },
            { tinNumber: input.tinNumber },
            { vatRegistrationNumber: input.vatRegistrationNumber },
          ],
        },
        select: { id: true },
      });

    if (existingApplication) {
      throw new ConflictException({
        code: 'SELLER_APPLICATION_ALREADY_EXISTS',
        message:
          'A Seller application or Seller account already exists for the supplied details',
      });
    }
  }

  private normalizePhone(value: string): string {
    return value.trim().replace(/[\s()-]/gu, '');
  }

  private referenceCode(): string {
    const year = new Date().getUTCFullYear();
    const random = randomBytes(6).toString('hex').toUpperCase();
    return `SLR-APP-${year}-${random}`;
  }
}
