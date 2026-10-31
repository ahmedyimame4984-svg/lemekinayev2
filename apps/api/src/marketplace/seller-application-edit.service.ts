import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  SellerApplicationDocumentStatus,
  SellerApplicationDocumentType,
  SellerApplicationStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerApplicationAccessService } from './seller-application-access.service.js';
import { SellerApplicationMailService } from './seller-application-mail.service.js';
import {
  type SellerRegistrationFiles,
} from './seller-registration.service.js';
import { SellerRegistrationDocumentStorage } from './seller-registration-document-storage.service.js';
import type { UpdateSellerApplicationDto } from './dto/seller-application-edit.dto.js';

const requiredDocuments = [
  ['commercialRegistrationDocument', SellerApplicationDocumentType.COMMERCIAL_REGISTRATION],
  ['tradeLicenseDocument', SellerApplicationDocumentType.TRADE_LICENSE],
  ['tinCertificateDocument', SellerApplicationDocumentType.TIN_CERTIFICATE],
  ['vatRegistrationDocument', SellerApplicationDocumentType.VAT_REGISTRATION],
] as const;

const editableStatuses: SellerApplicationStatus[] = [
  SellerApplicationStatus.SUBMITTED,
  SellerApplicationStatus.RESUBMITTED,
  SellerApplicationStatus.CHANGES_REQUESTED,
];

