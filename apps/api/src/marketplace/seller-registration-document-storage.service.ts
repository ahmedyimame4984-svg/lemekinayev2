import {
  BadRequestException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SellerApplicationDocumentType,
} from '@prisma/client';
import { validateEnvironment } from '../config/environment.js';

export interface SellerRegistrationUpload {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredSellerRegistrationDocument {
  documentType: SellerApplicationDocumentType;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Never trust the multipart MIME label as proof of an uploaded document type. */
export function hasMatchingSellerDocumentSignature(
  mimeType: string,
  bytes: Buffer,
): boolean {
  if (mimeType === 'application/pdf') {
    return bytes.length >= PDF_SIGNATURE.length &&
      bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
  }
  if (mimeType === 'image/png') {
    return bytes.length >= PNG_SIGNATURE.length &&
      bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  }
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return false;
}
const extensionsByMimeType = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);

@Injectable()
export class SellerRegistrationDocumentStorage {
  async store(
    applicationId: string,
    documentType: SellerApplicationDocumentType,
    file: SellerRegistrationUpload,
  ): Promise<StoredSellerRegistrationDocument> {
    if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException({
        code: 'SELLER_DOCUMENT_SIZE_INVALID',
        message: 'Each verification document must be 8 MB or smaller',
      });
    }

    const extension = extensionsByMimeType.get(file.mimetype);
    if (!extension) {
      throw new UnsupportedMediaTypeException({
        code: 'SELLER_DOCUMENT_TYPE_INVALID',
        message: 'Verification documents must be PDF, JPG, or PNG files',
      });
    }

    // Multer's reported file size and MIME type are user-controlled metadata.
    // Reject truncated buffers and files whose signatures contradict the label.
    if (
      !Buffer.isBuffer(file.buffer) ||
      file.size !== file.buffer.length ||
      !hasMatchingSellerDocumentSignature(file.mimetype, file.buffer)
    ) {
      throw new UnsupportedMediaTypeException({
        code: 'SELLER_DOCUMENT_CONTENT_INVALID',
        message: 'The uploaded document does not match its declared file type',
      });
    }

    const { sellerDocumentStoragePath } = validateEnvironment(process.env);
    const folder = join(sellerDocumentStoragePath, applicationId);
    await mkdir(folder, { recursive: true, mode: 0o700 });

    const fileName =
      `${documentType.toLowerCase()}-${randomUUID()}.${extension}`;
    const storageKey = `${applicationId}/${fileName}`;
    await writeFile(join(folder, fileName), file.buffer, {
      flag: 'wx',
      mode: 0o600,
    });

    return {
      documentType,
      storageKey,
      originalName: this.safeOriginalName(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  async remove(storageKeys: string[]): Promise<void> {
    const { sellerDocumentStoragePath } = validateEnvironment(process.env);
    await Promise.all(
      storageKeys.map((storageKey) =>
        rm(join(sellerDocumentStoragePath, storageKey), { force: true }),
      ),
    );
  }

  private safeOriginalName(value: string): string {
    const fileName = value.split(/[\\/]/u).pop()?.trim() || 'document';
    return fileName.slice(0, 255);
  }
}
