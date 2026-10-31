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
  SellerApplicationDocumentType,
  SellerApplicationStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerRegistrationDocumentStorage } from './seller-registration-document-storage.service.js';
import type { SellerRegistrationFiles } from './seller-registration.service.js';
import type { SaveSellerApplicationDraftDto } from './dto/seller-application-draft.dto.js';

const editableFields = [
  'contactName', 'contactPhone', 'businessName', 'displayName',
  'sellerType', 'businessEmail', 'businessPhone', 'region', 'city',
  'address', 'commercialRegistrationNumber', 'tradeLicenseNumber',
  'tinNumber', 'vatRegistrationNumber',
] as const;

type ApplicationField = (typeof editableFields)[number];
const maxLength: Partial<Record<ApplicationField, number>> = {
  contactName: 160, contactPhone: 32, businessName: 180,
  displayName: 160, sellerType: 32, businessEmail: 254,
  businessPhone: 32, region: 120, city: 120, address: 500,
  commercialRegistrationNumber: 100, tradeLicenseNumber: 100,
  tinNumber: 100, vatRegistrationNumber: 100,
};
const documentFields = [
  ['commercialRegistrationDocument', SellerApplicationDocumentType.COMMERCIAL_REGISTRATION],
  ['tradeLicenseDocument', SellerApplicationDocumentType.TRADE_LICENSE],
  ['tinCertificateDocument', SellerApplicationDocumentType.TIN_CERTIFICATE],
  ['vatRegistrationDocument', SellerApplicationDocumentType.VAT_REGISTRATION],
] as const;

