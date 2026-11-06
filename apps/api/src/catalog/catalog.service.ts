import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
  type Category,
  type ProductType,
} from '@prisma/client';
import { validateSync } from 'class-validator';
import { AdminSortDirection } from '../common/admin-sort.js';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import type {
  CreateMasterDataLocalizationDto,
  MasterDataLocalizationResponseDto,
  UpdateMasterDataLocalizationDto,
} from '../common/master-data-localization.dto.js';
import type {
  CreateExternalStandardMappingDto,
  ExternalStandardMappingResponseDto,
  UpdateExternalStandardMappingDto,
} from '../common/external-standard-mapping.dto.js';
import { parseCsv, stringifyCsv } from '../common/admin-csv.js';
import { DatabaseService } from '../database/database.service.js';
import {
  type CategoryAdminPageQueryDto,
  type CategoryAdminQueryDto,
  type CategoryPageResponseDto,
  type CategoryResponseDto,
  type CreateCategoryDto,
  type UpdateCategoryDto,
} from './dto/category.dto.js';
import {
  CreateProductTypeDto,
  ProductTypeAdminSortBy,
  type ProductTypeAdminPageQueryDto,
  type ProductTypeAdminQueryDto,
  type ProductTypeAdminSummaryDto,
  type ProductTypePageResponseDto,
  type ProductTypeResponseDto,
  type UpdateProductTypeDto,
} from './dto/product-type.dto.js';
import type {
  ProductTypeCsvExportQueryDto,
  ProductTypeCsvExportResponseDto,
  ProductTypeCsvImportCommitResponseDto,
  ProductTypeCsvImportPreviewResponseDto,
  ProductTypeCsvImportPreviewRowDto,
  ProductTypeCsvImportRequestDto,
} from './dto/product-type-import-export.dto.js';

const PRODUCT_TYPE_CSV_HEADERS = [
  'code',
  'name',
  'categoryCode',
  'partGroupCode',
  'description',
  'sortOrder',
  'brandRequirement',
  'identifierRequirement',
  'gtinRequirement',
  'oemReferenceRequirement',
  'crossReferenceRequirement',
  'fitmentRequirement',
  'imageRequirement',
  'minimumImageCount',
  'maximumImageCount',
  'documentRequirement',
  'minimumDocumentCount',
  'priceRequirement',
  'stockRequirement',
  'conditionRequirement',
  'warrantyRequirement',
  'status',
] as const;
const PRODUCT_TYPE_CSV_REQUIRED_HEADERS = [
  'code',
  'name',
  'categoryCode',
  'partGroupCode',
] as const;
const MAX_PRODUCT_TYPE_IMPORT_ROWS = 2_000;

type PreparedProductTypeImportRow = {
  preview: ProductTypeCsvImportPreviewRowDto;
  input: CreateProductTypeDto;
};