@Injectable()
export class SellerApplicationEditService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: SellerApplicationAccessService,
    private readonly storage: SellerRegistrationDocumentStorage,
    private readonly mail: SellerApplicationMailService,
  ) {}

  async update(
    applicationId: string,
    input: UpdateSellerApplicationDto,
    files: SellerRegistrationFiles,
  ) {
    const original = await this.database.sellerApplication.findUnique({
      where: { id: applicationId },
      include: { documents: { where: { isCurrent: true } } },
    });
    if (!original || !editableStatuses.includes(original.status) ||
      original.version !== input.version) {
      throw this.conflict();
    }

    const normalized = {
      contactName: input.contactName.trim(),
      contactEmail: original.ownerUserId
        ? original.contactEmail
        : (input.contactEmail ?? original.contactEmail).trim().toLowerCase(),
      contactPhone: this.normalizePhone(input.contactPhone),
      businessName: input.businessName.trim(),
      displayName: input.displayName.trim(),
      sellerType: input.sellerType,
      businessEmail: input.businessEmail.trim().toLowerCase(),
      businessPhone: this.normalizePhone(input.businessPhone),
      region: input.region.trim(),
      city: input.city.trim(),
      address: input.address.trim(),
      commercialRegistrationNumber: input.commercialRegistrationNumber.trim().toUpperCase(),
      tradeLicenseNumber: input.tradeLicenseNumber.trim().toUpperCase(),
      tinNumber: input.tinNumber.trim().toUpperCase(),
      vatRegistrationNumber: input.vatRegistrationNumber.trim().toUpperCase(),
    };

    if (!requiredDocuments.every(([, type]) =>
      original.documents.some((document) => document.documentType === type))) {
      throw new BadRequestException({
        code: 'APPLICATION_DOCUMENT_MISSING',
        message: 'All four required verification documents must be present',
      });
    }

    const emailChanged = original.contactEmail !== normalized.contactEmail;
    if (emailChanged && !input.contactEmailCode) {
      throw new BadRequestException({
        code: 'CONTACT_EMAIL_VERIFICATION_REQUIRED',
        message: 'Verify the new contact email before submitting changes',
      });
    }

    const challengeId = emailChanged
      ? await this.access.verifyContactEmailChange(
          applicationId, normalized.contactEmail, input.contactEmailCode!,
        )
      : null;

    const duplicate = await this.database.sellerApplication.findFirst({
      where: {
        id: { not: applicationId },
        status: { not: SellerApplicationStatus.REJECTED },
        OR: [
          { contactEmail: { equals: normalized.contactEmail, mode: 'insensitive' } },
          { contactPhone: normalized.contactPhone },
          { tinNumber: normalized.tinNumber },
          { vatRegistrationNumber: normalized.vatRegistrationNumber },
          { commercialRegistrationNumber: normalized.commercialRegistrationNumber },
          { tradeLicenseNumber: normalized.tradeLicenseNumber },
        ],
      },
      select: { id: true },
    });
    const existingUser = await this.database.user.findFirst({
      where: {
        ...(original.ownerUserId ? { id: { not: original.ownerUserId } } : {}),
        OR: [
          { email: { equals: normalized.contactEmail, mode: 'insensitive' } },
          { phone: normalized.contactPhone },
        ],
      },
      select: { id: true },
    });
    if (duplicate || existingUser) {
      throw new ConflictException({
        code: 'SELLER_APPLICATION_ALREADY_EXISTS',
        message: 'Another application or account already uses the supplied details',
      });
    }

    const changedLegalIdentity = [
      'businessName',
      'commercialRegistrationNumber',
      'tradeLicenseNumber',
      'tinNumber',
      'vatRegistrationNumber',
    ].some((field) =>
      String(original[field as keyof typeof original]) !==
      String(normalized[field as keyof typeof normalized]),
    );

    const stored: Array<{
      documentType: SellerApplicationDocumentType;
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }> = [];
    try {
      for (const [field, type] of requiredDocuments) {
        const uploaded = files[field]?.[0];
        if (uploaded) stored.push(await this.storage.store(applicationId, type, uploaded));
      }

      await this.database.$transaction(async (tx) => {
        const current = await tx.sellerApplication.findUnique({
          where: { id: applicationId },
          select: { status: true, version: true, contactEmail: true },
        });
        if (!current || !editableStatuses.includes(current.status) ||
          current.version !== input.version) throw this.conflict();

        if (challengeId) {
          await this.access.consumeContactEmailChange(
            tx, challengeId, applicationId, normalized.contactEmail,
          );
        }

        const nextStatus =
          current.status === SellerApplicationStatus.CHANGES_REQUESTED
            ? SellerApplicationStatus.RESUBMITTED
            : SellerApplicationStatus.SUBMITTED;
        const updated = await tx.sellerApplication.updateMany({
          where: { id: applicationId, version: input.version, status: current.status },
          data: {
            ...normalized,
            status: nextStatus,
            version: { increment: 1 },
            correctionReason: null,
          },
        });
        if (updated.count !== 1) throw this.conflict();

        if (changedLegalIdentity) {
          await tx.sellerApplicationDocument.updateMany({
            where: { applicationId, isCurrent: true },
            data: {
              status: SellerApplicationDocumentStatus.PENDING,
              reviewedAt: null,
              reviewNote: null,
            },
          });
        }

        for (const document of stored) {
          await tx.sellerApplicationDocument.updateMany({
            where: {
              applicationId,
              documentType: document.documentType,
              isCurrent: true,
            },
            data: { isCurrent: false },
          });
          await tx.sellerApplicationDocument.create({
            data: { applicationId, ...document, isCurrent: true },
          });
        }

        if (emailChanged) {
          await tx.sellerApplicationAccessSession.updateMany({
            where: { applicationId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await this.mail.queue(tx, {
          applicationId,
          eventKey: `resubmitted:${applicationId}:${input.version + 1}`,
          recipient: normalized.contactEmail,
          payload: {
            kind: 'RESUBMITTED',
            referenceCode: original.referenceCode,
          },
        });
        if (emailChanged) {
          await this.mail.queue(tx, {
            applicationId,
            eventKey: `contact-changed:${applicationId}:${input.version + 1}`,
            recipient: original.contactEmail,
            payload: {
              kind: 'CONTACT_EMAIL_CHANGED',
              referenceCode: original.referenceCode,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'SELLER_APPLICATION_UPDATED',
            entityType: 'SellerApplication',
            entityId: applicationId,
            metadata: {
              previousVersion: input.version,
              version: input.version + 1,
              changedLegalIdentity,
              emailChanged,
              replacementTypes: stored.map((document) => document.documentType),
            },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await this.storage.remove(stored.map((document) => document.storageKey));
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw this.conflict();
      }
      throw error;
    }

    return {
      referenceCode: original.referenceCode,
      status: original.status === SellerApplicationStatus.CHANGES_REQUESTED
        ? SellerApplicationStatus.RESUBMITTED
        : SellerApplicationStatus.SUBMITTED,
      version: input.version + 1,
      emailReverificationRequired: emailChanged,
    };
  }

  private normalizePhone(value: string): string {
    return value.trim().replace(/[\s()-]/gu, '');
  }

  private conflict(): ConflictException {
    return new ConflictException({
      code: 'SELLER_APPLICATION_EDIT_CONFLICT',
      message: 'The application is locked or has changed. Reload before editing.',
    });
  }
}