@Injectable()
export class SellerApplicationDraftService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: SellerRegistrationDocumentStorage,
  ) {}

  async requireAccount(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, emailVerifiedAt: true,
        accountType: true, status: true,
      },
    });
    if (!user || user.accountType !== AccountType.SELLER ||
      user.status !== AccountStatus.ACTIVE || !user.emailVerifiedAt || !user.email) {
      throw new ForbiddenException({
        code: 'SELLER_ACCOUNT_VERIFICATION_REQUIRED',
        message: 'Sign in with a verified Seller email to continue.',
      });
    }
    return { userId: user.id, email: user.email };
  }

  async get(userId: string) {
    const owner = await this.requireAccount(userId);
    const [draft, application] = await Promise.all([
      this.database.sellerApplicationDraft.findUnique({
        where: { userId },
        include: {
          documents: {
            select: {
              documentType: true, originalName: true, sizeBytes: true, uploadedAt: true,
            },
          },
        },
      }),
      this.database.sellerApplication.findFirst({
        where: { ownerUserId: userId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        include: {
          documents: {
            where: { isCurrent: true },
            select: {
              documentType: true, originalName: true, status: true,
              uploadedAt: true, reviewNote: true,
            },
          },
          reviewEvents: {
            select: {
              action: true, fromStatus: true, toStatus: true,
              reason: true, createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);
    return {
      contactEmail: owner.email,
      draft: draft ? {
        step: draft.step,
        values: draft.values,
        version: draft.version,
        updatedAt: draft.updatedAt,
        documents: draft.documents,
      } : null,
      application: application ? {
        referenceCode: application.referenceCode,
        status: application.status,
        version: application.version,
        contactName: application.contactName,
        contactEmail: owner.email,
        contactPhone: application.contactPhone,
        businessName: application.businessName,
        displayName: application.displayName,
        sellerType: application.sellerType,
        businessEmail: application.businessEmail,
        businessPhone: application.businessPhone,
        region: application.region,
        city: application.city,
        address: application.address,
        commercialRegistrationNumber: application.commercialRegistrationNumber,
        tradeLicenseNumber: application.tradeLicenseNumber,
        tinNumber: application.tinNumber,
        vatRegistrationNumber: application.vatRegistrationNumber,
        submittedAt: application.submittedAt,
        reviewedAt: application.reviewedAt,
        approvedAt: application.approvedAt,
        updatedAt: application.updatedAt,
        correctionReason: application.correctionReason,
        documents: application.documents,
        reviewEvents: application.reviewEvents,
        canEdit:
          application.status === SellerApplicationStatus.SUBMITTED ||
          application.status === SellerApplicationStatus.RESUBMITTED ||
          application.status === SellerApplicationStatus.CHANGES_REQUESTED,
      } : null,
    };
  }

  async save(userId: string, input: SaveSellerApplicationDraftDto) {
    await this.requireAccount(userId);
    const existing = await this.database.sellerApplication.findFirst({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (existing) throw this.submitted();

    const clean: Record<string, string> = {};
    for (const field of editableFields) {
      const value = input.values[field];
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length > (maxLength[field] ?? 255)) {
        throw new BadRequestException({
          code: 'SELLER_DRAFT_FIELD_INVALID',
          message: 'A draft field is invalid or too long.',
        });
      }
      clean[field] = value;
    }
    const unknown = Object.keys(input.values).filter(key => !editableFields.includes(key as ApplicationField));
    if (unknown.length) {
      throw new BadRequestException({
        code: 'SELLER_DRAFT_FIELDS_UNEXPECTED',
        message: 'The draft contains unsupported fields.',
      });
    }

    try {
      if (input.version === 0) {
        await this.database.sellerApplicationDraft.create({
          data: { userId, step: input.step, values: clean },
        });
      } else {
        const result = await this.database.sellerApplicationDraft.updateMany({
          where: { userId, version: input.version },
          data: {
            step: input.step,
            values: clean,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) throw this.changed();
      }
      return (await this.get(userId)).draft;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.changed();
      }
      throw error;
    }
  }

  async saveDocuments(userId: string, files: SellerRegistrationFiles) {
    await this.requireAccount(userId);
    const application = await this.database.sellerApplication.findFirst({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (application) throw this.submitted();

    const provided = documentFields.flatMap(([field, type]) => {
      const file = files[field]?.[0];
      return file ? [{ file, type }] : [];
    });
    if (!provided.length) throw new BadRequestException({
      code: 'SELLER_DRAFT_DOCUMENT_REQUIRED',
      message: 'Choose at least one document to upload.',
    });
    const draft = await this.database.sellerApplicationDraft.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!draft) throw new NotFoundException('Save the application draft before uploading documents.');

    const stored: Awaited<ReturnType<SellerRegistrationDocumentStorage['store']>>[] = [];
    try {
      for (const { file, type } of provided) {
        stored.push(await this.storage.store(userId, type, file));
      }
      const oldKeys = await this.database.$transaction(async tx => {
        const keys: string[] = [];
        for (const doc of stored) {
          const old = await tx.sellerApplicationDraftDocument.findUnique({
            where: { userId_documentType: { userId, documentType: doc.documentType } },
            select: { storageKey: true },
          });
          if (old) keys.push(old.storageKey);
          await tx.sellerApplicationDraftDocument.upsert({
            where: { userId_documentType: { userId, documentType: doc.documentType } },
            create: { userId, ...doc },
            update: {
              storageKey: doc.storageKey,
              originalName: doc.originalName,
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
              uploadedAt: new Date(),
            },
          });
        }
        return keys;
      });
      // Old files are removed only after their replacements are committed.
      await this.storage.remove(oldKeys);
      return (await this.get(userId)).draft;
    } catch (error) {
      // Do not discard a committed replacement because old-file cleanup failed.
      if (!await this.isCommitted(userId, stored)) {
        await this.storage.remove(stored.map(doc => doc.storageKey));
      }
      throw error;
    }
  }

  private async isCommitted(userId: string, stored: Array<{ documentType: SellerApplicationDocumentType; storageKey: string }>) {
    if (!stored.length) return false;
    const docs = await this.database.sellerApplicationDraftDocument.findMany({
      where: {
        userId,
        OR: stored.map(doc => ({ documentType: doc.documentType, storageKey: doc.storageKey })),
      },
      select: { storageKey: true },
    });
    return stored.every(doc => docs.some(record => record.storageKey === doc.storageKey));
  }

  private submitted() {
    return new ConflictException({
      code: 'SELLER_APPLICATION_ALREADY_SUBMITTED',
      message: 'Track or edit your submitted application instead of starting a new draft.',
    });
  }

  private changed() {
    return new ConflictException({
      code: 'SELLER_DRAFT_VERSION_CONFLICT',
      message: 'Draft changed in another tab. Refresh before saving.',
    });
  }
}
