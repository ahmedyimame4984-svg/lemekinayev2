import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import { DatabaseService } from '../database/database.service.js';
import {
  articleIdentityKey,
  canonicalPartNumber,
  normalizePartNumber,
} from './article-identity.js';
import type {
  BrandAdminPageQueryDto,
  BrandAdminQueryDto,
  BrandBulkStatusResponseDto,
  BrandPageResponseDto,
  BrandResponseDto,
  BulkUpdateBrandStatusDto,
  CreateBrandDto,
  CreatePartNumberDto,
  PartNumberAdminQueryDto,
  PartNumberResponseDto,
  UpdateBrandDto,
  UpdatePartNumberDto,
} from './dto/product-identity.dto.js';

const brandSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BrandSelect;

const partNumberSelect = {
  id: true,
  productId: true,
  issuerBrandId: true,
  partNumber: true,
  rawPartNumber: true,
  normalizedPartNumber: true,
  type: true,
  isPrimary: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PartNumberSelect;

@Injectable()
export class ProductIdentityService {
  constructor(private readonly database: DatabaseService) {}

  async listAdminBrands(query: BrandAdminQueryDto): Promise<BrandResponseDto[]> {
    return this.database.brand.findMany({
      where: query.status ? { status: query.status } : undefined,
      select: brandSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async listAdminBrandsPage(
    query: BrandAdminPageQueryDto,
  ): Promise<BrandPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.BrandWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.database.brand.count({ where }),
      this.database.brand.findMany({
        where,
        select: brandSelect,
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async listPublishedBrands(): Promise<BrandResponseDto[]> {
    return this.database.brand.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: brandSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async createBrand(
    input: CreateBrandDto,
    actorId: string,
  ): Promise<BrandResponseDto> {
    const code = this.normalizeBrandCode(input.code);
    const name = input.name.trim();
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);
    if (code.length < 2 || name.length < 2) {
      throw new BadRequestException({
        code: 'BRAND_INVALID',
        message: 'Brand name and canonical code must contain meaningful characters',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const brand = await transaction.brand.create({
            data: {
              code,
              name,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: brandSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'BRAND_CREATED',
              entityType: 'Brand',
              entityId: brand.id,
              metadata: {
                code: brand.code,
                status: brand.status,
              },
            },
          });

          return brand;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowBrandPersistenceError(error);
    }
  }

  async updateBrand(
    id: string,
    input: UpdateBrandDto,
    actorId: string,
  ): Promise<BrandResponseDto> {
    const current = await this.database.brand.findUnique({
      where: { id },
      select: brandSelect,
    });
    if (!current) throw this.brandNotFound();
    if (current.version !== input.version) throw this.brandVersionConflict();
    assertMasterRecordEditable(current.status);
    assertDirectMasterStatusChange(current.status, input.status);

    const nextStatus = input.status ?? current.status;
    if (
      current.status === MasterDataStatus.ACTIVE &&
      nextStatus !== MasterDataStatus.ACTIVE
    ) {
      const [activeProduct, activePartNumber] = await Promise.all([
        this.database.product.findFirst({
          where: { brandId: id, status: ProductStatus.ACTIVE },
          select: { id: true },
        }),
        this.database.partNumber.findFirst({
          where: { issuerBrandId: id, status: MasterDataStatus.ACTIVE },
          select: { id: true },
        }),
      ]);
      if (activeProduct) {
        throw new ConflictException({
          code: 'BRAND_HAS_ACTIVE_PRODUCTS',
          message: 'Deactivate Active Products that reference this Brand first',
        });
      }
      if (activePartNumber) {
        throw new ConflictException({
          code: 'BRAND_HAS_ACTIVE_PART_NUMBERS',
          message:
            'Deactivate Active Part Numbers that reference this Brand first',
        });
      }
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const brand = await transaction.brand.update({
            where: { id, version: input.version },
            data: {
              ...(input.name !== undefined
                ? { name: this.requireBrandName(input.name) }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: brandSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'BRAND_UPDATED',
              entityType: 'Brand',
              entityId: brand.id,
              metadata: {
                previousVersion: input.version,
                nextVersion: input.version + 1,
                status: brand.status,
              },
            },
          });

          return brand;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowBrandPersistenceError(error);
    }
  }

  async bulkUpdateBrandStatus(
    input: BulkUpdateBrandStatusDto,
    actorId: string,
  ): Promise<BrandBulkStatusResponseDto> {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'BRAND_BULK_DUPLICATE_IDS',
        message: 'Each Brand can appear only once in a bulk lifecycle change',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const records = await transaction.brand.findMany({
            where: { id: { in: ids } },
            select: brandSelect,
          });
          if (records.length !== ids.length) {
            throw new NotFoundException({
              code: 'BRAND_NOT_FOUND',
              message: 'One or more selected Brands were not found',
            });
          }

          const byId = new Map(records.map((record) => [record.id, record]));
          for (const item of input.items) {
            const current = byId.get(item.id);
            if (!current) throw this.brandNotFound();
            if (current.version !== item.version) {
              throw this.brandVersionConflict();
            }
            assertMasterRecordEditable(current.status);
            assertDirectMasterStatusChange(current.status, input.status);
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
            const [activeProduct, activePartNumber] = await Promise.all([
              transaction.product.findFirst({
                where: {
                  brandId: { in: deactivatingIds },
                  status: ProductStatus.ACTIVE,
                },
                select: { brandId: true },
              }),
              transaction.partNumber.findFirst({
                where: {
                  issuerBrandId: { in: deactivatingIds },
                  status: MasterDataStatus.ACTIVE,
                },
                select: { issuerBrandId: true },
              }),
            ]);

            if (activeProduct || activePartNumber) {
              throw new ConflictException({
                code: 'BRAND_BULK_HAS_ACTIVE_DEPENDENCIES',
                message:
                  'One or more selected Brands still have Active Products or Part Numbers. Resolve those dependencies before changing lifecycle.',
              });
            }
          }

          const result: BrandResponseDto[] = [];
          let updated = 0;

          for (const item of input.items) {
            const current = byId.get(item.id);
            if (!current) throw this.brandNotFound();

            if (current.status === input.status) {
              result.push(current);
              continue;
            }

            const brand = await transaction.brand.update({
              where: { id: item.id, version: item.version },
              data: {
                status: input.status,
                version: { increment: 1 },
                updatedById: actorId,
              },
              select: brandSelect,
            });

            await transaction.auditLog.create({
              data: {
                actorId,
                action: 'BRAND_BULK_STATUS_CHANGED',
                entityType: 'Brand',
                entityId: brand.id,
                metadata: {
                  previousStatus: current.status,
                  status: brand.status,
                  previousVersion: item.version,
                  nextVersion: item.version + 1,
                },
              },
            });

            result.push(brand);
            updated += 1;
          }

          return { items: result, updated };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowBrandPersistenceError(error);
    }
  }

  async listPartNumbers(
    productId: string,
    query: PartNumberAdminQueryDto,
  ): Promise<PartNumberResponseDto[]> {
    await this.requireProduct(productId);

    return this.database.partNumber.findMany({
      where: {
        productId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.issuerBrandId
          ? { issuerBrandId: query.issuerBrandId }
          : {}),
      },
      select: partNumberSelect,
      orderBy: [{ type: 'asc' }, { normalizedPartNumber: 'asc' }],
    });
  }

  async createPartNumber(
    productId: string,
    input: CreatePartNumberDto,
    actorId: string,
  ): Promise<PartNumberResponseDto> {
    const product = await this.requireProduct(productId);
    const status = input.status ?? MasterDataStatus.DRAFT;
    const issuerBrandId = this.resolveIssuerBrandId(
      input.type,
      input.issuerBrandId ?? null,
      product.brandId,
    );
    const isPrimary = input.isPrimary ?? false;
    await this.validatePartNumberLifecycle(
      product.status,
      issuerBrandId,
      status,
    );
    await this.validatePartNumberSemantics({
      productId,
      productBrandId: product.brandId,
      issuerBrandId,
      type: input.type,
      isPrimary,
    });

    const partNumber = canonicalPartNumber(input.partNumber);
    const normalizedPartNumber = normalizePartNumber(input.partNumber);
    if (!normalizedPartNumber) {
      throw new BadRequestException({
        code: 'PART_NUMBER_INVALID',
        message: 'Part Number must contain at least one letter or digit',
      });
    }
    await this.assertArticleIdentityAvailable({
      issuerBrandId,
      type: input.type,
      normalizedPartNumber,
    });
    const identityKey = articleIdentityKey(
      input.type,
      issuerBrandId,
      normalizedPartNumber,
    );

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const record = await transaction.partNumber.create({
            data: {
              productId,
              issuerBrandId,
              partNumber,
              rawPartNumber: input.rawPartNumber?.trim() || null,
              normalizedPartNumber,
              articleIdentityKey: identityKey,
              type: input.type,
              isPrimary,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: partNumberSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PART_NUMBER_CREATED',
              entityType: 'PartNumber',
              entityId: record.id,
              metadata: {
                productId,
                after: this.jsonRecord(record),
              },
            },
          });

          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPartNumberPersistenceError(error);
    }
  }

  async updatePartNumber(
    productId: string,
    id: string,
    input: UpdatePartNumberDto,
    actorId: string,
  ): Promise<PartNumberResponseDto> {
    const product = await this.requireProduct(productId);
    const current = await this.database.partNumber.findFirst({
      where: { id, productId },
      select: partNumberSelect,
    });
    if (!current) throw this.partNumberNotFound();
    if (current.version !== input.version) {
      throw this.partNumberVersionConflict();
    }

    const type = input.type ?? current.type;
    const requestedIssuerBrandId =
      input.issuerBrandId !== undefined
        ? input.issuerBrandId
        : current.issuerBrandId;
    const issuerBrandId = this.resolveIssuerBrandId(
      type,
      requestedIssuerBrandId,
      product.brandId,
    );
    const isPrimary = input.isPrimary ?? current.isPrimary;
    const status = input.status ?? current.status;
    await this.validatePartNumberLifecycle(
      product.status,
      issuerBrandId,
      status,
    );
    await this.validatePartNumberSemantics({
      productId,
      productBrandId: product.brandId,
      issuerBrandId,
      type,
      isPrimary,
      excludeId: id,
    });

    const nextPartNumber =
      input.partNumber !== undefined
        ? canonicalPartNumber(input.partNumber)
        : current.partNumber;
    const normalizedPartNumber =
      input.partNumber !== undefined
        ? normalizePartNumber(input.partNumber)
        : current.normalizedPartNumber;
    if (!normalizedPartNumber) {
      throw new BadRequestException({
        code: 'PART_NUMBER_INVALID',
        message: 'Part Number must contain at least one letter or digit',
      });
    }
    await this.assertArticleIdentityAvailable({
      issuerBrandId,
      type,
      normalizedPartNumber,
      excludeId: id,
    });
    const identityKey = articleIdentityKey(
      type,
      issuerBrandId,
      normalizedPartNumber,
    );

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const record = await transaction.partNumber.update({
            where: { id, version: input.version },
            data: {
              issuerBrandId,
              partNumber: nextPartNumber,
              normalizedPartNumber,
              articleIdentityKey: identityKey,
              ...(input.rawPartNumber !== undefined
                ? { rawPartNumber: input.rawPartNumber.trim() || null }
                : {}),
              ...(input.type !== undefined ? { type: input.type } : {}),
              ...(input.isPrimary !== undefined
                ? { isPrimary: input.isPrimary }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: partNumberSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PART_NUMBER_UPDATED',
              entityType: 'PartNumber',
              entityId: record.id,
              metadata: {
                productId,
                before: this.jsonRecord(current),
                after: this.jsonRecord(record),
              },
            },
          });

          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPartNumberPersistenceError(error);
    }
  }

  private async requireProduct(productId: string): Promise<{
    id: string;
    brandId: string | null;
    status: ProductStatus;
  }> {
    const product = await this.database.product.findUnique({
      where: { id: productId },
      select: { id: true, brandId: true, status: true },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found',
      });
    }
    return product;
  }

  private async validatePartNumberLifecycle(
    productStatus: ProductStatus,
    issuerBrandId: string | null,
    status: MasterDataStatus,
  ): Promise<void> {
    if (issuerBrandId) {
      const brand = await this.database.brand.findUnique({
        where: { id: issuerBrandId },
        select: { status: true },
      });
      if (!brand) {
        throw new BadRequestException({
          code: 'PART_NUMBER_BRAND_NOT_FOUND',
          message: 'The selected issuing Brand does not exist',
        });
      }
      if (
        status === MasterDataStatus.ACTIVE &&
        brand.status !== MasterDataStatus.ACTIVE
      ) {
        throw new ConflictException({
          code: 'PART_NUMBER_BRAND_NOT_ACTIVE',
          message: 'Active identifiers require an Active issuing Brand',
        });
      }
    }

    if (
      status === MasterDataStatus.ACTIVE &&
      productStatus !== ProductStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PART_NUMBER_PRODUCT_NOT_ACTIVE',
        message: 'Active identifiers require an Active Manufacturer Article',
      });
    }
  }

  private resolveIssuerBrandId(
    type: PartNumberType,
    requestedIssuerBrandId: string | null,
    productBrandId: string | null,
  ): string | null {
    if (
      type === PartNumberType.MANUFACTURER ||
      type === PartNumberType.AFTERMARKET
    ) {
      return requestedIssuerBrandId ?? productBrandId;
    }
    return requestedIssuerBrandId;
  }

  private async validatePartNumberSemantics(input: {
    productId: string;
    productBrandId: string | null;
    issuerBrandId: string | null;
    type: PartNumberType;
    isPrimary: boolean;
    excludeId?: string;
  }): Promise<void> {
    if (input.type === PartNumberType.MANUFACTURER) {
      if (!input.productBrandId) {
        throw new ConflictException({
          code: 'MANUFACTURER_ARTICLE_BRAND_REQUIRED',
          message:
            'A Manufacturer Part Number requires the Manufacturer Article to have a Brand',
        });
      }
      if (input.issuerBrandId !== input.productBrandId) {
        throw new BadRequestException({
          code: 'MANUFACTURER_PART_NUMBER_ISSUER_MISMATCH',
          message:
            'A Manufacturer Part Number must be issued by the Manufacturer Article Brand',
        });
      }
    }

    if (input.type === PartNumberType.OE && !input.issuerBrandId) {
      throw new BadRequestException({
        code: 'OE_NUMBER_ISSUER_BRAND_REQUIRED',
        message:
          'An OE Number requires the vehicle/OE Brand that issued the number',
      });
    }

    if (input.isPrimary && input.type !== PartNumberType.MANUFACTURER) {
      throw new BadRequestException({
        code: 'PRIMARY_IDENTIFIER_MUST_BE_MANUFACTURER',
        message:
          'Only the Manufacturer Part Number can be the primary Article identifier',
      });
    }

    if (input.isPrimary) {
      const existingPrimary = await this.database.partNumber.findFirst({
        where: {
          productId: input.productId,
          isPrimary: true,
          ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        },
        select: { id: true },
      });
      if (existingPrimary) {
        throw new ConflictException({
          code: 'PRIMARY_MANUFACTURER_PART_NUMBER_ALREADY_EXISTS',
          message:
            'This Manufacturer Article already has a primary Manufacturer Part Number',
        });
      }
    }
  }

  private async assertArticleIdentityAvailable(input: {
    issuerBrandId: string | null;
    type: PartNumberType;
    normalizedPartNumber: string;
    excludeId?: string;
  }): Promise<void> {
    if (
      input.type !== PartNumberType.MANUFACTURER ||
      !input.issuerBrandId
    ) {
      return;
    }

    const duplicate = await this.database.partNumber.findFirst({
      where: {
        issuerBrandId: input.issuerBrandId,
        type: PartNumberType.MANUFACTURER,
        normalizedPartNumber: input.normalizedPartNumber,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      select: { id: true, productId: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'ARTICLE_IDENTITY_ALREADY_EXISTS',
        message:
          'Another Manufacturer Article already uses this Brand and Manufacturer Part Number',
        articleId: duplicate.productId,
      });
    }
  }

  private jsonRecord(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private requireBrandName(value: string): string {
    const name = value.trim();
    if (name.length < 2) {
      throw new BadRequestException({
        code: 'BRAND_INVALID',
        message: 'Brand name must contain at least two meaningful characters',
      });
    }
    return name;
  }

  private normalizeBrandCode(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/gu, '_')
      .replace(/^_+|_+$/gu, '');
  }

  private brandNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'BRAND_NOT_FOUND',
      message: 'Brand was not found',
    });
  }

  private brandVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'BRAND_VERSION_CONFLICT',
      message: 'The Brand changed; reload it before updating',
    });
  }

  private partNumberNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PART_NUMBER_NOT_FOUND',
      message: 'Part Number was not found',
    });
  }

  private partNumberVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'PART_NUMBER_VERSION_CONFLICT',
      message: 'The Part Number changed; reload it before updating',
    });
  }

  private rethrowBrandPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'BRAND_ALREADY_EXISTS',
        message: 'A Brand already uses this code',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.brandVersionConflict();
    }
    throw error;
  }

  private rethrowPartNumberPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : typeof target === 'string'
          ? [target]
          : [];
      if (
        fields.some(
          (field) =>
            field.includes('article_identity_key') ||
            field.includes('articleIdentityKey'),
        )
      ) {
        throw new ConflictException({
          code: 'ARTICLE_IDENTITY_ALREADY_EXISTS',
          message:
            'Another Manufacturer Article already uses this Brand and Manufacturer Part Number',
        });
      }
      throw new ConflictException({
        code: 'PART_NUMBER_ALREADY_EXISTS',
        message:
          'This Manufacturer Article already contains the same normalized identifier and type',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.partNumberVersionConflict();
    }
    throw error;
  }
}