const categoryResponseSelect = {
  id: true,
  parentId: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  level: true,
  isLeaf: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

const categoryAdminPageSelect = {
  ...categoryResponseSelect,
  parent: { select: { name: true } },
} satisfies Prisma.CategorySelect;

const localizationSelect = {
  id: true,
  entityType: true,
  entityId: true,
  locale: true,
  name: true,
  description: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MasterDataLocalizationSelect;

const externalMappingSelect = {
  id: true,
  entityType: true,
  entityId: true,
  provider: true,
  standard: true,
  externalEntityType: true,
  externalIdentifier: true,
  externalVersion: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExternalStandardMappingSelect;

const productTypeResponseSelect = {
  id: true,
  categoryId: true,
  productFamilyId: true,
  parentId: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  brandRequirement: true,
  identifierRequirement: true,
  gtinRequirement: true,
  oemReferenceRequirement: true,
  crossReferenceRequirement: true,
  fitmentRequirement: true,
  imageRequirement: true,
  minimumImageCount: true,
  maximumImageCount: true,
  documentRequirement: true,
  minimumDocumentCount: true,
  priceRequirement: true,
  stockRequirement: true,
  conditionRequirement: true,
  warrantyRequirement: true,
  packageDimensionsRequirement: true,
  packageWeightRequirement: true,
  discountRequirement: true,
  transportRequirement: true,
  specialHandlingRequirement: true,
  status: true,
  version: true,
  currentSchemaVersionId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductTypeSelect;

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  async listPublishedCategories(): Promise<CategoryResponseDto[]> {
    return this.database.category.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: categoryResponseSelect,
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getPublishedCategory(id: string): Promise<CategoryResponseDto> {
    const category = await this.database.category.findFirst({
      where: { id, status: MasterDataStatus.ACTIVE },
      select: categoryResponseSelect,
    });
    if (!category) {
      throw this.categoryNotFound();
    }
    return category;
  }

  async listAdminCategories(
    query: CategoryAdminQueryDto,
  ): Promise<CategoryResponseDto[]> {
    return this.database.category.findMany({
      where: {
        status: query.status,
        parentId: query.parentId,
      },
      select: categoryResponseSelect,
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminCategoriesPage(
    query: CategoryAdminPageQueryDto,
  ): Promise<CategoryPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.CategoryWhereInput = {
      status: query.status,
      parentId: query.rootOnly ? null : query.parentId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      this.database.category.count({ where }),
      this.database.category.findMany({
        where,
        select: categoryAdminPageSelect,
        orderBy: [
          { level: 'asc' },
          { sortOrder: 'asc' },
          { name: 'asc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map(({ parent, ...record }) => ({
        ...record,
        parentName: parent?.name ?? null,
      })),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getAdminCategory(id: string): Promise<CategoryResponseDto> {
    const category = await this.database.category.findUnique({
      where: { id },
      select: categoryResponseSelect,
    });
    if (!category) throw this.categoryNotFound();
    return category;
  }

  async createCategory(
    input: CreateCategoryDto,
    actorId: string,
  ): Promise<CategoryResponseDto> {
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const category = await transaction.category.create({
            data: {
              parentId: null,
              code: input.code,
              name: input.name.trim(),
              slug: input.slug,
              description: this.normalizeDescription(input.description),
              sortOrder: input.sortOrder ?? 0,
              level: 0,
              isLeaf: true,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'CATEGORY_CREATED',
              entityType: 'Category',
              entityId: category.id,
              metadata: {
                after: this.categorySnapshot(category),
                hierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
              },
            },
          });
          return this.toCategoryResponse(category);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryDto,
    actorId: string,
  ): Promise<CategoryResponseDto> {
    if (!this.hasCategoryChanges(input)) {
      throw new BadRequestException({
        code: 'CATEGORY_UPDATE_EMPTY',
        message: 'At least one category field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current = await transaction.category.findUnique({
            where: { id },
          });
          if (!current) {
            throw this.categoryNotFound();
          }
          if (current.version !== input.version) {
            throw this.versionConflict();
          }
          assertMasterRecordEditable(current.status);
          assertDirectMasterStatusChange(current.status, input.status);

          const nextStatus = input.status ?? current.status;
          if (current.parentId !== null || current.level !== 0) {
            throw new ConflictException({
              code: 'LEGACY_NESTED_CATEGORY_NOT_SUPPORTED',
              message:
                'Nested categories are no longer supported. Use Category → Part Group → Product Type.',
            });
          }
          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const activeProductType = await transaction.productType.findFirst({
              where: { categoryId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            });
            if (activeProductType) {
              throw new ConflictException({
                code: 'CATEGORY_HAS_ACTIVE_PRODUCT_TYPES',
                message: 'Deactivate active product types first',
              });
            }
            const activeProductFamily = await transaction.productFamily.findFirst({
              where: { categoryId: id, status: MasterDataStatus.ACTIVE },
              select: { id: true },
            });
            if (activeProductFamily) {
              throw new ConflictException({
                code: 'CATEGORY_HAS_ACTIVE_PRODUCT_FAMILIES',
                message: 'Deactivate active Product Families first',
              });
            }
          }

          const category = await transaction.category.update({
            where: { id, version: input.version },
            data: {
              name: input.name?.trim(),
              slug: input.slug,
              description:
                input.description === undefined
                  ? undefined
                  : this.normalizeDescription(input.description),
              sortOrder: input.sortOrder,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'CATEGORY_UPDATED',
              entityType: 'Category',
              entityId: category.id,
              metadata: {
                before: this.categorySnapshot(current),
                after: this.categorySnapshot(category),
              },
            },
          });
          return this.toCategoryResponse(category);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }


  async listAdminProductTypes(
    query: ProductTypeAdminQueryDto,
  ): Promise<ProductTypeResponseDto[]> {
    return this.database.productType.findMany({
      where: {
        status: query.status,
        categoryId: query.categoryId,
        productFamilyId: query.productFamilyId,
      },
      select: productTypeResponseSelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminProductTypesPage(
    query: ProductTypeAdminPageQueryDto,
  ): Promise<ProductTypePageResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.productTypeWhere(query);
    const orderBy = this.productTypeOrderBy(
      query.sortBy,
      query.sortDirection,
    );

    const [total, items] = await Promise.all([
      this.database.productType.count({ where }),
      this.database.productType.findMany({
        where,
        select: productTypeResponseSelect,
        orderBy,
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

  async exportProductTypesCsv(
    query: ProductTypeCsvExportQueryDto,
  ): Promise<ProductTypeCsvExportResponseDto> {
    const productTypes = await this.database.productType.findMany({
      where: this.productTypeWhere(query),
      select: productTypeResponseSelect,
      orderBy: this.productTypeOrderBy(query.sortBy, query.sortDirection),
    });
    const categoryIds = [
      ...new Set(productTypes.map((item) => item.categoryId)),
    ];
    const familyIds = [
      ...new Set(
        productTypes
          .map((item) => item.productFamilyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [categories, families] = await Promise.all([
      categoryIds.length === 0
        ? Promise.resolve([])
        : this.database.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, code: true },
          }),
      familyIds.length === 0
        ? Promise.resolve([])
        : this.database.productFamily.findMany({
            where: { id: { in: familyIds } },
            select: { id: true, code: true },
          }),
    ]);
    const categoryCodeById = new Map(
      categories.map((category) => [category.id, category.code]),
    );
    const familyCodeById = new Map(
      families.map((family) => [family.id, family.code]),
    );

    return {
      filename: 'lemekinaye-product-types.csv',
      csv: stringifyCsv([
        PRODUCT_TYPE_CSV_HEADERS,
        ...productTypes.map((item) => [
          item.code,
          item.name,
          categoryCodeById.get(item.categoryId) ?? '',
          item.productFamilyId
            ? (familyCodeById.get(item.productFamilyId) ?? '')
            : '',
          item.description ?? '',
          item.sortOrder,
          item.brandRequirement,
          item.identifierRequirement,
          item.gtinRequirement,
          item.oemReferenceRequirement,
          item.crossReferenceRequirement,
          item.fitmentRequirement,
          item.imageRequirement,
          item.minimumImageCount,
          item.maximumImageCount,
          item.documentRequirement,
          item.minimumDocumentCount,
          item.priceRequirement,
          item.stockRequirement,
          item.conditionRequirement,
          item.warrantyRequirement,
          item.status,
        ]),
      ]),
    };
  }

  async previewProductTypeCsvImport(
    request: ProductTypeCsvImportRequestDto,
  ): Promise<ProductTypeCsvImportPreviewResponseDto> {
    const prepared = await this.prepareProductTypeCsvImport(request.csv);
    return this.productTypeImportPreview(prepared);
  }

  async commitProductTypeCsvImport(
    request: ProductTypeCsvImportRequestDto,
    actorId: string,
  ): Promise<ProductTypeCsvImportCommitResponseDto> {
    const prepared = await this.prepareProductTypeCsvImport(request.csv);
    const preview = this.productTypeImportPreview(prepared);
    if (preview.invalidRows > 0 || preview.totalRows === 0) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_IMPORT_INVALID',
        message:
          preview.totalRows === 0
            ? 'The CSV does not contain any Product Type rows'
            : 'Fix all Product Type import errors before committing',
        preview,
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const createdCodes: string[] = [];
          for (const row of prepared) {
            const created = await this.createProductTypeRecord(
              transaction,
              row.input,
              actorId,
            );
            createdCodes.push(created.code);
          }
          await transaction.adminImportJob.create({
            data: {
              workflow: 'PRODUCT_TYPE_LIBRARY',
              fileName: request.fileName?.trim() || null,
              fileFormat: 'CSV',
              status: 'COMPLETED',
              totalRows: preview.totalRows,
              includedRows: preview.totalRows,
              excludedRows: 0,
              warningRows: 0,
              createdCount: createdCodes.length,
              metadata: { createdCodes },
              createdById: actorId,
            },
          });

          return {
            createdCount: createdCodes.length,
            createdCodes,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowProductTypePersistenceError(error);
    }
  }

  async getAdminProductTypeSummary(): Promise<ProductTypeAdminSummaryDto> {
    const [total, published, draft, needsPublication] = await Promise.all([
      this.database.productType.count(),
      this.database.productType.count({
        where: { currentSchemaVersionId: { not: null } },
      }),
      this.database.productType.count({
        where: { status: MasterDataStatus.DRAFT },
      }),
      this.database.productType.count({
        where: {
          status: { not: MasterDataStatus.ARCHIVED },
          currentSchemaVersionId: null,
        },
      }),
    ]);

    return { total, published, draft, needsPublication };
  }

  async getAdminProductType(id: string): Promise<ProductTypeResponseDto> {
    const productType = await this.database.productType.findUnique({
      where: { id },
      select: productTypeResponseSelect,
    });
    if (!productType) throw this.productTypeNotFound();
    return productType;
  }

  async listProductTypeLocalizations(
    id: string,
  ): Promise<MasterDataLocalizationResponseDto[]> {
    const productType = await this.database.productType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!productType) throw this.productTypeNotFound();

    return this.database.masterDataLocalization.findMany({
      where: { entityType: 'ProductType', entityId: id },
      select: localizationSelect,
      orderBy: [{ locale: 'asc' }],
    });
  }

  async createProductTypeLocalization(
    id: string,
    input: CreateMasterDataLocalizationDto,
    actorId: string,
  ): Promise<MasterDataLocalizationResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id },
            select: { id: true, code: true },
          });
          if (!productType) throw this.productTypeNotFound();

          const localization = await transaction.masterDataLocalization.create({
            data: {
              entityType: 'ProductType',
              entityId: id,
              locale: this.normalizeLocale(input.locale),
              name: input.name.trim(),
              description: this.normalizeOptionalText(input.description),
              createdById: actorId,
              updatedById: actorId,
            },
            select: localizationSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'MASTER_DATA_LOCALIZATION_CREATED',
              entityType: 'MasterDataLocalization',
              entityId: localization.id,
              metadata: {
                targetEntityType: 'ProductType',
                targetEntityId: id,
                targetCode: productType.code,
                after: this.jsonValue(localization),
              },
            },
          });
          return localization;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowLocalizationPersistenceError(error);
    }
  }

  async updateProductTypeLocalization(
    productTypeId: string,
    localizationId: string,
    input: UpdateMasterDataLocalizationDto,
    actorId: string,
  ): Promise<MasterDataLocalizationResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id: productTypeId },
            select: { id: true, code: true },
          });
          if (!productType) throw this.productTypeNotFound();

          const current = await transaction.masterDataLocalization.findUnique({
            where: { id: localizationId },
            select: localizationSelect,
          });
          if (
            !current ||
            current.entityType !== 'ProductType' ||
            current.entityId !== productTypeId
          ) {
            throw this.localizationNotFound();
          }
          if (current.version !== input.version) {
            throw this.localizationVersionConflict();
          }

          const localization = await transaction.masterDataLocalization.update({
            where: { id: localizationId, version: input.version },
            data: {
              name: input.name?.trim(),
              description:
                input.description === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.description),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: localizationSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'MASTER_DATA_LOCALIZATION_UPDATED',
              entityType: 'MasterDataLocalization',
              entityId: localization.id,
              metadata: {
                targetEntityType: 'ProductType',
                targetEntityId: productTypeId,
                targetCode: productType.code,
                before: this.jsonValue(current),
                after: this.jsonValue(localization),
              },
            },
          });
          return localization;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowLocalizationPersistenceError(error);
    }
  }

  async deleteProductTypeLocalization(
    productTypeId: string,
    localizationId: string,
    version: number,
    actorId: string,
  ): Promise<MasterDataLocalizationResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id: productTypeId },
            select: { id: true, code: true },
          });
          if (!productType) throw this.productTypeNotFound();

          const current = await transaction.masterDataLocalization.findUnique({
            where: { id: localizationId },
            select: localizationSelect,
          });
          if (
            !current ||
            current.entityType !== 'ProductType' ||
            current.entityId !== productTypeId
          ) {
            throw this.localizationNotFound();
          }
          if (current.version !== version) {
            throw this.localizationVersionConflict();
          }

          await transaction.masterDataLocalization.delete({
            where: { id: localizationId, version },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'MASTER_DATA_LOCALIZATION_REMOVED',
              entityType: 'MasterDataLocalization',
              entityId: localizationId,
              metadata: {
                targetEntityType: 'ProductType',
                targetEntityId: productTypeId,
                targetCode: productType.code,
                before: this.jsonValue(current),
              },
            },
          });
          return current;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowLocalizationPersistenceError(error);
    }
  }

  async listProductTypeExternalMappings(
    id: string,
  ): Promise<ExternalStandardMappingResponseDto[]> {
    const productType = await this.database.productType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!productType) throw this.productTypeNotFound();

    return this.database.externalStandardMapping.findMany({
      where: {
        entityType: 'ProductType',
        entityId: id,
      },
      select: externalMappingSelect,
      orderBy: [
        { provider: 'asc' },
        { standard: 'asc' },
        { externalEntityType: 'asc' },
        { externalIdentifier: 'asc' },
      ],
    });
  }

  async createProductTypeExternalMapping(
    id: string,
    input: CreateExternalStandardMappingDto,
    actorId: string,
  ): Promise<ExternalStandardMappingResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id },
            select: { id: true, code: true },
          });
          if (!productType) throw this.productTypeNotFound();

          const mapping = await transaction.externalStandardMapping.create({
            data: {
              entityType: 'ProductType',
              entityId: id,
              provider: input.provider.trim(),
              standard: input.standard.trim(),
              externalEntityType: input.externalEntityType.trim(),
              externalIdentifier: input.externalIdentifier.trim(),
              externalVersion: this.normalizeOptionalText(
                input.externalVersion,
              ),
              notes: this.normalizeOptionalText(input.notes),
              createdById: actorId,
              updatedById: actorId,
            },
            select: externalMappingSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'EXTERNAL_STANDARD_MAPPING_CREATED',
              entityType: 'ExternalStandardMapping',
              entityId: mapping.id,
              metadata: {
                targetEntityType: 'ProductType',
                targetEntityId: id,
                targetCode: productType.code,
                after: this.jsonValue(mapping),
              },
            },
          });
          return mapping;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowExternalMappingPersistenceError(error);
    }
  }

  async updateProductTypeExternalMapping(
    productTypeId: string,
    mappingId: string,
    input: UpdateExternalStandardMappingDto,
    actorId: string,
  ): Promise<ExternalStandardMappingResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id: productTypeId },
            select: { id: true, code: true },
          });
          if (!productType) throw this.productTypeNotFound();

          const current = await transaction.externalStandardMapping.findUnique({
            where: { id: mappingId },
            select: externalMappingSelect,
          });
          if (
            !current ||
            current.entityType !== 'ProductType' ||
            current.entityId !== productTypeId
          ) {
            throw this.externalMappingNotFound();
          }
          if (current.version !== input.version) {
            throw this.externalMappingVersionConflict();
          }

          const mapping = await transaction.externalStandardMapping.update({
            where: { id: mappingId, version: input.version },
            data: {
              provider: input.provider?.trim(),
              standard: input.standard?.trim(),
              externalEntityType: input.externalEntityType?.trim(),
              externalIdentifier: input.externalIdentifier?.trim(),
              externalVersion:
                input.externalVersion === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.externalVersion),
              notes:
                input.notes === undefined
                  ? undefined
                  : this.normalizeOptionalText(input.notes),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: externalMappingSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'EXTERNAL_STANDARD_MAPPING_UPDATED',
              entityType: 'ExternalStandardMapping',
              entityId: mapping.id,
              metadata: {
                targetEntityType: 'ProductType',
                targetEntityId: productTypeId,
                targetCode: productType.code,
                before: this.jsonValue(current),
                after: this.jsonValue(mapping),
              },
            },
          });
          return mapping;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowExternalMappingPersistenceError(error);
    }
  }

  async deleteProductTypeExternalMapping(
    productTypeId: string,
    mappingId: string,
    version: number,
    actorId: string,
  ): Promise<ExternalStandardMappingResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const productType = await transaction.productType.findUnique({
            where: { id: productTypeId },
            select: { id: true, code: true },
          });
          if (!productType) throw this.productTypeNotFound();

          const current = await transaction.externalStandardMapping.findUnique({
            where: { id: mappingId },
            select: externalMappingSelect,
          });
          if (
            !current ||
            current.entityType !== 'ProductType' ||
            current.entityId !== productTypeId
          ) {
            throw this.externalMappingNotFound();
          }
          if (current.version !== version) {
            throw this.externalMappingVersionConflict();
          }

          await transaction.externalStandardMapping.delete({
            where: { id: mappingId, version },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'EXTERNAL_STANDARD_MAPPING_REMOVED',
              entityType: 'ExternalStandardMapping',
              entityId: mappingId,
              metadata: {
                targetEntityType: 'ProductType',
                targetEntityId: productTypeId,
                targetCode: productType.code,
                before: this.jsonValue(current),
              },
            },
          });
          return current;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowExternalMappingPersistenceError(error);
    }
  }

  async createProductType(
    input: CreateProductTypeDto,
    actorId: string,
  ): Promise<ProductTypeResponseDto> {
    try {
      return await this.database.$transaction(
        (transaction) =>
          this.createProductTypeRecord(transaction, input, actorId),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowProductTypePersistenceError(error);
    }
  }

  async updateProductType(
    id: string,
    input: UpdateProductTypeDto,
    actorId: string,
  ): Promise<ProductTypeResponseDto> {
    if (!this.hasProductTypeChanges(input)) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_UPDATE_EMPTY',
        message: 'At least one Product Type field must be supplied',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current = await transaction.productType.findUnique({
            where: { id },
          });
          if (!current) throw this.productTypeNotFound();
          if (current.version !== input.version) {
            throw this.productTypeVersionConflict();
          }
          assertMasterRecordEditable(current.status);
          assertDirectMasterStatusChange(current.status, input.status);
          if (current.parentId !== null) {
            throw new ConflictException({
              code: 'LEGACY_NESTED_PRODUCT_TYPE_NOT_SUPPORTED',
              message:
                'Nested Product Types are no longer supported. Use Category → Part Group → Product Type.',
            });
          }

          const categoryId = input.categoryId ?? current.categoryId;
          const category = await transaction.category.findUnique({
            where: { id: categoryId },
          });
          if (!category) {
            throw new BadRequestException({
              code: 'PRODUCT_TYPE_CATEGORY_NOT_FOUND',
              message: 'The selected Category does not exist',
            });
          }
          if (category.parentId !== null || category.level !== 0) {
            throw new BadRequestException({
              code: 'PRODUCT_TYPE_REQUIRES_ROOT_CATEGORY',
              message:
                'Product Types must use a root Category. Use Part Group for the middle catalog level.',
            });
          }

          const productFamilyId =
            input.productFamilyId ?? current.productFamilyId;
          if (!productFamilyId) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_PART_GROUP_REQUIRED',
              message: 'Every Product Type must belong to a Part Group',
            });
          }

          const partGroup = await transaction.productFamily.findUnique({
            where: { id: productFamilyId },
          });
          if (!partGroup) {
            throw new BadRequestException({
              code: 'PRODUCT_TYPE_PART_GROUP_NOT_FOUND',
              message: 'The selected Part Group does not exist',
            });
          }
          if (partGroup.categoryId !== categoryId) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_PART_GROUP_CATEGORY_MISMATCH',
              message:
                'The selected Part Group must belong to the selected Category',
            });
          }

          const nextStatus = input.status ?? current.status;
          const nextImageRequirement =
            input.imageRequirement ?? current.imageRequirement;
          const nextMinimumImageCount = this.normalizeImageRequirement(
            nextImageRequirement,
            input.minimumImageCount,
            current.minimumImageCount,
          );
          const nextMaximumImageCount = this.normalizeMaximumImageCount(
            nextImageRequirement, input.maximumImageCount,
            current.imageRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE ? 20 : current.maximumImageCount,
            nextMinimumImageCount,
          );
          const nextDocumentRequirement =
            input.documentRequirement ?? current.documentRequirement;
          const nextMinimumDocumentCount = this.normalizeDocumentRequirement(
            nextDocumentRequirement,
            input.minimumDocumentCount,
            current.minimumDocumentCount,
          );
          if (
            nextStatus === MasterDataStatus.ACTIVE &&
            category.status !== MasterDataStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE',
              message: 'An Active Product Type requires an Active Category',
            });
          }
          if (
            nextStatus === MasterDataStatus.ACTIVE &&
            partGroup.status !== MasterDataStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: 'PRODUCT_TYPE_PART_GROUP_NOT_ACTIVE',
              message: 'An Active Product Type requires an Active Part Group',
            });
          }

          if (
            current.status === MasterDataStatus.ACTIVE &&
            nextStatus !== MasterDataStatus.ACTIVE
          ) {
            const activeAssignment =
              await transaction.productTypeAttributeAssignment.findFirst({
                where: {
                  productTypeId: id,
                  status: MasterDataStatus.ACTIVE,
                },
                select: { id: true },
              });
            if (activeAssignment) {
              throw new ConflictException({
                code: 'PRODUCT_TYPE_HAS_ACTIVE_ATTRIBUTE_ASSIGNMENTS',
                message: 'Deactivate active attribute assignments first',
              });
            }
          }

          const productType = await transaction.productType.update({
            where: { id, version: input.version },
            data: {
              categoryId: input.categoryId,
              productFamilyId: input.productFamilyId,
              parentId: null,
              name: input.name?.trim(),
              slug: input.slug,
              description:
                input.description === undefined
                  ? undefined
                  : this.normalizeDescription(input.description),
              sortOrder: input.sortOrder,
              brandRequirement: input.brandRequirement,
              identifierRequirement: input.identifierRequirement,
              gtinRequirement: input.gtinRequirement,
              oemReferenceRequirement: input.oemReferenceRequirement,
              crossReferenceRequirement: input.crossReferenceRequirement,
              fitmentRequirement: input.fitmentRequirement,
              ...(input.imageRequirement !== undefined ||
              input.minimumImageCount !== undefined ||
              input.maximumImageCount !== undefined
                ? {
                    imageRequirement: nextImageRequirement,
                    minimumImageCount: nextMinimumImageCount,
                    maximumImageCount: nextMaximumImageCount,
                  }
                : {}),
              ...(input.documentRequirement !== undefined ||
              input.minimumDocumentCount !== undefined
                ? {
                    documentRequirement: nextDocumentRequirement,
                    minimumDocumentCount: nextMinimumDocumentCount,
                  }
                : {}),
              priceRequirement: input.priceRequirement,
              stockRequirement: input.stockRequirement,
              conditionRequirement: input.conditionRequirement,
              warrantyRequirement: input.warrantyRequirement,
              packageDimensionsRequirement: input.packageDimensionsRequirement,
              packageWeightRequirement: input.packageWeightRequirement,
              discountRequirement: input.discountRequirement,
              transportRequirement: input.transportRequirement,
              specialHandlingRequirement: input.specialHandlingRequirement,
              status: input.status,
              version: { increment: 1 },
              updatedById: actorId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_TYPE_UPDATED',
              entityType: 'ProductType',
              entityId: productType.id,
              metadata: {
                before: this.productTypeSnapshot(current),
                after: this.productTypeSnapshot(productType),
              },
            },
          });
          return this.toProductTypeResponse(productType);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowProductTypePersistenceError(error);
    }
  }

  private productTypeWhere(
    query: ProductTypeAdminPageQueryDto | ProductTypeCsvExportQueryDto,
  ): Prisma.ProductTypeWhereInput {
    const search = query.search?.trim();
    return {
      status: query.status,
      categoryId: query.categoryId,
      productFamilyId: query.productFamilyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private productTypeOrderBy(
    sortBy: ProductTypeAdminSortBy | undefined,
    sortDirection: AdminSortDirection | undefined,
  ): Prisma.ProductTypeOrderByWithRelationInput[] {
    const direction =
      sortDirection === AdminSortDirection.DESC ? 'desc' : 'asc';
    return sortBy === ProductTypeAdminSortBy.NAME
      ? [{ name: direction }, { code: 'asc' }, { id: 'asc' }]
      : sortBy === ProductTypeAdminSortBy.CODE
        ? [{ code: direction }, { id: 'asc' }]
        : sortBy === ProductTypeAdminSortBy.STATUS
          ? [{ status: direction }, { name: 'asc' }, { id: 'asc' }]
          : sortBy === ProductTypeAdminSortBy.UPDATED_AT
            ? [{ updatedAt: direction }, { id: 'asc' }]
            : sortBy === ProductTypeAdminSortBy.CREATED_AT
              ? [{ createdAt: direction }, { id: 'asc' }]
              : [
                  { sortOrder: direction },
                  { name: 'asc' },
                  { id: 'asc' },
                ];
  }

  private async prepareProductTypeCsvImport(
    csv: string,
  ): Promise<PreparedProductTypeImportRow[]> {
    let parsed: string[][];
    try {
      parsed = parseCsv(csv);
    } catch (error) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_IMPORT_CSV_INVALID',
        message:
          error instanceof Error ? error.message : 'The CSV could not be parsed',
      });
    }

    const nonEmptyRows = parsed.filter((row) =>
      row.some((cell) => cell.trim().length > 0),
    );
    if (nonEmptyRows.length === 0) return [];

    const headers = nonEmptyRows[0].map((header) =>
      header.trim().toLowerCase(),
    );
    const supported = new Set(
      PRODUCT_TYPE_CSV_HEADERS.map((header) => header.toLowerCase()),
    );
    const duplicateHeaders = headers.filter(
      (header, index) => headers.indexOf(header) !== index,
    );
    const unsupportedHeaders = headers.filter(
      (header) => !supported.has(header),
    );
    const missingHeaders = PRODUCT_TYPE_CSV_REQUIRED_HEADERS.filter(
      (header) => !headers.includes(header.toLowerCase()),
    );
    if (
      duplicateHeaders.length > 0 ||
      unsupportedHeaders.length > 0 ||
      missingHeaders.length > 0
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_IMPORT_HEADERS_INVALID',
        message: 'The Product Type CSV headers are invalid',
        duplicateHeaders: [...new Set(duplicateHeaders)],
        unsupportedHeaders: [...new Set(unsupportedHeaders)],
        missingHeaders,
      });
    }

    const dataRows = nonEmptyRows.slice(1);
    if (dataRows.length > MAX_PRODUCT_TYPE_IMPORT_ROWS) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_IMPORT_TOO_LARGE',
        message: `Product Type CSV import supports at most ${MAX_PRODUCT_TYPE_IMPORT_ROWS} rows per batch`,
      });
    }

    const headerIndex = new Map(
      headers.map((header, index) => [header, index]),
    );
    const cell = (row: string[], header: string): string => {
      const index = headerIndex.get(header.toLowerCase());
      return index === undefined ? '' : (row[index] ?? '').trim();
    };

    const rawRows = dataRows.map((row, index) => {
      const numericErrors: string[] = [];
      return {
        row,
        rowNumber: index + 2,
        code: cell(row, 'code').toUpperCase(),
        name: cell(row, 'name'),
        categoryCode: cell(row, 'categoryCode').toUpperCase(),
        partGroupCode: cell(row, 'partGroupCode').toUpperCase(),
        description: cell(row, 'description') || null,
        sortOrder: this.parseCsvInteger(
          cell(row, 'sortOrder'),
          'sortOrder',
          numericErrors,
        ),
        brandRequirement:
          cell(row, 'brandRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.OPTIONAL,
        identifierRequirement:
          cell(row, 'identifierRequirement').toUpperCase() ||
          ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
        gtinRequirement:
          cell(row, 'gtinRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.OPTIONAL,
        oemReferenceRequirement:
          cell(row, 'oemReferenceRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.OPTIONAL,
        crossReferenceRequirement:
          cell(row, 'crossReferenceRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.OPTIONAL,
        fitmentRequirement:
          cell(row, 'fitmentRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.REQUIRED,
        imageRequirement:
          cell(row, 'imageRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: this.parseCsvInteger(
          cell(row, 'minimumImageCount'),
          'minimumImageCount',
          numericErrors,
        ),
        maximumImageCount: cell(row, 'maximumImageCount')
          ? this.parseCsvInteger(
              cell(row, 'maximumImageCount'),
              'maximumImageCount',
              numericErrors,
            )
          : undefined,
        documentRequirement:
          cell(row, 'documentRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: this.parseCsvInteger(
          cell(row, 'minimumDocumentCount'),
          'minimumDocumentCount',
          numericErrors,
        ),
        priceRequirement:
          cell(row, 'priceRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.REQUIRED,
        stockRequirement:
          cell(row, 'stockRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.REQUIRED,
        conditionRequirement:
          cell(row, 'conditionRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.REQUIRED,
        warrantyRequirement:
          cell(row, 'warrantyRequirement').toUpperCase() ||
          ProductTypeRequirementLevel.OPTIONAL,
        status:
          cell(row, 'status').toUpperCase() || MasterDataStatus.DRAFT,
        numericErrors,
      };
    });

    const categoryCodes = [
      ...new Set(rawRows.map((row) => row.categoryCode).filter(Boolean)),
    ];
    const partGroupCodes = [
      ...new Set(rawRows.map((row) => row.partGroupCode).filter(Boolean)),
    ];
    const codes = [...new Set(rawRows.map((row) => row.code).filter(Boolean))];
    const slugs = [
      ...new Set(
        rawRows
          .map((row) => this.createProductTypeSlug(row.name))
          .filter(Boolean),
      ),
    ];

    const [categories, partGroups, existingProductTypes] = await Promise.all([
      categoryCodes.length === 0
        ? Promise.resolve([])
        : this.database.category.findMany({
            where: { code: { in: categoryCodes }, parentId: null },
            select: {
              id: true,
              code: true,
              status: true,
              parentId: true,
              level: true,
            },
          }),
      partGroupCodes.length === 0
        ? Promise.resolve([])
        : this.database.productFamily.findMany({
            where: { code: { in: partGroupCodes } },
            select: {
              id: true,
              code: true,
              categoryId: true,
              status: true,
            },
          }),
      codes.length === 0 && slugs.length === 0
        ? Promise.resolve([])
        : this.database.productType.findMany({
            where: {
              OR: [
                ...(codes.length > 0 ? [{ code: { in: codes } }] : []),
                ...(slugs.length > 0 ? [{ slug: { in: slugs } }] : []),
              ],
            },
            select: { code: true, slug: true },
          }),
    ]);

    const categoryByCode = new Map(
      categories.map((category) => [category.code, category]),
    );
    const partGroupByCode = new Map(
      partGroups.map((group) => [group.code, group]),
    );
    const existingCodes = new Set(
      existingProductTypes.map((item) => item.code),
    );
    const existingSlugs = new Set(
      existingProductTypes.map((item) => item.slug),
    );
    const fileCodeCounts = this.countCsvValues(rawRows.map((row) => row.code));
    const fileSlugCounts = this.countCsvValues(
      rawRows.map((row) => this.createProductTypeSlug(row.name)),
    );

    return rawRows.map((row) => {
      const errors = [...row.numericErrors];
      if (row.row.length > headers.length) {
        errors.push('Row contains more columns than the CSV header');
      }

      const category = categoryByCode.get(row.categoryCode);
      const partGroup = partGroupByCode.get(row.partGroupCode);
      const slug = this.createProductTypeSlug(row.name);

      if (!category) {
        errors.push(`Category ${row.categoryCode || '(missing)'} was not found`);
      } else if (category.parentId !== null || category.level !== 0) {
        errors.push('Product Types require a root Category');
      }
      if (!partGroup) {
        errors.push(
          `Part Group ${row.partGroupCode || '(missing)'} was not found`,
        );
      }
      if (
        category &&
        partGroup &&
        partGroup.categoryId !== category.id
      ) {
        errors.push('Part Group does not belong to the selected Category');
      }
      if ((fileCodeCounts.get(row.code) ?? 0) > 1) {
        errors.push('Product Type code is duplicated within this CSV');
      }
      if (slug && (fileSlugCounts.get(slug) ?? 0) > 1) {
        errors.push('Generated Product Type slug is duplicated within this CSV');
      }
      if (row.code && existingCodes.has(row.code)) {
        errors.push('Product Type code already exists');
      }
      if (slug && existingSlugs.has(slug)) {
        errors.push('Generated Product Type slug already exists');
      }

      const input = Object.assign(new CreateProductTypeDto(), {
        categoryId: category?.id ?? '',
        productFamilyId: partGroup?.id ?? '',
        code: row.code,
        name: row.name,
        slug,
        description: row.description,
        sortOrder: row.sortOrder,
        brandRequirement:
          row.brandRequirement as ProductTypeRequirementLevel,
        identifierRequirement:
          row.identifierRequirement as ProductTypeIdentifierRequirement,
        gtinRequirement:
          row.gtinRequirement as ProductTypeRequirementLevel,
        oemReferenceRequirement:
          row.oemReferenceRequirement as ProductTypeRequirementLevel,
        crossReferenceRequirement:
          row.crossReferenceRequirement as ProductTypeRequirementLevel,
        fitmentRequirement:
          row.fitmentRequirement as ProductTypeRequirementLevel,
        imageRequirement:
          row.imageRequirement as ProductTypeRequirementLevel,
        minimumImageCount: row.minimumImageCount,
        maximumImageCount: row.maximumImageCount,
        documentRequirement:
          row.documentRequirement as ProductTypeRequirementLevel,
        minimumDocumentCount: row.minimumDocumentCount,
        priceRequirement:
          row.priceRequirement as ProductTypeRequirementLevel,
        stockRequirement:
          row.stockRequirement as ProductTypeRequirementLevel,
        conditionRequirement:
          row.conditionRequirement as ProductTypeRequirementLevel,
        warrantyRequirement:
          row.warrantyRequirement as ProductTypeRequirementLevel,
        status: row.status as MasterDataStatus,
      });

      errors.push(
        ...validateSync(input)
          .filter(
            (error) =>
              !(
                (error.property === 'categoryId' && !category) ||
                (error.property === 'productFamilyId' && !partGroup)
              ),
          )
          .flatMap((error) => Object.values(error.constraints ?? {})),
      );

      if (
        category &&
        input.status === MasterDataStatus.ACTIVE &&
        category.status !== MasterDataStatus.ACTIVE
      ) {
        errors.push('An Active Product Type requires an Active Category');
      }
      if (
        partGroup &&
        input.status === MasterDataStatus.ACTIVE &&
        partGroup.status !== MasterDataStatus.ACTIVE
      ) {
        errors.push('An Active Product Type requires an Active Part Group');
      }

      return {
        preview: {
          rowNumber: row.rowNumber,
          code: row.code,
          name: row.name,
          categoryCode: row.categoryCode,
          partGroupCode: row.partGroupCode,
          status: row.status,
          errors: [...new Set(errors)],
        },
        input,
      };
    });
  }

  private productTypeImportPreview(
    prepared: PreparedProductTypeImportRow[],
  ): ProductTypeCsvImportPreviewResponseDto {
    const rows = prepared.map((row) => row.preview);
    const invalidRows = rows.filter((row) => row.errors.length > 0).length;
    return {
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
      rows,
    };
  }

  private parseCsvInteger(
    value: string,
    field: string,
    errors: string[],
  ): number | undefined {
    if (!value) return undefined;
    if (!/^\d+$/u.test(value)) {
      errors.push(`${field} must be a whole number`);
      return undefined;
    }
    return Number(value);
  }

  private countCsvValues(values: string[]): Map<string, number> {
    return values.reduce<Map<string, number>>((counts, value) => {
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map());
  }

  private createProductTypeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '');
  }

  private async createProductTypeRecord(
    transaction: Prisma.TransactionClient,
    input: CreateProductTypeDto,
    actorId: string,
  ): Promise<ProductTypeResponseDto> {
    const category = await transaction.category.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_CATEGORY_NOT_FOUND',
        message: 'The selected Category does not exist',
      });
    }
    if (category.parentId !== null || category.level !== 0) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_REQUIRES_ROOT_CATEGORY',
        message:
          'Product Types must use a root Category. Use Part Group for the middle catalog level.',
      });
    }

    const partGroup = await transaction.productFamily.findUnique({
      where: { id: input.productFamilyId },
    });
    if (!partGroup) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_PART_GROUP_NOT_FOUND',
        message: 'The selected Part Group does not exist',
      });
    }
    if (partGroup.categoryId !== input.categoryId) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_PART_GROUP_CATEGORY_MISMATCH',
        message:
          'The selected Part Group must belong to the selected Category',
      });
    }

    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);
    const imageRequirement =
      input.imageRequirement ?? ProductTypeRequirementLevel.REQUIRED;
    const minimumImageCount = this.normalizeImageRequirement(
      imageRequirement,
      input.minimumImageCount,
      1,
    );
    const maximumImageCount = this.normalizeMaximumImageCount(
      imageRequirement, input.maximumImageCount, 20, minimumImageCount,
    );
    const documentRequirement =
      input.documentRequirement ?? ProductTypeRequirementLevel.OPTIONAL;
    const minimumDocumentCount = this.normalizeDocumentRequirement(
      documentRequirement,
      input.minimumDocumentCount,
      0,
    );
    if (
      status === MasterDataStatus.ACTIVE &&
      category.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE',
        message: 'An Active Product Type requires an Active Category',
      });
    }
    if (
      status === MasterDataStatus.ACTIVE &&
      partGroup.status !== MasterDataStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_PART_GROUP_NOT_ACTIVE',
        message: 'An Active Product Type requires an Active Part Group',
      });
    }

    const productType = await transaction.productType.create({
      data: {
        categoryId: input.categoryId,
        productFamilyId: input.productFamilyId,
        parentId: null,
        code: input.code,
        name: input.name.trim(),
        slug: input.slug,
        description: this.normalizeDescription(input.description),
        sortOrder: input.sortOrder ?? 0,
        brandRequirement:
          input.brandRequirement ?? ProductTypeRequirementLevel.OPTIONAL,
        identifierRequirement:
          input.identifierRequirement ??
          ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
        gtinRequirement:
          input.gtinRequirement ?? ProductTypeRequirementLevel.OPTIONAL,
        oemReferenceRequirement:
          input.oemReferenceRequirement ?? ProductTypeRequirementLevel.OPTIONAL,
        crossReferenceRequirement:
          input.crossReferenceRequirement ?? ProductTypeRequirementLevel.OPTIONAL,
        fitmentRequirement:
          input.fitmentRequirement ?? ProductTypeRequirementLevel.REQUIRED,
        imageRequirement,
        minimumImageCount,
        maximumImageCount,
        documentRequirement,
        minimumDocumentCount,
        priceRequirement:
          input.priceRequirement ?? ProductTypeRequirementLevel.REQUIRED,
        stockRequirement:
          input.stockRequirement ?? ProductTypeRequirementLevel.REQUIRED,
        conditionRequirement:
          input.conditionRequirement ?? ProductTypeRequirementLevel.REQUIRED,
        warrantyRequirement:
          input.warrantyRequirement ?? ProductTypeRequirementLevel.OPTIONAL,
        status,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: 'PRODUCT_TYPE_CREATED',
        entityType: 'ProductType',
        entityId: productType.id,
        metadata: {
          after: this.productTypeSnapshot(productType),
          hierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
        },
      },
    });
    return this.toProductTypeResponse(productType);
  }

  private hasCategoryChanges(input: UpdateCategoryDto): boolean {
    return (
      input.name !== undefined ||
      input.slug !== undefined ||
      input.description !== undefined ||
      input.sortOrder !== undefined ||
      input.status !== undefined
    );
  }

  private normalizeImageRequirement(
    requirement: ProductTypeRequirementLevel,
    requestedMinimum: number | undefined,
    currentMinimum: number,
  ): number {
    if (requirement !== ProductTypeRequirementLevel.REQUIRED) return 0;

    const minimum = requestedMinimum ?? currentMinimum;
    return minimum > 0 ? minimum : 1;
  }

  private normalizeMaximumImageCount(
    requirement: ProductTypeRequirementLevel,
    requestedMaximum: number | undefined,
    currentMaximum: number,
    minimum: number,
  ): number {
    if (requirement === ProductTypeRequirementLevel.NOT_APPLICABLE) return 0;
    const maximum = requestedMaximum ?? currentMaximum;
    if (!Number.isInteger(maximum) || maximum < Math.max(1, minimum) || maximum > 20) {
      throw new BadRequestException({
        code: 'PRODUCT_TYPE_IMAGE_COUNT_RANGE_INVALID',
        message: 'Maximum images must be between the required minimum and 20.',
      });
    }
    return maximum;
  }

  private normalizeDocumentRequirement(
    requirement: ProductTypeRequirementLevel,
    requestedMinimum: number | undefined,
    currentMinimum: number,
  ): number {
    if (requirement === ProductTypeRequirementLevel.NOT_APPLICABLE) return 0;

    const minimum = requestedMinimum ?? currentMinimum;
    if (requirement === ProductTypeRequirementLevel.REQUIRED) {
      return minimum > 0 ? minimum : 1;
    }
    return Math.max(0, minimum);
  }

  private normalizeDescription(
    value: string | null | undefined,
  ): string | null {
    if (value == null) return null;
    const description = value.trim();
    return description.length > 0 ? description : null;
  }

  private categorySnapshot(category: Category): Prisma.InputJsonObject {
    return {
      id: category.id,
      parentId: category.parentId,
      code: category.code,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      level: category.level,
      isLeaf: category.isLeaf,
      status: category.status,
      version: category.version,
    };
  }

  private toCategoryResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      parentId: category.parentId,
      code: category.code,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      level: category.level,
      isLeaf: category.isLeaf,
      status: category.status,
      version: category.version,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }


  private normalizeLocale(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeOptionalText(
    value: string | null | undefined,
  ): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private jsonValue(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private hasProductTypeChanges(input: UpdateProductTypeDto): boolean {
    return (
      input.categoryId !== undefined ||
      input.productFamilyId !== undefined ||
      input.name !== undefined ||
      input.slug !== undefined ||
      input.description !== undefined ||
      input.sortOrder !== undefined ||
      input.brandRequirement !== undefined ||
      input.identifierRequirement !== undefined ||
      input.gtinRequirement !== undefined ||
      input.oemReferenceRequirement !== undefined ||
      input.crossReferenceRequirement !== undefined ||
      input.fitmentRequirement !== undefined ||
      input.imageRequirement !== undefined ||
      input.minimumImageCount !== undefined ||
      input.maximumImageCount !== undefined ||
      input.documentRequirement !== undefined ||
      input.minimumDocumentCount !== undefined ||
      input.priceRequirement !== undefined ||
      input.stockRequirement !== undefined ||
      input.conditionRequirement !== undefined ||
      input.warrantyRequirement !== undefined ||
      input.packageDimensionsRequirement !== undefined ||
      input.packageWeightRequirement !== undefined ||
      input.discountRequirement !== undefined ||
      input.transportRequirement !== undefined ||
      input.specialHandlingRequirement !== undefined ||
      input.status !== undefined
    );
  }

  private productTypeSnapshot(productType: ProductType): Prisma.InputJsonObject {
    return {
      id: productType.id,
      categoryId: productType.categoryId,
      productFamilyId: productType.productFamilyId,
      parentId: productType.parentId,
      code: productType.code,
      name: productType.name,
      slug: productType.slug,
      description: productType.description,
      sortOrder: productType.sortOrder,
      brandRequirement: productType.brandRequirement,
      identifierRequirement: productType.identifierRequirement,
      gtinRequirement: productType.gtinRequirement,
      oemReferenceRequirement: productType.oemReferenceRequirement,
      crossReferenceRequirement: productType.crossReferenceRequirement,
      fitmentRequirement: productType.fitmentRequirement,
      imageRequirement: productType.imageRequirement,
      minimumImageCount: productType.minimumImageCount,
      maximumImageCount: productType.maximumImageCount,
      documentRequirement: productType.documentRequirement,
      minimumDocumentCount: productType.minimumDocumentCount,
      priceRequirement: productType.priceRequirement,
      stockRequirement: productType.stockRequirement,
      conditionRequirement: productType.conditionRequirement,
      warrantyRequirement: productType.warrantyRequirement,
      packageDimensionsRequirement: productType.packageDimensionsRequirement,
      packageWeightRequirement: productType.packageWeightRequirement,
      discountRequirement: productType.discountRequirement,
      transportRequirement: productType.transportRequirement,
      specialHandlingRequirement: productType.specialHandlingRequirement,
      status: productType.status,
      version: productType.version,
      currentSchemaVersionId: productType.currentSchemaVersionId,
    };
  }

  private toProductTypeResponse(productType: ProductType): ProductTypeResponseDto {
    return {
      id: productType.id,
      categoryId: productType.categoryId,
      productFamilyId: productType.productFamilyId,
      parentId: productType.parentId,
      code: productType.code,
      name: productType.name,
      slug: productType.slug,
      description: productType.description,
      sortOrder: productType.sortOrder,
      brandRequirement: productType.brandRequirement,
      identifierRequirement: productType.identifierRequirement,
      gtinRequirement: productType.gtinRequirement,
      oemReferenceRequirement: productType.oemReferenceRequirement,
      crossReferenceRequirement: productType.crossReferenceRequirement,
      fitmentRequirement: productType.fitmentRequirement,
      imageRequirement: productType.imageRequirement,
      minimumImageCount: productType.minimumImageCount,
      maximumImageCount: productType.maximumImageCount,
      documentRequirement: productType.documentRequirement,
      minimumDocumentCount: productType.minimumDocumentCount,
      priceRequirement: productType.priceRequirement,
      stockRequirement: productType.stockRequirement,
      conditionRequirement: productType.conditionRequirement,
      warrantyRequirement: productType.warrantyRequirement,
      packageDimensionsRequirement: productType.packageDimensionsRequirement,
      packageWeightRequirement: productType.packageWeightRequirement,
      discountRequirement: productType.discountRequirement,
      transportRequirement: productType.transportRequirement,
      specialHandlingRequirement: productType.specialHandlingRequirement,
      status: productType.status,
      version: productType.version,
      currentSchemaVersionId: productType.currentSchemaVersionId,
      createdAt: productType.createdAt,
      updatedAt: productType.updatedAt,
    };
  }

  private productTypeNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_TYPE_NOT_FOUND',
      message: 'Product type was not found',
    });
  }

  private productTypeVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'PRODUCT_TYPE_VERSION_CONFLICT',
      message: 'The product type changed; reload it before trying again',
    });
  }

  private rethrowProductTypePersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ALREADY_EXISTS',
        message: 'Product type code and slug must be unique',
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2025' || error.code === 'P2034')) {
      throw this.productTypeVersionConflict();
    }
    throw error;
  }

  private localizationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'MASTER_DATA_LOCALIZATION_NOT_FOUND',
      message: 'Localized reference data was not found',
    });
  }

  private localizationVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'MASTER_DATA_LOCALIZATION_VERSION_CONFLICT',
      message: 'Localized reference data changed; reload it before trying again',
    });
  }

  private rethrowLocalizationPersistenceError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'MASTER_DATA_LOCALIZATION_ALREADY_EXISTS',
        message: 'A localized value already exists for this locale',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.localizationVersionConflict();
    }
    throw error;
  }

  private externalMappingNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'EXTERNAL_STANDARD_MAPPING_NOT_FOUND',
      message: 'External standard mapping was not found',
    });
  }

  private externalMappingVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'EXTERNAL_STANDARD_MAPPING_VERSION_CONFLICT',
      message:
        'The external standard mapping changed; reload it before trying again',
    });
  }

  private rethrowExternalMappingPersistenceError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'EXTERNAL_STANDARD_MAPPING_ALREADY_EXISTS',
        message:
          'This external identifier is already mapped to this canonical record',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.externalMappingVersionConflict();
    }
    throw error;
  }

  private categoryNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category was not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'CATEGORY_VERSION_CONFLICT',
      message: 'The category changed; reload it before trying again',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CATEGORY_ALREADY_EXISTS',
        message: 'Category code and slug must be unique',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.versionConflict();
    }
    throw error;
  }
}
