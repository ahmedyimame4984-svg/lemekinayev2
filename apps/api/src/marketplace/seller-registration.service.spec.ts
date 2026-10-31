import {
  SellerApplicationDocumentType,
  SellerApplicationStatus,
  SellerType,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerRegistrationDocumentStorage } from './seller-registration-document-storage.service.js';
import type { SellerApplicationMailService } from './seller-application-mail.service.js';
import { SellerRegistrationService } from './seller-registration.service.js';

describe('SellerRegistrationService', () => {
  const user = { findUnique: vi.fn() };
  const sellerApplication = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const sellerApplicationDraft = { findUnique: vi.fn(), deleteMany: vi.fn() };
  const database = {
    user,
    sellerApplication,
    sellerApplicationDraft,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ sellerApplication, sellerApplicationDraft, auditLog }),
    ),
  };

  const documents = {
    store: vi.fn(
      async (
        applicationId: string,
        documentType: SellerApplicationDocumentType,
        file: { originalname: string; mimetype: string; size: number },
      ) => ({
        documentType,
        storageKey: `${applicationId}/${documentType}.pdf`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
    ),
    remove: vi.fn(async () => undefined),
  };

  const mail = { queue: vi.fn(async () => undefined) };

  const service = new SellerRegistrationService(
    database as unknown as DatabaseService,
    documents as unknown as SellerRegistrationDocumentStorage,
    mail as unknown as SellerApplicationMailService,
  );

  const input = {
    contactName: 'Demo Owner',
    contactEmail: 'OWNER@example.com',
    contactPhone: '+251 911 223344',
    businessName: 'Demo Auto Parts',
    displayName: 'Demo Auto',
    sellerType: SellerType.RETAILER,
    businessEmail: 'INFO@example.com',
    businessPhone: '+251 911 223355',
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    address: 'Bole',
    commercialRegistrationNumber: ' cr-001 ',
    tradeLicenseNumber: ' tl-001 ',
    tinNumber: ' tin-001 ',
    vatRegistrationNumber: ' vat-001 ',
    termsAccepted: 'true',
  };

  const file = (name: string) => ({
    fieldname: name,
    originalname: `${name}.pdf`,
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('document'),
  });

  const files = {
    commercialRegistrationDocument: [file('commercial-registration')],
    tradeLicenseDocument: [file('trade-license')],
    tinCertificateDocument: [file('tin')],
    vatRegistrationDocument: [file('vat')],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    user.findUnique.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'owner@example.com',
      emailVerifiedAt: new Date('2026-10-01'),
      status: 'ACTIVE',
      accountType: 'SELLER',
    });
    sellerApplication.findFirst.mockResolvedValue(null);
    sellerApplicationDraft.findUnique.mockResolvedValue(null);
    sellerApplication.create.mockImplementation(
      async ({ data }: { data: { referenceCode: string } }) => ({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        referenceCode: data.referenceCode,
        submittedAt: new Date('2026-10-08T12:00:00.000Z'),
      }),
    );
    auditLog.create.mockResolvedValue({});
  });

  it('submits an application without creating a Seller account', async () => {
    const result = await service.submit(input, files, 'source-hash', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(result.referenceCode).toMatch(/^SLR-APP-\d{4}-[A-F0-9]{12}$/u);
    expect(documents.store).toHaveBeenCalledTimes(4);
    expect(mail.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventKey: 'submitted:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recipient: 'owner@example.com',
      payload: expect.objectContaining({kind:'SUBMITTED'}),
    }));
    expect(sellerApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactEmail: 'owner@example.com',
          contactPhone: '+251911223344',
          businessEmail: 'info@example.com',
          commercialRegistrationNumber: 'CR-001',
          tradeLicenseNumber: 'TL-001',
          tinNumber: 'TIN-001',
          vatRegistrationNumber: 'VAT-001',
          status: SellerApplicationStatus.SUBMITTED,
          ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SELLER_APPLICATION_SUBMITTED',
        }),
      }),
    );
  });

  it('rejects duplicate identities or business registrations before storing files', async () => {
    sellerApplication.findFirst.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    await expect(service.submit(input, files, 'source-hash', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toMatchObject({
      response: { code: 'SELLER_APPLICATION_ALREADY_EXISTS' },
    });
    expect(documents.store).not.toHaveBeenCalled();
  });

  it('denies application submission before email verification', async () => {
    user.findUnique.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'owner@example.com',
      emailVerifiedAt: null,
      status: 'PROVISIONED',
      accountType: 'SELLER',
    });
    await expect(service.submit(
      input,
      files,
      'source-hash',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )).rejects.toMatchObject({
      response: { code: 'SELLER_VERIFIED_ACCOUNT_REQUIRED' },
    });
    expect(documents.store).not.toHaveBeenCalled();
  });

  it('always uses the verified account email, ignoring a different form email', async () => {
    user.findUnique.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'verified@example.com',
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      accountType: 'SELLER',
    });
    await service.submit(
      { ...input, contactEmail: 'attacker@example.com' },
      files, 'source-hash', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(sellerApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contactEmail: 'verified@example.com' }),
    }));
  });

  it('submits previously saved private documents without requiring the files again', async () => {
    sellerApplicationDraft.findUnique.mockResolvedValue({
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      documents: Object.values(SellerApplicationDocumentType).map(documentType => ({
        documentType, storageKey: 'saved/private-document.pdf',
        originalName: 'saved.pdf', mimeType: 'application/pdf', sizeBytes: 123,
      })),
    });
    await service.submit(input, {}, 'source-hash', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(documents.store).not.toHaveBeenCalled();
    expect(sellerApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        documents: { create: expect.arrayContaining([
          expect.objectContaining({ originalName: 'saved.pdf' }),
        ]) },
      }),
    }));
    expect(sellerApplicationDraft.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    });
  });


  it('requires all four verification documents', async () => {
    await expect(
      service.submit(
        input,
        { ...files, vatRegistrationDocument: undefined },
        'source-hash',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_REGISTRATION_DOCUMENTS_REQUIRED' },
    });
    expect(documents.store).not.toHaveBeenCalled();
  });
});
