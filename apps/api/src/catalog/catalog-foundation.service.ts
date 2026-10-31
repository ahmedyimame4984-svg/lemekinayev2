import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
} from '@prisma/client';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  CreateProductFamilyDto,
  CreateUnitOfMeasureDto,
  ProductFamilyAdminPageQueryDto,
  ProductFamilyAdminQueryDto,
  ProductFamilyPageResponseDto,
  ProductFamilyResponseDto,
  UnitOfMeasureAdminQueryDto,
  UnitOfMeasureResponseDto,
  UpdateProductFamilyDto,
  UpdateUnitOfMeasureDto,
} from './dto/product-foundation.dto.js';

const productFamilySelect = {
  id: true,
  categoryId: true,
  code: true,
  name: true,
  description: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductFamilySelect;

const productFamilyAdminPageSelect = {
  ...productFamilySelect,
  category: {
    select: {
      name: true,
      status: true,
    },
  },
} satisfies Prisma.ProductFamilySelect;

const unitSelect = {
  id: true,
  code: true,
  name: true,
  symbol: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UnitOfMeasureSelect;

@Injectable()
export class CatalogFoundationService {
  constructor(private readonly database: DatabaseService) {}

  listProductFamilies(
    query: ProductFamilyAdminQueryDto,
  ): Promise<ProductFamilyResponseDto[]> {
    return this.database.productFamily.findMany({
      where: {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: productFamilySelect,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  async listProductFamiliesPage(
    query: ProductFamilyAdminPageQueryDto,
  ): Promise<ProductFamilyPageResponseDto> {
    const search = query.search?.trim();
    const categorySearch = query.categorySearch?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.ProductFamilyWhereInput = {
      categoryId: query.categoryId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(categorySearch
        ? {
            category: {
              OR: [
                { name: { contains: categorySearch, mode: 'insensitive' } },
                { code: { contains: categorySearch, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      this.database.productFamily.count({ where }),
      this.database.productFamily.findMany({
        where,
        select: productFamilyAdminPageSelect,
        orderBy: [
          { categoryId: 'asc' },
          { name: 'asc' },
          { code: 'asc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map(({ category, ...record }) => ({
        ...record,
        categoryName: category.name,
        categoryStatus: category.status,
      })),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async createProductFamily(
    input: CreateProductFamilyDto,
    actorId: string,
  ): Promise<ProductFamilyResponseDto> {
    const category = await this.database.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, parentId: true, status: true },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'PART_GROUP_CATEGORY_NOT_FOUND',
        message: 'The selected Category does not exist',
      });
    }
    if (category.parentId !== null) {
      throw new BadRequestException({
        code: 'PART_GROUP_REQUIRES_ROOT_CATEGORY',
        message: 'A Part Group must belong directly to a root Category',
      });
    }

    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);
    if (
      status === MasterDataStatus.ACTIVE &&
      category.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PART_GROUP_CATEGORY_NOT_ACTIVE',
        message: 'An Active Part Group requires an Active Category',
      });
    }

    try {
      const created = await this.database.$transaction(async (transaction) => {
        const family = await transaction.productFamily.create({
          data: {
            categoryId: input.categoryId,
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            description: this.normalizeOptional(input.description),
            status,
            createdById: actorId,
            updatedById: actorId,
          },
          select: productFamilySelect,
        });

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PART_GROUP_CREATED',
            entityType: 'ProductFamily',
            entityId: family.id,
            metadata: { categoryId: family.categoryId, code: family.code },
          },
        });
        return family;
      });

      return created;
    } catch (error) {
      this.rethrowFamilyPersistenceError(error);
    }
  }

  async updateProductFamily(
    id: string,
    input: UpdateProductFamilyDto,
    actorId: string,
  ): Promise<ProductFamilyResponseDto> {
    const current = await this.database.productFamily.findUnique({ where: { id } });
    if (!current) throw this.productFamilyNotFound();
    if (current.version !== input.version) throw this.productFamilyVersionConflict();
    assertMasterRecordEditable(current.status);
    assertDirectMasterStatusChange(current.status, input.status);

    const nextCategoryId = input.categoryId ?? current.categoryId;
    const nextStatus = input.status ?? current.status;
    const category = await this.database.category.findUnique({
      where: { id: nextCategoryId },
      select: { id: true, parentId: true, status: true },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'PART_GROUP_CATEGORY_NOT_FOUND',
        message: 'The selected Category does not exist',
      });
    }
    if (category.parentId !== null) {
      throw new BadRequestException({
        code: 'PART_GROUP_REQUIRES_ROOT_CATEGORY',
        message: 'A Part Group must belong directly to a root Category',
      });
    }
    if (
      nextStatus === MasterDataStatus.ACTIVE &&
      category.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PART_GROUP_CATEGORY_NOT_ACTIVE',
        message: 'An Active Part Group requires an Active category',
      });
    }

    if (nextCategoryId !== current.categoryId) {
      const referencingType = await this.database.productType.findFirst({
        where: { productFamilyId: id },
        select: { id: true },
      });
      if (referencingType) {
        throw new ConflictException({
          code: 'PART_GROUP_IN_USE_CANNOT_MOVE',
          message:
            'A Part Group cannot move categories while Product Types reference it',
        });
      }
    }

    if (
      current.status === MasterDataStatus.ACTIVE &&
      nextStatus !== MasterDataStatus.ACTIVE
    ) {
      const [activeType, activeProduct] = await Promise.all([
        this.database.productType.findFirst({
          where: { productFamilyId: id, status: MasterDataStatus.ACTIVE },
          select: { id: true },
        }),
        this.database.product.findFirst({
          where: { productFamilyId: id, status: 'ACTIVE' },
          select: { id: true },
        }),
      ]);
      if (activeType || activeProduct) {
        throw new ConflictException({
          code: 'PART_GROUP_HAS_ACTIVE_DEPENDENCIES',
          message:
            'Deactivate dependent Product Types and Products before deactivating this Part Group',
        });
      }
    }

    try {
      return await this.database.$transaction(async (transaction) => {
        const family = await transaction.productFamily.update({
          where: { id, version: input.version },
          data: {
            categoryId: input.categoryId,
            name: input.name?.trim(),
            description:
              input.description === undefined
                ? undefined
                : this.normalizeOptional(input.description),
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: productFamilySelect,
        });

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PART_GROUP_UPDATED',
            entityType: 'ProductFamily',
            entityId: family.id,
            metadata: {
              previousVersion: input.version,
              nextVersion: input.version + 1,
              categoryId: family.categoryId,
              status: family.status,
            },
          },
        });
        return family;
      });
    } catch (error) {
      this.rethrowFamilyPersistenceError(error);
    }
  }

  listUnits(
    query: UnitOfMeasureAdminQueryDto,
  ): Promise<UnitOfMeasureResponseDto[]> {
    return this.database.unitOfMeasure.findMany({
      where: query.status ? { status: query.status } : undefined,
      select: unitSelect,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  async createUnit(
    input: CreateUnitOfMeasureDto,
    actorId: string,
  ): Promise<UnitOfMeasureResponseDto> {
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);

    try {
      return await this.database.$transaction(async (transaction) => {
        const unit = await transaction.unitOfMeasure.create({
          data: {
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            symbol: this.normalizeOptional(input.symbol),
            status,
            createdById: actorId,
            updatedById: actorId,
          },
          select: unitSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'UNIT_OF_MEASURE_CREATED',
            entityType: 'UnitOfMeasure',
            entityId: unit.id,
            metadata: { code: unit.code },
          },
        });
        return unit;
      });
    } catch (error) {
      this.rethrowUnitPersistenceError(error);
    }
  }

  async updateUnit(
    id: string,
    input: UpdateUnitOfMeasureDto,
    actorId: string,
  ): Promise<UnitOfMeasureResponseDto> {
    const current = await this.database.unitOfMeasure.findUnique({ where: { id } });
    if (!current) throw this.unitNotFound();
    if (current.version !== input.version) throw this.unitVersionConflict();
    assertMasterRecordEditable(current.status);
    assertDirectMasterStatusChange(current.status, input.status);

    const nextStatus = input.status ?? current.status;
    if (
      current.status === MasterDataStatus.ACTIVE &&
      nextStatus !== MasterDataStatus.ACTIVE
    ) {
      const activeProduct = await this.database.product.findFirst({
        where: { unitOfMeasureId: id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeProduct) {
        throw new ConflictException({
          code: 'UNIT_OF_MEASURE_HAS_ACTIVE_PRODUCTS',
          message:
            'Deactivate Products using this Unit of Measure before deactivating it',
        });
      }
    }

    try {
      return await this.database.$transaction(async (transaction) => {
        const unit = await transaction.unitOfMeasure.update({
          where: { id, version: input.version },
          data: {
            name: input.name?.trim(),
            symbol:
              input.symbol === undefined
                ? undefined
                : this.normalizeOptional(input.symbol),
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: unitSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'UNIT_OF_MEASURE_UPDATED',
            entityType: 'UnitOfMeasure',
            entityId: unit.id,
            metadata: {
              previousVersion: input.version,
              nextVersion: input.version + 1,
              status: unit.status,
            },
          },
        });
        return unit;
      });
    } catch (error) {
      this.rethrowUnitPersistenceError(error);
    }
  }

  private normalizeOptional(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private productFamilyNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PART_GROUP_NOT_FOUND',
      message: 'Part Group was not found',
    });
  }

  private productFamilyVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'PART_GROUP_VERSION_CONFLICT',
      message: 'The Part Group changed; reload before updating',
    });
  }

  private unitNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'UNIT_OF_MEASURE_NOT_FOUND',
      message: 'Unit of Measure was not found',
    });
  }

  private unitVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'UNIT_OF_MEASURE_VERSION_CONFLICT',
      message: 'The Unit of Measure changed; reload before updating',
    });
  }

  private rethrowFamilyPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PART_GROUP_ALREADY_EXISTS',
        message: 'A Part Group already uses this code',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.productFamilyVersionConflict();
    }
    throw error;
  }

  private rethrowUnitPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'UNIT_OF_MEASURE_ALREADY_EXISTS',
        message: 'A Unit of Measure already uses this code',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.unitVersionConflict();
    }
    throw error;
  }
}
