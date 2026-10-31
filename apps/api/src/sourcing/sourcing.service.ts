import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  ProductStatus,
  type Supplier,
  type SupplierOffer,
} from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import { DatabaseService } from '../database/database.service.js';
import { assertArticleActiveForCommerce } from '../product/article-commerce-boundary.js';
import { SupplierAdminSortBy } from './dto/supplier.dto.js';
import type {
  CreateSupplierOfferDto,
  SupplierOfferAdminQueryDto,
  SupplierOfferResponseDto,
  UpdateSupplierOfferDto,
} from './dto/supplier-offer.dto.js';
import type {
  BulkUpdateSupplierStatusDto,
  CreateSupplierDto,
  SupplierAdminPageQueryDto,
  SupplierAdminQueryDto,
  SupplierBulkStatusResponseDto,
  SupplierPageResponseDto,
  SupplierResponseDto,
  UpdateSupplierDto,
} from './dto/supplier.dto.js';

const supplierSelect = {
  id: true,
  code: true,
  name: true,
  supplierType: true,
  countryCode: true,
  contactEmail: true,
  website: true,
  notes: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierSelect;

const offerSelect = {
  id: true,
  supplierId: true,
  productId: true,
  supplierSku: true,
  unitCost: true,
  currency: true,
  minOrderQuantity: true,
  orderMultiple: true,
  availableQuantity: true,
  leadTimeDaysMin: true,
  leadTimeDaysMax: true,
  incoterm: true,
  originCountryCode: true,
  validFrom: true,
  validTo: true,
  notes: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierOfferSelect;

type SupplierView = Prisma.SupplierGetPayload<{ select: typeof supplierSelect }>;
type SupplierOfferView = Prisma.SupplierOfferGetPayload<{
  select: typeof offerSelect;
}>;

@Injectable()
export class SourcingService {
  constructor(private readonly database: DatabaseService) {}

  async listSuppliers(
    query: SupplierAdminQueryDto,
  ): Promise<SupplierResponseDto[]> {
    const records = await this.database.supplier.findMany({
      where: {
        status: query.status,
        countryCode: query.countryCode,
      },
      select: supplierSelect,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
    return records.map((record) => this.toSupplierResponse(record));
  }

  async listSuppliersPage(
    query: SupplierAdminPageQueryDto,
  ): Promise<SupplierPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.SupplierWhereInput = {
      status: query.status,
      countryCode: query.countryCode,
      supplierType: query.supplierType,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { contactEmail: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const direction =
      query.sortDirection === AdminSortDirection.DESC ? 'desc' : 'asc';
    const orderBy: Prisma.SupplierOrderByWithRelationInput[] =
      query.sortBy === SupplierAdminSortBy.CREATED_AT
        ? [{ createdAt: direction }, { id: 'asc' }]
        : query.sortBy === SupplierAdminSortBy.UPDATED_AT
          ? [{ updatedAt: direction }, { id: 'asc' }]
          : query.sortBy === SupplierAdminSortBy.CODE
            ? [{ code: direction }, { id: 'asc' }]
            : query.sortBy === SupplierAdminSortBy.SUPPLIER_TYPE
              ? [{ supplierType: direction }, { name: 'asc' }, { code: 'asc' }, { id: 'asc' }]
              : query.sortBy === SupplierAdminSortBy.COUNTRY_CODE
                ? [{ countryCode: direction }, { name: 'asc' }, { code: 'asc' }, { id: 'asc' }]
                : query.sortBy === SupplierAdminSortBy.STATUS
                  ? [{ status: direction }, { name: 'asc' }, { code: 'asc' }, { id: 'asc' }]
                  : [{ name: direction }, { code: 'asc' }, { id: 'asc' }];

    const [total, records] = await Promise.all([
      this.database.supplier.count({ where }),
      this.database.supplier.findMany({
        where,
        select: supplierSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.toSupplierResponse(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async createSupplier(
    input: CreateSupplierDto,
    actorId: string,
  ): Promise<SupplierResponseDto> {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const supplier = await tx.supplier.create({
            data: {
              code: input.code.trim().toUpperCase(),
              name: input.name.trim(),
              supplierType: input.supplierType,
              countryCode: input.countryCode.trim().toUpperCase(),
              contactEmail: this.optionalText(input.contactEmail),
              website: this.optionalText(input.website),
              notes: this.optionalText(input.notes),
              status: input.status ?? MasterDataStatus.DRAFT,
              createdById: actorId,
              updatedById: actorId,
            },
            select: supplierSelect,
          });

          await this.audit(
            tx,
            actorId,
            'SUPPLIER_CREATED',
            'Supplier',
            supplier.id,
            { after: this.supplierSnapshot(supplier) },
          );

          return this.toSupplierResponse(supplier);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowSupplierPersistenceError(error);
    }
  }

  async updateSupplier(
    id: string,
    input: UpdateSupplierDto,
    actorId: string,
  ): Promise<SupplierResponseDto> {
    this.assertChanges(
      input,
      [
        'name',
        'supplierType',
        'countryCode',
        'contactEmail',
        'website',
        'notes',
        'status',
      ],
      'SUPPLIER_UPDATE_EMPTY',
      'At least one Supplier field must be supplied',
    );

    try {
      return await this.database.$transaction(
        async (tx) => {
          const current = await tx.supplier.findUnique({
            where: { id },
            select: supplierSelect,
          });
          if (!current) throw this.supplierNotFound();
          if (current.version !== input.version) {
            throw this.supplierVersionConflict();
          }

          const nextStatus = input.status ?? current.status;
          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const activeOffer = await tx.supplierOffer.findFirst({
              where: { supplierId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            });
            if (activeOffer) {
              throw new ConflictException({
                code: 'SUPPLIER_HAS_ACTIVE_OFFERS',
                message:
                  'Pause or deactivate Active Supplier Offers before changing this Supplier lifecycle.',
              });
            }
          }

          const supplier = await tx.supplier.update({
            where: { id, version: input.version },
            data: {
              ...(input.name !== undefined
                ? { name: input.name.trim() }
                : {}),
              ...(input.supplierType !== undefined
                ? { supplierType: input.supplierType }
                : {}),
              ...(input.countryCode !== undefined
                ? { countryCode: input.countryCode.trim().toUpperCase() }
                : {}),
              ...(input.contactEmail !== undefined
                ? { contactEmail: this.optionalText(input.contactEmail) }
                : {}),
              ...(input.website !== undefined
                ? { website: this.optionalText(input.website) }
                : {}),
              ...(input.notes !== undefined
                ? { notes: this.optionalText(input.notes) }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: supplierSelect,
          });

          await this.audit(
            tx,
            actorId,
            'SUPPLIER_UPDATED',
            'Supplier',
            supplier.id,
            {
              before: this.supplierSnapshot(current),
              after: this.supplierSnapshot(supplier),
            },
          );

          return this.toSupplierResponse(supplier);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowSupplierPersistenceError(error);
    }
  }

  async bulkUpdateSupplierStatus(
    input: BulkUpdateSupplierStatusDto,
    actorId: string,
  ): Promise<SupplierBulkStatusResponseDto> {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'SUPPLIER_BULK_DUPLICATE_IDS',
        message: 'Each Supplier can appear only once in a bulk lifecycle change',
      });
    }

    try {
      return await this.database.$transaction(
        async (tx) => {
          const records = await tx.supplier.findMany({
            where: { id: { in: ids } },
            select: supplierSelect,
          });
          if (records.length !== ids.length) {
            throw new NotFoundException({
              code: 'SUPPLIER_NOT_FOUND',
              message: 'One or more selected Suppliers were not found',
            });
          }

          const byId = new Map(records.map((record) => [record.id, record]));
          for (const item of input.items) {
            const current = byId.get(item.id);
            if (!current) throw this.supplierNotFound();
            if (current.version !== item.version) {
              throw this.supplierVersionConflict();
            }
          }

          const deactivatingIds =
            input.status === MasterDataStatus.ACTIVE
              ? []
              : records
                  .filter(
                    (record) => record.status === MasterDataStatus.ACTIVE,
                  )
                  .map((record) => record.id);

          if (deactivatingIds.length > 0) {
            const activeOffer = await tx.supplierOffer.findFirst({
              where: {
                supplierId: { in: deactivatingIds },
                status: MasterDataStatus.ACTIVE,
              },
              select: { supplierId: true },
            });
            if (activeOffer) {
              throw new ConflictException({
                code: 'SUPPLIER_BULK_HAS_ACTIVE_OFFERS',
                message:
                  'One or more selected Suppliers still have Active Supplier Offers. Pause or deactivate those offers before changing lifecycle.',
              });
            }
          }

          const items: SupplierResponseDto[] = [];
          let updated = 0;

          for (const item of input.items) {
            const current = byId.get(item.id);
            if (!current) throw this.supplierNotFound();

            if (current.status === input.status) {
              items.push(this.toSupplierResponse(current));
              continue;
            }

            const supplier = await tx.supplier.update({
              where: { id: item.id, version: item.version },
              data: {
                status: input.status,
                version: { increment: 1 },
                updatedById: actorId,
              },
              select: supplierSelect,
            });

            await this.audit(
              tx,
              actorId,
              'SUPPLIER_BULK_STATUS_CHANGED',
              'Supplier',
              supplier.id,
              {
                before: this.supplierSnapshot(current),
                after: this.supplierSnapshot(supplier),
              },
            );

            items.push(this.toSupplierResponse(supplier));
            updated += 1;
          }

          return { items, updated };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowSupplierPersistenceError(error);
    }
  }

  async listOffers(
    query: SupplierOfferAdminQueryDto,
  ): Promise<SupplierOfferResponseDto[]> {
    const records = await this.database.supplierOffer.findMany({
      where: {
        supplierId: query.supplierId,
        productId: query.productId,
        status: query.status,
        currency: query.currency,
      },
      select: offerSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toOfferResponse(record));
  }

  async createOffer(
    input: CreateSupplierOfferDto,
    actorId: string,
  ): Promise<SupplierOfferResponseDto> {
    const status = input.status ?? MasterDataStatus.DRAFT;
    await this.assertOfferParents(
      input.supplierId,
      input.productId,
      status,
    );
    const commercial = this.validateCommercialTerms(input);

    try {
      return await this.database.$transaction(
        async (tx) => {
          if (status === MasterDataStatus.ACTIVE) {
            await assertArticleActiveForCommerce(tx, input.productId, {
              code: 'SUPPLIER_OFFER_ARTICLE_NOT_ACTIVE',
              message:
                'An Active Supplier Offer requires an Active Manufacturer Article.',
            });
          }

          const offer = await tx.supplierOffer.create({
            data: {
              supplierId: input.supplierId,
              productId: input.productId,
              supplierSku: this.optionalText(input.supplierSku),
              unitCost: input.unitCost,
              currency: input.currency.trim().toUpperCase(),
              minOrderQuantity: input.minOrderQuantity ?? 1,
              orderMultiple: input.orderMultiple ?? 1,
              availableQuantity: input.availableQuantity ?? null,
              leadTimeDaysMin: input.leadTimeDaysMin ?? null,
              leadTimeDaysMax: input.leadTimeDaysMax ?? null,
              incoterm: input.incoterm ?? null,
              originCountryCode:
                input.originCountryCode?.trim().toUpperCase() ?? null,
              validFrom: commercial.validFrom,
              validTo: commercial.validTo,
              notes: this.optionalText(input.notes),
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: offerSelect,
          });

          await this.audit(
            tx,
            actorId,
            'SUPPLIER_OFFER_CREATED',
            'SupplierOffer',
            offer.id,
            { after: this.offerSnapshot(offer) },
          );

          return this.toOfferResponse(offer);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowOfferPersistenceError(error);
    }
  }

  async updateOffer(
    id: string,
    input: UpdateSupplierOfferDto,
    actorId: string,
  ): Promise<SupplierOfferResponseDto> {
    this.assertChanges(
      input,
      [
        'supplierId',
        'supplierSku',
        'unitCost',
        'currency',
        'minOrderQuantity',
        'orderMultiple',
        'availableQuantity',
        'leadTimeDaysMin',
        'leadTimeDaysMax',
        'incoterm',
        'originCountryCode',
        'validFrom',
        'validTo',
        'notes',
        'status',
      ],
      'SUPPLIER_OFFER_UPDATE_EMPTY',
      'At least one Supplier Offer field must be supplied',
    );

    const current = await this.database.supplierOffer.findUnique({
      where: { id },
      select: offerSelect,
    });
    if (!current) throw this.offerNotFound();
    if (current.version !== input.version) {
      throw this.offerVersionConflict();
    }

    const supplierId = input.supplierId ?? current.supplierId;
    const status = input.status ?? current.status;
    await this.assertOfferParents(supplierId, current.productId, status);

    const commercial = this.validateCommercialTerms({
      leadTimeDaysMin:
        input.leadTimeDaysMin === undefined
          ? current.leadTimeDaysMin
          : input.leadTimeDaysMin,
      leadTimeDaysMax:
        input.leadTimeDaysMax === undefined
          ? current.leadTimeDaysMax
          : input.leadTimeDaysMax,
      validFrom:
        input.validFrom === undefined
          ? current.validFrom?.toISOString() ?? null
          : input.validFrom,
      validTo:
        input.validTo === undefined
          ? current.validTo?.toISOString() ?? null
          : input.validTo,
      status,
    });

    try {
      return await this.database.$transaction(
        async (tx) => {
          if (status === MasterDataStatus.ACTIVE) {
            await assertArticleActiveForCommerce(tx, current.productId, {
              code: 'SUPPLIER_OFFER_ARTICLE_NOT_ACTIVE',
              message:
                'An Active Supplier Offer requires an Active Manufacturer Article.',
            });
          }

          const offer = await tx.supplierOffer.update({
            where: { id, version: input.version },
            data: {
              ...(input.supplierId !== undefined
                ? { supplierId: input.supplierId }
                : {}),
              ...(input.supplierSku !== undefined
                ? { supplierSku: this.optionalText(input.supplierSku) }
                : {}),
              ...(input.unitCost !== undefined
                ? { unitCost: input.unitCost }
                : {}),
              ...(input.currency !== undefined
                ? { currency: input.currency.trim().toUpperCase() }
                : {}),
              ...(input.minOrderQuantity !== undefined
                ? { minOrderQuantity: input.minOrderQuantity }
                : {}),
              ...(input.orderMultiple !== undefined
                ? { orderMultiple: input.orderMultiple }
                : {}),
              ...(input.availableQuantity !== undefined
                ? { availableQuantity: input.availableQuantity }
                : {}),
              ...(input.leadTimeDaysMin !== undefined
                ? { leadTimeDaysMin: input.leadTimeDaysMin }
                : {}),
              ...(input.leadTimeDaysMax !== undefined
                ? { leadTimeDaysMax: input.leadTimeDaysMax }
                : {}),
              ...(input.incoterm !== undefined
                ? { incoterm: input.incoterm }
                : {}),
              ...(input.originCountryCode !== undefined
                ? {
                    originCountryCode:
                      input.originCountryCode?.trim().toUpperCase() ?? null,
                  }
                : {}),
              ...(input.validFrom !== undefined
                ? { validFrom: commercial.validFrom }
                : {}),
              ...(input.validTo !== undefined
                ? { validTo: commercial.validTo }
                : {}),
              ...(input.notes !== undefined
                ? { notes: this.optionalText(input.notes) }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: offerSelect,
          });

          await this.audit(
            tx,
            actorId,
            'SUPPLIER_OFFER_UPDATED',
            'SupplierOffer',
            offer.id,
            {
              before: this.offerSnapshot(current),
              after: this.offerSnapshot(offer),
            },
          );

          return this.toOfferResponse(offer);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowOfferPersistenceError(error);
    }
  }

  private async assertOfferParents(
    supplierId: string,
    productId: string,
    status: MasterDataStatus,
  ): Promise<void> {
    const [supplier, product] = await Promise.all([
      this.database.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, status: true },
      }),
      this.database.product.findUnique({
        where: { id: productId },
        select: { id: true, status: true },
      }),
    ]);

    if (!supplier) throw this.supplierNotFound();
    if (!product) {
      throw new NotFoundException({
        code: 'MANUFACTURER_ARTICLE_NOT_FOUND',
        message: 'Manufacturer Article was not found',
      });
    }

    if (
      status === MasterDataStatus.ACTIVE &&
      supplier.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'SUPPLIER_OFFER_SUPPLIER_NOT_ACTIVE',
        message: 'An Active Supplier Offer requires an Active Supplier.',
      });
    }

    if (
      status === MasterDataStatus.ACTIVE &&
      product.status !== ProductStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'SUPPLIER_OFFER_ARTICLE_NOT_ACTIVE',
        message:
          'An Active Supplier Offer requires an Active Manufacturer Article.',
      });
    }
  }

  private validateCommercialTerms(input: {
    leadTimeDaysMin?: number | null;
    leadTimeDaysMax?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
    status?: MasterDataStatus;
  }): {
    validFrom: Date | null;
    validTo: Date | null;
  } {
    const min = input.leadTimeDaysMin ?? null;
    const max = input.leadTimeDaysMax ?? null;
    if (min !== null && max !== null && min > max) {
      throw new BadRequestException({
        code: 'SUPPLIER_OFFER_LEAD_TIME_INVALID',
        message:
          'Minimum lead time cannot be greater than maximum lead time.',
      });
    }

    const validFrom = input.validFrom ? new Date(input.validFrom) : null;
    const validTo = input.validTo ? new Date(input.validTo) : null;
    if (validFrom && validTo && validFrom > validTo) {
      throw new BadRequestException({
        code: 'SUPPLIER_OFFER_VALIDITY_INVALID',
        message: 'Offer valid-from date cannot be after valid-to date.',
      });
    }

    if (
      input.status === MasterDataStatus.ACTIVE &&
      validTo &&
      validTo.getTime() < Date.now()
    ) {
      throw new ConflictException({
        code: 'SUPPLIER_OFFER_ALREADY_EXPIRED',
        message: 'An Active Supplier Offer cannot already be expired.',
      });
    }

    return { validFrom, validTo };
  }

  private toSupplierResponse(record: SupplierView): SupplierResponseDto {
    return { ...record };
  }

  private toOfferResponse(
    record: SupplierOfferView,
  ): SupplierOfferResponseDto {
    return {
      ...record,
      unitCost: Number(record.unitCost),
    };
  }

  private supplierSnapshot(
    record: SupplierView | Supplier,
  ): Prisma.InputJsonObject {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      supplierType: record.supplierType,
      countryCode: record.countryCode,
      contactEmail: record.contactEmail,
      website: record.website,
      status: record.status,
      version: record.version,
    };
  }

  private offerSnapshot(
    record: SupplierOfferView | SupplierOffer,
  ): Prisma.InputJsonObject {
    return {
      id: record.id,
      supplierId: record.supplierId,
      productId: record.productId,
      supplierSku: record.supplierSku,
      unitCost: Number(record.unitCost),
      currency: record.currency,
      minOrderQuantity: record.minOrderQuantity,
      orderMultiple: record.orderMultiple,
      availableQuantity: record.availableQuantity,
      leadTimeDaysMin: record.leadTimeDaysMin,
      leadTimeDaysMax: record.leadTimeDaysMax,
      incoterm: record.incoterm,
      originCountryCode: record.originCountryCode,
      validFrom: record.validFrom?.toISOString() ?? null,
      validTo: record.validTo?.toISOString() ?? null,
      status: record.status,
      version: record.version,
    };
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private assertChanges(
    input: object,
    fields: string[],
    code: string,
    message: string,
  ): void {
    const record = input as Record<string, unknown>;
    if (!fields.some((field) => record[field] !== undefined)) {
      throw new BadRequestException({ code, message });
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  }

  private supplierNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'SUPPLIER_NOT_FOUND',
      message: 'Supplier was not found',
    });
  }

  private offerNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'SUPPLIER_OFFER_NOT_FOUND',
      message: 'Supplier Offer was not found',
    });
  }

  private supplierVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'SUPPLIER_VERSION_CONFLICT',
      message: 'Supplier changed; reload it before updating.',
    });
  }

  private offerVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'SUPPLIER_OFFER_VERSION_CONFLICT',
      message: 'Supplier Offer changed; reload it before updating.',
    });
  }

  private rethrowSupplierPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'SUPPLIER_ALREADY_EXISTS',
        message: 'A Supplier already uses this code.',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.supplierVersionConflict();
    }
    throw error;
  }

  private rethrowOfferPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.offerVersionConflict();
    }
    throw error;
  }
}
