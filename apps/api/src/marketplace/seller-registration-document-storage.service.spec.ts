import { SellerApplicationDocumentType } from '@prisma/client';
import {
  hasMatchingSellerDocumentSignature,
  SellerRegistrationDocumentStorage,
} from './seller-registration-document-storage.service.js';

describe('Seller registration document content validation', () => {
  it('accepts the expected PDF, PNG and JPEG magic bytes', () => {
    expect(
      hasMatchingSellerDocumentSignature(
        'application/pdf',
        Buffer.from('%PDF-1.7\n'),
      ),
    ).toBe(true);
    expect(
      hasMatchingSellerDocumentSignature(
        'image/png',
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      ),
    ).toBe(true);
    expect(
      hasMatchingSellerDocumentSignature(
        'image/jpeg',
        Buffer.from([255, 216, 255, 224]),
      ),
    ).toBe(true);
  });

  it('rejects mislabeled data and incomplete signatures', () => {
    expect(
      hasMatchingSellerDocumentSignature(
        'application/pdf',
        Buffer.from('not a PDF'),
      ),
    ).toBe(false);
    expect(
      hasMatchingSellerDocumentSignature(
        'image/png',
        Buffer.from([137, 80, 78, 71]),
      ),
    ).toBe(false);
    expect(
      hasMatchingSellerDocumentSignature(
        'image/jpeg',
        Buffer.from([255, 216]),
      ),
    ).toBe(false);
    expect(
      hasMatchingSellerDocumentSignature(
        'application/octet-stream',
        Buffer.from('%PDF-1.7'),
      ),
    ).toBe(false);
  });

  it('rejects a spoofed MIME type before storing any content', async () => {
    const documents = new SellerRegistrationDocumentStorage();
    const buffer = Buffer.from('fake-pdf-file');
    await expect(
      documents.store('test-application', SellerApplicationDocumentType.VAT_REGISTRATION, {
        fieldname: 'vatRegistrationDocument',
        originalname: 'vat.pdf',
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_DOCUMENT_CONTENT_INVALID' },
    });
  });

  it('rejects a mismatch between Multer file size and uploaded bytes', async () => {
    const documents = new SellerRegistrationDocumentStorage();
    const buffer = Buffer.from('%PDF-1.7\n');
    await expect(
      documents.store('test-application', SellerApplicationDocumentType.TRADE_LICENSE, {
        fieldname: 'tradeLicenseDocument',
        originalname: 'license.pdf',
        mimetype: 'application/pdf',
        size: buffer.length + 1,
        buffer,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_DOCUMENT_CONTENT_INVALID' },
    });
  });
});
