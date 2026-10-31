import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleRelationType,
  ArticleSource,
  AttributeDataType,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
  SellerApprovalStatus,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { CatalogSchemaValidationService } from '../catalog/catalog-schema-validation.service.js';
import { CatalogSchemaService } from '../catalog/catalog-schema.service.js';
import type { ProductTypeSchemaVersionResponseDto } from '../catalog/dto/product-type-schema.dto.js';
import { DatabaseService } from '../database/database.service.js';
import { assertArticleHasNoLiveCommerce } from './article-commerce-boundary.js';
import { submitListingsWaitingForArticle } from '../marketplace/seller-listing-article-activation.js';
import {
  articleIdentityKey,
  canonicalPartNumber,
  normalizePartNumber,
} from './article-identity.js';
import { articleRequirementColumnsFromSchema } from './article-requirement-snapshot.js';
import { ArticleValidationService } from './article-validation.service.js';
import {
  catalogArticleImportFingerprint,
  parseCatalogArticleImportFile,
  type ParsedCatalogImportTable,
} from './catalog-article-import-file.js';
import type {
  CatalogArticleImportCommitResponseDto,
  CatalogArticleImportJobResponseDto,
  CatalogArticleImportPreviewResponseDto,
  CatalogArticleImportRequestDto,
  ProfessionalCatalogArticleImportCommitRequestDto,
  ProfessionalCatalogArticleImportCommitResponseDto,
  ProfessionalCatalogArticleImportInspectRequestDto,
  ProfessionalCatalogArticleImportInspectResponseDto,
  ProfessionalCatalogArticleImportPreviewResponseDto,
  ProfessionalCatalogArticleImportRequestDto,
} from './dto/catalog-article-import.dto.js';
import type {
  CreateProductDto,
  ProductAdminQueryDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto/product.dto.js';

const productSelect = {
  id: true,
  categoryId: true,
  productFamilyId: true,
  productTypeId: true,
  schemaVersionId: true,
  brandId: true,
  unitOfMeasureId: true,
  packQuantity: true,
  name: true,
  shortDescription: true,
  description: true,
  manufacturerNotes: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  schemaVersion: {
    select: {
      schemaVersion: true,
      schemaHash: true,
    },
  },
  attributeValues: {
    select: {
      valueString: true,
      valueNumeric: true,
      valueBoolean: true,
      valueReferenceId: true,
      valueJson: true,
      attribute: {
        select: {
          code: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

type SnapshotAttribute = {
  id: string;
  code: string;
  dataType: AttributeDataType;
  unit: string | null;
};

type ArticlePolicy = {
  brand: ProductTypeRequirementLevel;
  identifier: ProductTypeIdentifierRequirement;
};

type ParsedSnapshot = {
  productTypeId: string;
  categoryId: string;
  productFamilyId: string;
  articlePolicy: ArticlePolicy;
  attributes: Map<string, SnapshotAttribute>;
};

export type ArticleCreationContext = {
  actorId: string;
  source: ArticleSource;
  sourceSellerId?: string | null;
  sourceReference?: string | null;
};

export type ProductUpdateAuditContext = {
  action: string;
  metadata: Prisma.InputJsonObject;
};

type ArticleProvenance = {
  source: ArticleSource;
  sourceSellerId: string | null;
  sourceReference: string | null;
};

type PreparedArticleCreation = {
  actorId: string;
  input: CreateProductDto;
  schema: ProductTypeSchemaVersionResponseDto;
  snapshot: ParsedSnapshot;
  provenance: ArticleProvenance;
  valueRows: Array<
    Omit<Prisma.ProductAttributeValueCreateManyInput, 'productId'>
  >;
  manufacturerPartNumber: string;
  normalizedManufacturerPartNumber: string;
};

type PreparedCatalogImportRow = {
  rowNumber: number;
  rowKey: string;
  prepared: PreparedArticleCreation;
};

type ProfessionalMappedImportRow = {
  sourceRowNumber: number;
  rowKey: string;
  excluded: boolean;
  normalizedRow: CatalogArticleImportRequestDto['rows'][number] | null;
  productTypeId: string | null;
  brandId: string | null;
  normalizedManufacturerPartNumber: string | null;
  sourceCells: Record<string, string>;
  duplicateAssessment: 'NONE' | 'EXACT' | 'PROBABLE';
  errors: string[];
  warnings: string[];
};

type PreparedProfessionalCatalogImport = {
  preview: ProfessionalCatalogArticleImportPreviewResponseDto;
  normalizedRequest: CatalogArticleImportRequestDto;
  canonicalBatch: {
    preview: CatalogArticleImportPreviewResponseDto;
    preparedRows: PreparedCatalogImportRow[];
  };
};

@Injectable()
export class ProductService {
  constructor(
    private readonly database: DatabaseService,
    private readonly schemas: CatalogSchemaService,
    private readonly validation: CatalogSchemaValidationService,
    private readonly articleValidation: ArticleValidationService,
  ) {}

  async listAdmin(query: ProductAdminQueryDto): Promise<ProductResponseDto[]> {
    const products = await this.database.product.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.productTypeId ? { productTypeId: query.productTypeId } : {}),
        ...(query.productFamilyId ? { productFamilyId: query.productFamilyId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.unitOfMeasureId
          ? { unitOfMeasureId: query.unitOfMeasureId }
          : {}),
      },
      select: productSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

    return products.map((product) => this.toResponse(product));
  }

  async getAdmin(id: string): Promise<ProductResponseDto> {
    const product = await this.database.product.findUnique({
      where: { id },
      select: productSelect,
    });
    if (!product) throw this.productNotFound();
    return this.toResponse(product);
  }

  async listPublished(): Promise<ProductResponseDto[]> {
    const products = await this.database.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: productSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return products.map((product) => this.toResponse(product));
  }

  async getPublished(id: string): Promise<ProductResponseDto> {
    const product = await this.database.product.findFirst({
      where: { id, status: ProductStatus.ACTIVE },
      select: productSelect,
    });
    if (!product) throw this.productNotFound();
    return this.toResponse(product);
  }

  async create(
    input: CreateProductDto,
    context: ArticleCreationContext,
  ): Promise<ProductResponseDto> {
    const prepared = await this.prepareArticleCreation(input, context);

    try {
      const productId = await this.database.$transaction(
        (transaction) =>
          this.persistPreparedArticle(transaction, prepared),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.getAdmin(productId);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  /**
   * Persist a canonical Article as part of a Seller Inventory/Listing transaction.
   * Reuses the same published-schema, identity, attribute and audit validation
   * as normal Article creation. The caller owns the commit or rollback.
   */
  async createInSellerTransaction(
    transaction: Prisma.TransactionClient,
    input: CreateProductDto,
    context: ArticleCreationContext,
    identityFingerprint?: string,
  ): Promise<string> {
    const prepared = await this.prepareArticleCreation(input, context, Boolean(identityFingerprint));
    if (!identityFingerprint && prepared.normalizedManufacturerPartNumber && input.brandId) {
      await this.assertArticleIdentityAvailable(
        input.brandId,
        prepared.normalizedManufacturerPartNumber,
        transaction,
      );
    }
    return this.persistPreparedArticle(transaction, prepared, identityFingerprint);
  }

  async previewApprovedCatalogImport(
    input: CatalogArticleImportRequestDto,
    actorId: string,
  ): Promise<CatalogArticleImportPreviewResponseDto> {
    const batch = await this.prepareApprovedCatalogImport(input, actorId);
    return batch.preview;
  }

  async commitApprovedCatalogImport(
    input: CatalogArticleImportRequestDto,
    actorId: string,
  ): Promise<CatalogArticleImportCommitResponseDto> {
    const batch = await this.prepareApprovedCatalogImport(input, actorId);
    if (batch.preview.invalidRows > 0) {
      throw new BadRequestException({
        code: 'CATALOG_ARTICLE_IMPORT_INVALID',
        message:
          'Catalog Article import commit requires a clean server-side preview with zero invalid rows',
        preview: batch.preview,
      });
    }

    try {
      const items = await this.database.$transaction(
        async (transaction) => {
          const created: Array<{ rowKey: string; articleId: string }> = [];

          for (const row of batch.preparedRows) {
            const brandId = row.prepared.input.brandId ?? null;
            if (
              brandId &&
              row.prepared.normalizedManufacturerPartNumber
            ) {
              await this.assertArticleIdentityAvailable(
                brandId,
                row.prepared.normalizedManufacturerPartNumber,
                transaction,
              );
            }

            const articleId = await this.persistPreparedArticle(
              transaction,
              row.prepared,
            );
            created.push({ rowKey: row.rowKey, articleId });
          }

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'CATALOG_ARTICLE_IMPORT_COMMITTED',
              entityType: 'CatalogArticleImport',
              entityId: input.datasetReference.trim(),
              metadata: {
                datasetReference: input.datasetReference.trim(),
                createdCount: created.length,
                rowKeys: created.map((item) => item.rowKey),
              },
            },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        datasetReference: input.datasetReference.trim(),
        createdCount: items.length,
        items,
      };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  inspectProfessionalCatalogImport(
    input: ProfessionalCatalogArticleImportInspectRequestDto,
  ): ProfessionalCatalogArticleImportInspectResponseDto {
    const table = parseCatalogArticleImportFile({
      format: input.format,
      fileBase64: input.fileBase64,
      ...(input.sheetName?.trim()
        ? { sheetName: input.sheetName.trim() }
        : {}),
    });
    return {
      fileName: input.fileName.trim(),
      format: input.format,
      sheetName: table.sheetName,
      headers: table.headers,
      totalRows: table.rows.length,
    };
  }

  async previewProfessionalCatalogImport(
    input: ProfessionalCatalogArticleImportRequestDto,
    actorId: string,
  ): Promise<ProfessionalCatalogArticleImportPreviewResponseDto> {
    const prepared = await this.prepareProfessionalCatalogImport(input, actorId);
    return prepared.preview;
  }

  async commitProfessionalCatalogImport(
    input: ProfessionalCatalogArticleImportCommitRequestDto,
    actorId: string,
  ): Promise<ProfessionalCatalogArticleImportCommitResponseDto> {
    const prepared = await this.prepareProfessionalCatalogImport(input, actorId);

    if (
      input.expectedPreviewFingerprint !==
      prepared.preview.previewFingerprint
    ) {
      throw new ConflictException({
        code: 'CATALOG_ARTICLE_IMPORT_PREVIEW_DRIFT',
        message:
          'The import file, mapping, corrections, exclusions or normalized preview changed after review; preview the import again before committing',
        currentPreviewFingerprint: prepared.preview.previewFingerprint,
      });
    }

    if (!prepared.preview.canCommit) {
      throw new BadRequestException({
        code: 'CATALOG_ARTICLE_IMPORT_INVALID',
        message:
          'Professional Article import commit requires at least one included row and zero invalid rows',
        preview: prepared.preview,
      });
    }

    try {
      const result = await this.database.$transaction(
        async (transaction) => {
          const existingJob =
            await transaction.catalogArticleImportJob.findUnique({
              where: {
                datasetReference: input.datasetReference.trim(),
              },
              select: { id: true },
            });
          if (existingJob) {
            throw new ConflictException({
              code: 'CATALOG_ARTICLE_IMPORT_ALREADY_COMMITTED',
              message:
                'This dataset reference has already been committed as an Article import job',
              jobId: existingJob.id,
            });
          }

          const created: Array<{ rowKey: string; articleId: string }> = [];
          for (const row of prepared.canonicalBatch.preparedRows) {
            const brandId = row.prepared.input.brandId ?? null;
            if (
              brandId &&
              row.prepared.normalizedManufacturerPartNumber
            ) {
              await this.assertArticleIdentityAvailable(
                brandId,
                row.prepared.normalizedManufacturerPartNumber,
                transaction,
              );
            }

            const articleId = await this.persistPreparedArticle(
              transaction,
              row.prepared,
            );
            created.push({ rowKey: row.rowKey, articleId });
          }

          if (created.length !== prepared.preview.includedRows) {
            throw new ConflictException({
              code: 'CATALOG_ARTICLE_IMPORT_PREPARED_ROW_MISMATCH',
              message:
                'The reviewed import no longer resolves to the same number of valid included rows',
            });
          }

          const job = await transaction.catalogArticleImportJob.create({
            data: {
              datasetReference: input.datasetReference.trim(),
              fileName: input.fileName.trim(),
              fileFormat: input.format,
              previewFingerprint: prepared.preview.previewFingerprint,
              totalRows: prepared.preview.totalRows,
              includedRows: prepared.preview.includedRows,
              excludedRows: prepared.preview.excludedRows,
              warningRows: prepared.preview.warningRows,
              createdCount: created.length,
              report: this.jsonRecord({
                ...prepared.preview,
                rows: prepared.preview.rows.map((row) => ({
                  ...row,
                  errors: [...row.errors],
                  warnings: [...row.warnings],
                })),
              }),
              createdById: actorId,
            },
            select: { id: true },
          });

          await transaction.adminImportJob.create({
            data: {
              id: job.id,
              workflow: 'MANUFACTURER_ARTICLE',
              datasetReference: input.datasetReference.trim(),
              fileName: input.fileName.trim(),
              fileFormat: input.format,
              status: 'COMPLETED',
              totalRows: prepared.preview.totalRows,
              includedRows: prepared.preview.includedRows,
              excludedRows: prepared.preview.excludedRows,
              warningRows: prepared.preview.warningRows,
              createdCount: created.length,
              metadata: {
                previewFingerprint: prepared.preview.previewFingerprint,
              },
              createdById: actorId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'CATALOG_ARTICLE_IMPORT_V2_COMMITTED',
              entityType: 'CatalogArticleImportJob',
              entityId: job.id,
              metadata: {
                datasetReference: input.datasetReference.trim(),
                fileName: input.fileName.trim(),
                fileFormat: input.format,
                previewFingerprint: prepared.preview.previewFingerprint,
                totalRows: prepared.preview.totalRows,
                includedRows: prepared.preview.includedRows,
                excludedRows: prepared.preview.excludedRows,
                warningRows: prepared.preview.warningRows,
                createdCount: created.length,
                rowKeys: created.map((item) => item.rowKey),
              },
            },
          });

          return { jobId: job.id, created };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        jobId: result.jobId,
        datasetReference: input.datasetReference.trim(),
        previewFingerprint: prepared.preview.previewFingerprint,
        createdCount: result.created.length,
        excludedRows: prepared.preview.excludedRows,
        warningRows: prepared.preview.warningRows,
        items: result.created,
      };
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async listProfessionalCatalogImportJobs(): Promise<
    CatalogArticleImportJobResponseDto[]
  > {
    return this.database.catalogArticleImportJob.findMany({
      select: {
        id: true,
        datasetReference: true,
        fileName: true,
        fileFormat: true,
        previewFingerprint: true,
        totalRows: true,
        includedRows: true,
        excludedRows: true,
        warningRows: true,
        createdCount: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async update(
    id: string,
    input: UpdateProductDto,
    actorId: string,
    auditContext?: ProductUpdateAuditContext,
  ): Promise<ProductResponseDto> {
    const existing = await this.database.product.findUnique({
      where: { id },
      select: {
        id: true,
        productTypeId: true,
        productFamilyId: true,
        name: true,
        shortDescription: true,
        description: true,
        manufacturerNotes: true,
        brandId: true,
        brandRequirement: true,
        unitOfMeasureId: true,
        packQuantity: true,
        articleSource: true,
        status: true,
        publishedAt: true,
        version: true,
        schemaVersion: {
          select: {
            schemaVersion: true,
          },
        },
      },
    });
    if (!existing) throw this.productNotFound();
    if (existing.version !== input.version) {
      throw this.productVersionConflict();
    }

    const hasMetadataUpdate =
      input.name !== undefined ||
      input.shortDescription !== undefined ||
      input.description !== undefined ||
      input.manufacturerNotes !== undefined ||
      input.brandId !== undefined ||
      input.unitOfMeasureId !== undefined ||
      input.packQuantity !== undefined ||
      input.status !== undefined;
    if (!hasMetadataUpdate && input.values === undefined) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_EMPTY',
        message: 'At least one mutable Product field is required',
      });
    }

    const nextBrandId =
      input.brandId !== undefined ? input.brandId : existing.brandId;
    const nextStatus = input.status ?? existing.status;

    if (
      input.brandId !== undefined &&
      input.brandId !== existing.brandId
    ) {
      const [manufacturerIdentifier, supersessionRelation] = await Promise.all([
        this.database.partNumber.findFirst({
          where: {
            productId: id,
            type: PartNumberType.MANUFACTURER,
          },
          select: { id: true },
        }),
        this.database.articleRelation.findFirst({
          where: {
            type: ArticleRelationType.SUPERSEDES,
            status: { not: MasterDataStatus.ARCHIVED },
            OR: [
              { sourceArticleId: id },
              { targetArticleId: id },
            ],
          },
          select: { id: true },
        }),
      ]);
      if (manufacturerIdentifier) {
        throw new ConflictException({
          code: 'ARTICLE_BRAND_IDENTITY_IMMUTABLE',
          message:
            'The Brand cannot change after a Manufacturer Part Number establishes the Article identity',
        });
      }
      if (supersessionRelation) {
        throw new ConflictException({
          code: 'ARTICLE_BRAND_RELATION_IMMUTABLE',
          message:
            'Archive the non-archived supersession relation before changing the Article Brand',
        });
      }
    }

    let boundSchema: ProductTypeSchemaVersionResponseDto | null = null;
    let boundSnapshot: ParsedSnapshot | null = null;
    if (
      input.values !== undefined ||
      input.brandId !== undefined ||
      input.status === ProductStatus.ACTIVE
    ) {
      boundSchema = await this.schemas.getPublishedSchemaVersion(
        existing.productTypeId,
        existing.schemaVersion.schemaVersion,
      );
      boundSnapshot = this.parseSnapshot(boundSchema);
    }

    if (input.brandId !== undefined || input.status === ProductStatus.ACTIVE) {
      this.validateArticleBrandPolicy(
        existing.brandRequirement,
        nextBrandId,
      );
    }
    if (nextBrandId) {
      await this.requireBrand(
        nextBrandId,
        nextStatus === ProductStatus.ACTIVE,
      );
    }
    if (!existing.productFamilyId) {
      throw new ConflictException({
        code: 'PRODUCT_PART_GROUP_REQUIRED',
        message:
          'This legacy Product is not assigned to a Part Group and cannot be updated until its catalog hierarchy is corrected',
      });
    }

    const nextUnitOfMeasureId =
      input.unitOfMeasureId !== undefined
        ? input.unitOfMeasureId
        : existing.unitOfMeasureId;
    const nextPackQuantity =
      input.packQuantity !== undefined
        ? input.packQuantity
        : existing.packQuantity === null
          ? null
          : Number(existing.packQuantity);

    if (!existing.productFamilyId) {
      throw new ConflictException({
        code: 'PRODUCT_PART_GROUP_REQUIRED',
        message:
          'This legacy Product is not bound to a Part Group. Recreate it from a current Product Type schema before updating it.',
      });
    }

    await this.validateProductStructure({
      productFamilyId: existing.productFamilyId,
      unitOfMeasureId: nextUnitOfMeasureId,
      packQuantity: nextPackQuantity,
      requireActive: nextStatus === ProductStatus.ACTIVE,
    });

    let replacementRows:
      | Array<
          Omit<Prisma.ProductAttributeValueCreateManyInput, 'productId'>
        >
      | undefined;

    if (input.values !== undefined) {
      const schema =
        boundSchema ??
        (await this.schemas.getPublishedSchemaVersion(
          existing.productTypeId,
          existing.schemaVersion.schemaVersion,
        ));
      const snapshot = boundSnapshot ?? this.parseSnapshot(schema);
      const validation = this.validation.validatePublishedSchema(
        schema,
        input.values,
        { skipSellerMediaRequirements: true },
      );
      if (!validation.valid) {
        throw this.schemaValidationFailed(validation.issues);
      }
      replacementRows = this.buildValueRows(snapshot, input.values);
    }

    if (input.status === ProductStatus.ACTIVE) {
      await this.articleValidation.assertReadyForActivation(id, {
        brandId: nextBrandId,
        ...(input.values !== undefined ? { values: input.values } : {}),
      });
    }

    try {
      await this.database.$transaction(
        async (transaction) => {
          if (
            input.brandId !== undefined &&
            input.brandId !== existing.brandId
          ) {
            await this.assertNoSupersessionBrandDependency(transaction, id);
          }
          if (
            input.status !== undefined &&
            input.status !== existing.status &&
            nextStatus !== ProductStatus.ACTIVE
          ) {
            await assertArticleHasNoLiveCommerce(transaction, id);
            await this.assertArticleRelationLifecycleCompatible(
              transaction,
              id,
              nextStatus,
            );
          }

          const updated = await transaction.product.update({
            where: { id, version: input.version },
            data: {
              ...(input.name !== undefined
                ? { name: input.name.trim() }
                : {}),
              ...(input.shortDescription !== undefined
                ? { shortDescription: input.shortDescription?.trim() || null }
                : {}),
              ...(input.description !== undefined
                ? { description: input.description?.trim() || null }
                : {}),
              ...(input.manufacturerNotes !== undefined
                ? { manufacturerNotes: input.manufacturerNotes?.trim() || null }
                : {}),
              ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
              ...(input.unitOfMeasureId !== undefined
                ? { unitOfMeasureId: input.unitOfMeasureId }
                : {}),
              ...(input.packQuantity !== undefined
                ? { packQuantity: input.packQuantity }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              ...(input.status === ProductStatus.ACTIVE &&
              existing.publishedAt === null
                ? { publishedAt: new Date() }
                : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: {
              id: true,
              productTypeId: true,
              productFamilyId: true,
              name: true,
              shortDescription: true,
              description: true,
              manufacturerNotes: true,
              brandId: true,
              unitOfMeasureId: true,
              packQuantity: true,
              status: true,
              publishedAt: true,
              version: true,
              schemaVersion: {
                select: { schemaVersion: true },
              },
            },
          });

          let publishedArticleIdentifierCount = 0;
          let publishedPartNumberCount = 0;
          let publishedAssetCount = 0;
          let publishedFitmentCount = 0;
          if (
            input.status === ProductStatus.ACTIVE &&
            existing.status !== ProductStatus.ACTIVE
          ) {
            const [identifierPublication, partNumberPublication, assetPublication, fitmentPublication] =
              await Promise.all([
                transaction.articleIdentifier.updateMany({
                  where: {
                    productId: id,
                    status: MasterDataStatus.DRAFT,
                  },
                  data: {
                    status: MasterDataStatus.ACTIVE,
                    version: { increment: 1 },
                    updatedById: actorId,
                    updatedAt: new Date(),
                  },
                }),
                transaction.partNumber.updateMany({
                  where: {
                    productId: id,
                    status: MasterDataStatus.DRAFT,
                  },
                  data: {
                    status: MasterDataStatus.ACTIVE,
                    version: { increment: 1 },
                    updatedById: actorId,
                    updatedAt: new Date(),
                  },
                }),
                transaction.productAsset.updateMany({
                  where: {
                    productId: id,
                    status: MasterDataStatus.DRAFT,
                  },
                  data: {
                    status: MasterDataStatus.ACTIVE,
                    version: { increment: 1 },
                    updatedById: actorId,
                    updatedAt: new Date(),
                  },
                }),
                transaction.vehicleCompatibility.updateMany({
                  where: {
                    productId: id,
                    status: MasterDataStatus.DRAFT,
                    verificationStatus: {
                      in: [
                        CompatibilityVerificationStatus.VERIFIED,
                        CompatibilityVerificationStatus.APPROVED,
                      ],
                    },
                  },
                  data: {
                    status: MasterDataStatus.ACTIVE,
                    version: { increment: 1 },
                    updatedById: actorId,
                    updatedAt: new Date(),
                  },
                }),
              ]);

            publishedArticleIdentifierCount = identifierPublication.count;
            publishedPartNumberCount = partNumberPublication.count;
            publishedAssetCount = assetPublication.count;
            publishedFitmentCount = fitmentPublication.count;

            const publishedEvidenceCount =
              publishedArticleIdentifierCount +
              publishedPartNumberCount +
              publishedAssetCount +
              publishedFitmentCount;
            if (publishedEvidenceCount > 0) {
              await transaction.auditLog.create({
                data: {
                  actorId,
                  action: 'ARTICLE_EVIDENCE_PUBLISHED',
                  entityType: 'Product',
                  entityId: id,
                  metadata: {
                    source: 'ARTICLE_ACTIVATION',
                    articleIdentifierCount: publishedArticleIdentifierCount,
                    partNumberCount: publishedPartNumberCount,
                    assetCount: publishedAssetCount,
                    verifiedFitmentCount: publishedFitmentCount,
                  },
                },
              });
            }
          }

          if (input.status === ProductStatus.ACTIVE && existing.status !== ProductStatus.ACTIVE &&
              existing.articleSource === ArticleSource.SELLER_SUBMISSION) {
            // Promote only complete Seller Listings to the Admin review queue.
            // Article activation does not itself publish Seller-specific offers.
            await submitListingsWaitingForArticle(transaction, id, actorId);
          }

          if (replacementRows !== undefined) {
            await transaction.productAttributeValue.deleteMany({
              where: { productId: id },
            });
            if (replacementRows.length > 0) {
              await transaction.productAttributeValue.createMany({
                data: replacementRows.map((row) => ({
                  ...row,
                  productId: id,
                })),
              });
            }
          }

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'PRODUCT_MASTER_UPDATED',
              entityType: 'Product',
              entityId: updated.id,
              metadata: {
                before: this.articleAuditSnapshot(existing),
                after: this.articleAuditSnapshot(updated),
                replacedAttributeValues: replacementRows !== undefined,
                publishedArticleIdentifierCount,
                publishedPartNumberCount,
                publishedAssetCount,
                publishedFitmentCount,
              },
            },
          });

          if (auditContext) {
            await transaction.auditLog.create({
              data: {
                actorId,
                action: auditContext.action,
                entityType: 'Product',
                entityId: updated.id,
                metadata: auditContext.metadata,
              },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.getAdmin(id);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private jsonRecord(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private articleAuditSnapshot(value: {
    id: string;
    productTypeId: string;
    productFamilyId: string | null;
    name: string;
    shortDescription: string | null;
    description: string | null;
    manufacturerNotes: string | null;
    brandId: string | null;
    unitOfMeasureId: string | null;
    packQuantity: Prisma.Decimal | null;
    status: ProductStatus;
    publishedAt: Date | null;
    version: number;
    schemaVersion: { schemaVersion: number };
  }): Prisma.InputJsonObject {
    return {
      id: value.id,
      productTypeId: value.productTypeId,
      productFamilyId: value.productFamilyId,
      name: value.name,
      shortDescription: value.shortDescription,
      description: value.description,
      manufacturerNotes: value.manufacturerNotes,
      brandId: value.brandId,
      unitOfMeasureId: value.unitOfMeasureId,
      packQuantity:
        value.packQuantity === null ? null : Number(value.packQuantity),
      status: value.status,
      publishedAt: value.publishedAt?.toISOString() ?? null,
      version: value.version,
      schemaVersion: value.schemaVersion.schemaVersion,
    };
  }

  private parseSnapshot(
    schema: ProductTypeSchemaVersionResponseDto,
  ): ParsedSnapshot {
    if (!this.isRecord(schema.snapshot)) {
      throw this.schemaSnapshotInvalid();
    }

    const productType = schema.snapshot.productType;
    const attributes = schema.snapshot.attributes;
    if (
      !this.isRecord(productType) ||
      typeof productType.id !== 'string' ||
      typeof productType.categoryId !== 'string' ||
      productType.id !== schema.productTypeId ||
      !Array.isArray(attributes)
    ) {
      throw this.schemaSnapshotInvalid();
    }

    const parsed = new Map<string, SnapshotAttribute>();
    for (const candidate of attributes) {
      if (
        !this.isRecord(candidate) ||
        typeof candidate.attributeId !== 'string' ||
        typeof candidate.code !== 'string' ||
        typeof candidate.dataType !== 'string'
      ) {
        throw this.schemaSnapshotInvalid();
      }

      if (
        !Object.values(AttributeDataType).includes(
          candidate.dataType as AttributeDataType,
        )
      ) {
        throw this.schemaSnapshotInvalid();
      }

      parsed.set(candidate.code, {
        id: candidate.attributeId,
        code: candidate.code,
        dataType: candidate.dataType as AttributeDataType,
        unit: typeof candidate.unit === 'string' ? candidate.unit : null,
      });
    }

    const productFamilyId =
      typeof productType.productFamilyId === 'string'
        ? productType.productFamilyId
        : null;
    if (!productFamilyId) {
      throw new ConflictException({
        code: 'PRODUCT_SCHEMA_PART_GROUP_REQUIRED',
        message:
          'The published Product Type schema must belong to a Part Group',
      });
    }

    return {
      productTypeId: productType.id,
      categoryId: productType.categoryId,
      productFamilyId,
      articlePolicy: this.parseArticlePolicy(schema.snapshot),
      attributes: parsed,
    };
  }

  private parseArticlePolicy(snapshot: Record<string, unknown>): ArticlePolicy {
    const current = this.isRecord(snapshot.articleRequirements)
      ? snapshot.articleRequirements
      : null;
    const legacy = this.isRecord(snapshot.requirements)
      ? snapshot.requirements
      : null;
    const source = current ?? legacy;

    const brand =
      source?.brand === undefined
        ? ProductTypeRequirementLevel.OPTIONAL
        : source.brand;
    const identifier =
      source?.identifier === undefined
        ? ProductTypeIdentifierRequirement.ANY_PART_NUMBER
        : source.identifier;

    if (
      typeof brand !== 'string' ||
      !Object.values(ProductTypeRequirementLevel).includes(
        brand as ProductTypeRequirementLevel,
      ) ||
      typeof identifier !== 'string' ||
      !Object.values(ProductTypeIdentifierRequirement).includes(
        identifier as ProductTypeIdentifierRequirement,
      )
    ) {
      throw this.schemaSnapshotInvalid();
    }

    return {
      brand: brand as ProductTypeRequirementLevel,
      identifier: identifier as ProductTypeIdentifierRequirement,
    };
  }

  private validateArticleBrandPolicy(
    requirement: ProductTypeRequirementLevel,
    brandId: string | null,
  ): void {
    if (requirement === ProductTypeRequirementLevel.REQUIRED && !brandId) {
      throw new BadRequestException({
        code: 'ARTICLE_BRAND_REQUIRED',
        message: 'The published Product Type schema requires a Brand',
      });
    }
    if (
      requirement === ProductTypeRequirementLevel.NOT_APPLICABLE &&
      brandId
    ) {
      throw new BadRequestException({
        code: 'ARTICLE_BRAND_NOT_APPLICABLE',
        message: 'The published Product Type schema does not allow a Brand',
      });
    }
  }

  private validateArticleIdentifierPolicy(
    requirement: ProductTypeIdentifierRequirement,
    manufacturerPartNumber: string,
  ): void {
    if (
      requirement ===
        ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER &&
      !manufacturerPartNumber
    ) {
      throw new BadRequestException({
        code: 'ARTICLE_MANUFACTURER_PART_NUMBER_REQUIRED',
        message:
          'The published Product Type schema requires a Manufacturer Part Number',
      });
    }
    if (
      requirement === ProductTypeIdentifierRequirement.NOT_APPLICABLE &&
      manufacturerPartNumber
    ) {
      throw new BadRequestException({
        code: 'ARTICLE_IDENTIFIER_NOT_APPLICABLE',
        message:
          'The published Product Type schema does not allow a part-number identifier',
      });
    }
  }

  private buildValueRows(
    snapshot: ParsedSnapshot,
    values: Record<string, unknown>,
  ): Array<Omit<Prisma.ProductAttributeValueCreateManyInput, 'productId'>> {
    return Object.entries(values).map(([code, value]) => {
      const attribute = snapshot.attributes.get(code);
      if (!attribute) throw this.schemaSnapshotInvalid();

      const base = {
        attributeId: attribute.id,
        unit: attribute.unit,
        normalizedValue: this.normalizeValue(value),
      };

      switch (attribute.dataType) {
        case AttributeDataType.INTEGER:
        case AttributeDataType.DECIMAL:
        case AttributeDataType.MONEY:
        case AttributeDataType.MEASUREMENT:
          return { ...base, valueNumeric: value as number };
        case AttributeDataType.BOOLEAN:
          return { ...base, valueBoolean: value as boolean };
        case AttributeDataType.REFERENCE:
          return { ...base, valueReferenceId: value as string };
        case AttributeDataType.MULTI_SELECT:
        case AttributeDataType.MULTI_REFERENCE:
        case AttributeDataType.MULTI_IMAGE:
          return {
            ...base,
            valueJson: value as Prisma.InputJsonValue,
          };
        default:
          return { ...base, valueString: value as string };
      }
    });
  }

  private normalizeValue(value: unknown): string | null {
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) return JSON.stringify(value);
    return null;
  }

  private toResponse(product: ProductRecord): ProductResponseDto {
    const values: Record<string, unknown> = {};

    for (const item of product.attributeValues) {
      if (item.valueString !== null) {
        values[item.attribute.code] = item.valueString;
      } else if (item.valueNumeric !== null) {
        values[item.attribute.code] = Number(item.valueNumeric);
      } else if (item.valueBoolean !== null) {
        values[item.attribute.code] = item.valueBoolean;
      } else if (item.valueReferenceId !== null) {
        values[item.attribute.code] = item.valueReferenceId;
      } else {
        values[item.attribute.code] = item.valueJson;
      }
    }

    return {
      id: product.id,
      categoryId: product.categoryId,
      productFamilyId: product.productFamilyId,
      productTypeId: product.productTypeId,
      schemaVersionId: product.schemaVersionId,
      brandId: product.brandId,
      unitOfMeasureId: product.unitOfMeasureId,
      packQuantity:
        product.packQuantity === null ? null : Number(product.packQuantity),
      schemaVersion: product.schemaVersion.schemaVersion,
      schemaHash: product.schemaVersion.schemaHash,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      manufacturerNotes: product.manufacturerNotes,
      status: product.status,
      version: product.version,
      values,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private async prepareArticleCreation(
    input: CreateProductDto,
    context: ArticleCreationContext,
    allowFingerprintVariant = false,
  ): Promise<PreparedArticleCreation> {
    const provenance = await this.validateArticleCreationContext(context);
    const schema = await this.schemas.getPublishedSchemaVersion(
      input.productTypeId,
      input.schemaVersion,
    );
    const snapshot = this.parseSnapshot(schema);

    const validation = this.validation.validatePublishedSchema(
      schema,
      input.values,
      { skipSellerMediaRequirements: true },
    );
    if (!validation.valid) {
      throw this.schemaValidationFailed(validation.issues);
    }

    const valueRows = this.buildValueRows(snapshot, input.values);
    const manufacturerPartNumber = input.manufacturerPartNumber?.trim() ?? '';
    const normalizedManufacturerPartNumber = manufacturerPartNumber
      ? normalizePartNumber(manufacturerPartNumber)
      : '';

    if (manufacturerPartNumber && !normalizedManufacturerPartNumber) {
      throw new BadRequestException({
        code: 'PART_NUMBER_INVALID',
        message:
          'Manufacturer Part Number must contain at least one letter or digit',
      });
    }
    if (manufacturerPartNumber && !input.brandId) {
      throw new BadRequestException({
        code: 'MANUFACTURER_PART_NUMBER_REQUIRES_BRAND',
        message:
          'A primary Manufacturer Part Number requires a Brand on the Manufacturer Article',
      });
    }

    await this.validateArticleCreationPreconditions({
      productTypeId: input.productTypeId,
      schemaVersionId: schema.id,
      categoryId: snapshot.categoryId,
      productFamilyId: snapshot.productFamilyId,
      brandId: input.brandId ?? null,
      manufacturerPartNumber,
      articlePolicy: snapshot.articlePolicy,
      unitOfMeasureId: input.unitOfMeasureId ?? null,
      packQuantity: input.packQuantity ?? null,
    });

    if (!allowFingerprintVariant && input.brandId && normalizedManufacturerPartNumber) {
      await this.assertArticleIdentityAvailable(
        input.brandId,
        normalizedManufacturerPartNumber,
      );
    }

    return {
      actorId: context.actorId,
      input,
      schema,
      snapshot,
      provenance,
      valueRows,
      manufacturerPartNumber,
      normalizedManufacturerPartNumber,
    };
  }

  async previewDuplicateCandidates(input: CreateProductDto, context: ArticleCreationContext) {
    const prepared = await this.prepareArticleCreation(input, context);
    const where = this.duplicateCandidateWhere(prepared);
    const visible: Prisma.ProductWhereInput = context.sourceSellerId
      ? { OR: [{ status: ProductStatus.ACTIVE }, { sourceSellerId: context.sourceSellerId, status: ProductStatus.DRAFT }] }
      : {};
    const [candidateCount, candidates] = await Promise.all([
      this.database.product.count({ where }),
      this.database.product.findMany({
        where: { AND: [where, visible] },
        select: { id: true, name: true, status: true, catalogReviewSubmittedAt: true },
        take: 20, orderBy: { id: 'asc' },
      }),
    ]);
    return { reviewRequired: candidateCount > 0, candidates };
  }

  private duplicateCandidateWhere(prepared: PreparedArticleCreation): Prisma.ProductWhereInput {
    // Technical matches are probable duplicates, not proof of manufacturer identity.
    // Compare canonical storage values, independent of display name and schema republishing.
    const rows = prepared.valueRows;
    return {
      productTypeId: prepared.input.productTypeId,
      brandId: prepared.input.brandId ?? null,
      status: { not: ProductStatus.ARCHIVED },
      attributeValues: { every: { attributeId: { in: rows.map(row => row.attributeId) } } },
      AND: rows.map(row => ({ attributeValues: { some: {
        attributeId: row.attributeId, normalizedValue: row.normalizedValue,
      } } })),
    };
  }

  private async persistPreparedArticle(
    transaction: Prisma.TransactionClient,
    prepared: PreparedArticleCreation,
    identityFingerprint?: string,
  ): Promise<string> {
    const {
      actorId,
      input,
      schema,
      snapshot,
      provenance,
      valueRows,
      manufacturerPartNumber,
      normalizedManufacturerPartNumber,
    } = prepared;

    let duplicateCandidateCount = 0;
    if (!normalizedManufacturerPartNumber && !identityFingerprint) {
      duplicateCandidateCount = await transaction.product.count({
        where: this.duplicateCandidateWhere(prepared),
      });
      if (duplicateCandidateCount > 0 && (input.duplicateReviewReason?.trim().length ?? 0) < 20) {
        throw new ConflictException({
          code: 'ARTICLE_DUPLICATE_REVIEW_REQUIRED',
          message: 'Articles with the same Product Type, Brand and technical values exist. Reuse an existing Article or explain why this is a different part (at least 20 characters).',
        });
      }
    }
    const product = await transaction.product.create({
      data: {
        categoryId: snapshot.categoryId,
        productFamilyId: snapshot.productFamilyId,
        productTypeId: input.productTypeId,
        identityFingerprint: identityFingerprint ?? null,
        schemaVersionId: schema.id,
        ...articleRequirementColumnsFromSchema(schema.snapshot),
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(input.unitOfMeasureId
          ? { unitOfMeasureId: input.unitOfMeasureId }
          : {}),
        ...(input.packQuantity !== undefined
          ? { packQuantity: input.packQuantity }
          : {}),
        name: input.name.trim(),
        shortDescription: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        manufacturerNotes: input.manufacturerNotes?.trim() || null,
        articleSource: provenance.source,
        sourceSellerId: provenance.sourceSellerId,
        sourceReference: provenance.sourceReference,
        status: ProductStatus.DRAFT,
        createdById: actorId,
        updatedById: actorId,
      },
      select: {
        id: true,
        productTypeId: true,
        productFamilyId: true,
        name: true,
        shortDescription: true,
        description: true,
        manufacturerNotes: true,
        brandId: true,
        unitOfMeasureId: true,
        packQuantity: true,
        status: true,
        publishedAt: true,
        version: true,
        schemaVersion: {
          select: { schemaVersion: true },
        },
      },
    });

    if (valueRows.length > 0) {
      await transaction.productAttributeValue.createMany({
        data: valueRows.map((row) => ({
          ...row,
          productId: product.id,
        })),
      });
    }

    if (manufacturerPartNumber && normalizedManufacturerPartNumber) {
      const canonicalManufacturerPartNumber =
        canonicalPartNumber(manufacturerPartNumber);
      const identityKey = identityFingerprint && provenance.source === ArticleSource.SELLER_SUBMISSION
        ? null
        : articleIdentityKey(
            PartNumberType.MANUFACTURER,
            input.brandId ?? null,
            normalizedManufacturerPartNumber,
          );

      const identifier = await transaction.partNumber.create({
        data: {
          productId: product.id,
          issuerBrandId: input.brandId ?? null,
          partNumber: canonicalManufacturerPartNumber,
          rawPartNumber: manufacturerPartNumber,
          normalizedPartNumber: normalizedManufacturerPartNumber,
          articleIdentityKey: identityKey,
          type: PartNumberType.MANUFACTURER,
          isPrimary: true,
          status: MasterDataStatus.DRAFT,
          createdById: actorId,
          updatedById: actorId,
        },
        select: {
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
        },
      });

      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'PART_NUMBER_CREATED',
          entityType: 'PartNumber',
          entityId: identifier.id,
          metadata: {
            productId: product.id,
            source: 'MANUFACTURER_ARTICLE_CREATE',
            after: this.jsonRecord(identifier),
          },
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        actorId,
        action: 'PRODUCT_MASTER_CREATED',
        entityType: 'Product',
        entityId: product.id,
        metadata: {
          productTypeId: input.productTypeId,
          schemaVersionId: schema.id,
          schemaVersion: schema.schemaVersion,
          schemaHash: schema.schemaHash,
          manufacturerPartNumber:
            normalizedManufacturerPartNumber || null,
          attributeCount: valueRows.length,
          duplicateReviewReason: input.duplicateReviewReason?.trim() || null,
          duplicateCandidateCount,
          articleSource: provenance.source,
          sourceSellerId: provenance.sourceSellerId,
          sourceReference: provenance.sourceReference,
          after: this.articleAuditSnapshot(product),
        },
      },
    });

    return product.id;
  }

  private async prepareProfessionalCatalogImport(
    input: ProfessionalCatalogArticleImportRequestDto,
    actorId: string,
  ): Promise<PreparedProfessionalCatalogImport> {
    const table = parseCatalogArticleImportFile({
      format: input.format,
      fileBase64: input.fileBase64,
      ...(input.sheetName?.trim()
        ? { sheetName: input.sheetName.trim() }
        : {}),
    });
    this.validateProfessionalImportMapping(input, table);

    const sourceRows = new Map(
      table.rows.map((row) => [row.sourceRowNumber, row]),
    );
    const excluded = new Set(input.excludedRowNumbers ?? []);
    for (const rowNumber of excluded) {
      if (!sourceRows.has(rowNumber)) {
        throw new BadRequestException({
          code: 'CATALOG_ARTICLE_IMPORT_EXCLUSION_ROW_NOT_FOUND',
          message: `Excluded source row ${rowNumber} does not exist in the selected sheet`,
        });
      }
    }

    const corrections = new Map<number, Record<string, string>>();
    for (const correction of input.corrections ?? []) {
      if (!sourceRows.has(correction.rowNumber)) {
        throw new BadRequestException({
          code: 'CATALOG_ARTICLE_IMPORT_CORRECTION_ROW_NOT_FOUND',
          message: `Correction source row ${correction.rowNumber} does not exist in the selected sheet`,
        });
      }
      if (corrections.has(correction.rowNumber)) {
        throw new BadRequestException({
          code: 'CATALOG_ARTICLE_IMPORT_CORRECTION_DUPLICATE',
          message: `Source row ${correction.rowNumber} has more than one correction object`,
        });
      }
      for (const header of Object.keys(correction.cells)) {
        if (!this.importHeader(table.headers, header)) {
          throw new BadRequestException({
            code: 'CATALOG_ARTICLE_IMPORT_CORRECTION_COLUMN_NOT_FOUND',
            message: `Correction column "${header}" does not exist in the selected sheet`,
          });
        }
      }
      corrections.set(correction.rowNumber, correction.cells);
    }

    const mappedRows = table.rows.map((sourceRow) => {
      const correctedCells = { ...sourceRow.cells };
      const correction = corrections.get(sourceRow.sourceRowNumber);
      if (correction) {
        for (const [requestedHeader, value] of Object.entries(correction)) {
          const header = this.importHeader(table.headers, requestedHeader)!;
          correctedCells[header] = String(value).trim();
        }
      }

      return this.mapProfessionalImportRow(
        input,
        table,
        sourceRow.sourceRowNumber,
        correctedCells,
        excluded.has(sourceRow.sourceRowNumber),
      );
    });

    this.addProbableImportDuplicateWarnings(mappedRows);

    const normalizedRows = mappedRows
      .filter(
        (row) =>
          !row.excluded &&
          row.errors.length === 0 &&
          row.normalizedRow !== null,
      )
      .map((row) => row.normalizedRow!);

    const normalizedRequest: CatalogArticleImportRequestDto = {
      datasetReference: input.datasetReference.trim(),
      rows: normalizedRows,
    };
    const canonicalBatch = await this.prepareApprovedCatalogImport(
      normalizedRequest,
      actorId,
    );
    const canonicalRows = new Map(
      canonicalBatch.preview.rows.map((row) => [row.rowKey, row]),
    );

    for (const row of mappedRows) {
      if (row.excluded || row.errors.length > 0 || !row.normalizedRow) {
        continue;
      }
      const canonical = canonicalRows.get(row.rowKey);
      if (!canonical) {
        row.errors.push('CATALOG_ARTICLE_IMPORT_CANONICAL_PREVIEW_MISSING');
        continue;
      }
      row.errors.push(...canonical.errors);
      if (
        canonical.errors.some(
          (error) =>
            error.includes('ARTICLE_IDENTITY_ALREADY_EXISTS') ||
            error.includes('CATALOG_IMPORT_DUPLICATE_IDENTITY'),
        )
      ) {
        row.duplicateAssessment = 'EXACT';
      }
    }

    const includedRows = mappedRows.filter((row) => !row.excluded).length;
    const excludedRows = mappedRows.length - includedRows;
    const invalidRows = mappedRows.filter(
      (row) => !row.excluded && row.errors.length > 0,
    ).length;
    const warningRows = mappedRows.filter(
      (row) => !row.excluded && row.warnings.length > 0,
    ).length;
    const validRows = includedRows - invalidRows;

    const fingerprintPayload = {
      datasetReference: input.datasetReference.trim(),
      fileName: input.fileName.trim(),
      format: input.format,
      sheetName: table.sheetName,
      headers: table.headers,
      mapping: input.mapping,
      references: input.references ?? {},
      defaults: input.defaults ?? {},
      excludedRowNumbers: [...excluded].sort((a, b) => a - b),
      rows: mappedRows.map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        rowKey: row.rowKey,
        excluded: row.excluded,
        normalizedRow: row.normalizedRow,
        sourceCells: row.sourceCells,
        errors: row.errors,
        warnings: row.warnings,
        duplicateAssessment: row.duplicateAssessment,
      })),
    };
    const previewFingerprint =
      catalogArticleImportFingerprint(fingerprintPayload);

    const preview: ProfessionalCatalogArticleImportPreviewResponseDto = {
      datasetReference: input.datasetReference.trim(),
      fileName: input.fileName.trim(),
      format: input.format,
      sheetName: table.sheetName,
      headers: table.headers,
      totalRows: mappedRows.length,
      includedRows,
      excludedRows,
      validRows,
      invalidRows,
      warningRows,
      canCommit: includedRows > 0 && invalidRows === 0,
      previewFingerprint,
      rows: mappedRows.map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        rowKey: row.rowKey,
        excluded: row.excluded,
        productTypeId: row.productTypeId,
        brandId: row.brandId,
        normalizedManufacturerPartNumber:
          row.normalizedManufacturerPartNumber,
        sourceCells: row.sourceCells,
        duplicateAssessment: row.duplicateAssessment,
        errors: row.errors,
        warnings: row.warnings,
      })),
    };

    return { preview, normalizedRequest, canonicalBatch };
  }

  private validateProfessionalImportMapping(
    input: ProfessionalCatalogArticleImportRequestDto,
    table: ParsedCatalogImportTable,
  ): void {
    const columns = [
      input.mapping.rowKey,
      input.mapping.productType,
      input.mapping.schemaVersion,
      input.mapping.brand,
      input.mapping.manufacturerPartNumber,
      input.mapping.unitOfMeasure,
      input.mapping.packQuantity,
      input.mapping.name,
      input.mapping.description,
      input.mapping.sourceReference,
      ...Object.values(input.mapping.attributeColumns),
    ].filter((value): value is string => Boolean(value?.trim()));

    for (const column of columns) {
      if (!this.importHeader(table.headers, column)) {
        throw new BadRequestException({
          code: 'CATALOG_ARTICLE_IMPORT_MAPPING_COLUMN_NOT_FOUND',
          message: `Mapped source column "${column}" does not exist in the selected sheet`,
        });
      }
    }

    if (!input.defaults?.productTypeId && !input.mapping.productType) {
      throw new BadRequestException({
        code: 'CATALOG_ARTICLE_IMPORT_PRODUCT_TYPE_MAPPING_REQUIRED',
        message:
          'Article import requires either a fixed Product Type or a mapped Product Type source column',
      });
    }
    if (
      input.defaults?.schemaVersion === undefined &&
      !input.mapping.schemaVersion
    ) {
      throw new BadRequestException({
        code: 'CATALOG_ARTICLE_IMPORT_SCHEMA_VERSION_MAPPING_REQUIRED',
        message:
          'Article import requires either a fixed schema version or a mapped schema-version source column',
      });
    }

    for (const [attributeCode, column] of Object.entries(
      input.mapping.attributeColumns,
    )) {
      if (!attributeCode.trim() || !column.trim()) {
        throw new BadRequestException({
          code: 'CATALOG_ARTICLE_IMPORT_ATTRIBUTE_MAPPING_INVALID',
          message:
            'Attribute column mapping requires non-empty Attribute codes and source headers',
        });
      }
    }
  }

  private mapProfessionalImportRow(
    input: ProfessionalCatalogArticleImportRequestDto,
    table: ParsedCatalogImportTable,
    sourceRowNumber: number,
    cells: Record<string, string>,
    excluded: boolean,
  ): ProfessionalMappedImportRow {
    const errors: string[] = [];
    const warnings: string[] = [];
    const read = (column?: string): string =>
      column
        ? cells[this.importHeader(table.headers, column) ?? '']?.trim() ?? ''
        : '';

    const rowKey =
      read(input.mapping.rowKey) || `row-${sourceRowNumber}`;

    if (excluded) {
      return {
        sourceRowNumber,
        rowKey,
        excluded: true,
        normalizedRow: null,
        productTypeId: null,
        brandId: null,
        normalizedManufacturerPartNumber: null,
        sourceCells: { ...cells },
        duplicateAssessment: 'NONE',
        errors,
        warnings,
      };
    }

    const productTypeId =
      input.defaults?.productTypeId ??
      this.resolveImportReference(
        'PRODUCT_TYPE',
        read(input.mapping.productType),
        input.references?.productTypes,
        true,
        errors,
      );
    const schemaVersion =
      input.defaults?.schemaVersion ??
      this.parseImportPositiveInteger(
        'SCHEMA_VERSION',
        read(input.mapping.schemaVersion),
        true,
        errors,
      );

    let brandId: string | null = input.defaults?.brandId ?? null;
    const brandValue = read(input.mapping.brand);
    if (!brandId && brandValue) {
      brandId = this.resolveImportReference(
        'BRAND',
        brandValue,
        input.references?.brands,
        true,
        errors,
      );
    }

    let unitOfMeasureId: string | null =
      input.defaults?.unitOfMeasureId ?? null;
    const unitValue = read(input.mapping.unitOfMeasure);
    if (!unitOfMeasureId && unitValue) {
      unitOfMeasureId = this.resolveImportReference(
        'UNIT_OF_MEASURE',
        unitValue,
        input.references?.unitsOfMeasure,
        true,
        errors,
      );
    }

    const name = read(input.mapping.name);
    if (!name) {
      errors.push('CATALOG_ARTICLE_IMPORT_NAME_REQUIRED');
    }

    const manufacturerPartNumber = read(
      input.mapping.manufacturerPartNumber,
    );
    const packQuantityText = read(input.mapping.packQuantity);
    const packQuantity = packQuantityText
      ? this.parseImportPositiveNumber(
          'PACK_QUANTITY',
          packQuantityText,
          errors,
        )
      : null;

    const values: Record<string, unknown> = {};
    for (const [attributeCode, sourceColumn] of Object.entries(
      input.mapping.attributeColumns,
    )) {
      const raw = read(sourceColumn);
      if (!raw) continue;
      values[attributeCode.trim()] = this.parseImportAttributeCell(raw);
    }

    const normalizedManufacturerPartNumber = manufacturerPartNumber
      ? normalizePartNumber(manufacturerPartNumber)
      : null;

    const normalizedRow =
      productTypeId && schemaVersion && name
        ? {
            rowKey,
            productTypeId,
            schemaVersion,
            ...(brandId ? { brandId } : {}),
            ...(manufacturerPartNumber
              ? { manufacturerPartNumber }
              : {}),
            ...(unitOfMeasureId ? { unitOfMeasureId } : {}),
            ...(packQuantity !== null ? { packQuantity } : {}),
            name,
            ...(read(input.mapping.description)
              ? { description: read(input.mapping.description) }
              : {}),
            ...(read(input.mapping.sourceReference)
              ? {
                  sourceReference: read(input.mapping.sourceReference),
                }
              : {}),
            values,
          }
        : null;

    return {
      sourceRowNumber,
      rowKey,
      excluded: false,
      normalizedRow,
      productTypeId,
      brandId,
      normalizedManufacturerPartNumber,
      sourceCells: { ...cells },
      duplicateAssessment: 'NONE',
      errors,
      warnings,
    };
  }

  private addProbableImportDuplicateWarnings(
    rows: ProfessionalMappedImportRow[],
  ): void {
    const groups = new Map<string, ProfessionalMappedImportRow[]>();
    for (const row of rows) {
      if (row.excluded || !row.normalizedRow) continue;
      const normalizedName = row.normalizedRow.name
        .trim()
        .toLocaleLowerCase('en-US')
        .replace(/\s+/gu, ' ');
      const signature = [
        row.normalizedRow.productTypeId,
        row.normalizedRow.brandId ?? '',
        normalizedName,
      ].join('|');
      const group = groups.get(signature) ?? [];
      group.push(row);
      groups.set(signature, group);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const identities = new Set(
        group.map((row) => row.normalizedManufacturerPartNumber ?? ''),
      );
      if (identities.size <= 1 && !identities.has('')) continue;
      for (const row of group) {
        row.duplicateAssessment = 'PROBABLE';
        row.warnings.push(
          'CATALOG_IMPORT_PROBABLE_DUPLICATE: same Product Type, Brand and normalized Article name appears more than once in the reviewed file',
        );
      }
    }
  }

  private resolveImportReference(
    kind: 'PRODUCT_TYPE' | 'BRAND' | 'UNIT_OF_MEASURE',
    rawValue: string,
    references: Record<string, string> | undefined,
    required: boolean,
    errors: string[],
  ): string | null {
    const value = rawValue.trim();
    if (!value) {
      if (required) {
        errors.push(`CATALOG_ARTICLE_IMPORT_${kind}_REQUIRED`);
      }
      return null;
    }

    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        value,
      )
    ) {
      return value;
    }

    const resolved =
      references?.[value] ??
      Object.entries(references ?? {}).find(
        ([key]) =>
          key.trim().toLocaleLowerCase('en-US') ===
          value.toLocaleLowerCase('en-US'),
      )?.[1];
    if (
      resolved &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        resolved,
      )
    ) {
      return resolved;
    }

    errors.push(
      `CATALOG_ARTICLE_IMPORT_${kind}_UNMAPPED: ${value}`,
    );
    return null;
  }

  private parseImportPositiveInteger(
    kind: string,
    rawValue: string,
    required: boolean,
    errors: string[],
  ): number | null {
    const value = rawValue.trim();
    if (!value) {
      if (required) errors.push(`CATALOG_ARTICLE_IMPORT_${kind}_REQUIRED`);
      return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.push(`CATALOG_ARTICLE_IMPORT_${kind}_INVALID: ${value}`);
      return null;
    }
    return parsed;
  }

  private parseImportPositiveNumber(
    kind: string,
    rawValue: string,
    errors: string[],
  ): number | null {
    const parsed = Number(rawValue.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      errors.push(
        `CATALOG_ARTICLE_IMPORT_${kind}_INVALID: ${rawValue.trim()}`,
      );
      return null;
    }
    return parsed;
  }

  private parseImportAttributeCell(value: string): unknown {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        return trimmed;
      }
    }
    if (/^(true|false)$/iu.test(trimmed)) {
      return trimmed.toLocaleLowerCase('en-US') === 'true';
    }
    if (
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(trimmed) &&
      !/^0\d+/u.test(trimmed)
    ) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return numeric;
    }
    return trimmed;
  }

  private importHeader(
    headers: string[],
    requested: string,
  ): string | null {
    const normalized = requested.trim().toLocaleLowerCase('en-US');
    return (
      headers.find(
        (header) =>
          header.trim().toLocaleLowerCase('en-US') === normalized,
      ) ?? null
    );
  }

  private async prepareApprovedCatalogImport(
    input: CatalogArticleImportRequestDto,
    actorId: string,
  ): Promise<{
    preview: CatalogArticleImportPreviewResponseDto;
    preparedRows: PreparedCatalogImportRow[];
  }> {
    const datasetReference = input.datasetReference.trim();
    const preparedRows: PreparedCatalogImportRow[] = [];
    const previewRows: CatalogArticleImportPreviewResponseDto['rows'] = [];
    const seenRowKeys = new Set<string>();
    const seenIdentities = new Map<string, string>();

    for (const [index, row] of input.rows.entries()) {
      const rowNumber = index + 1;
      const rowKey = row.rowKey.trim();
      const errors: string[] = [];
      const normalizedManufacturerPartNumber =
        row.manufacturerPartNumber?.trim()
          ? normalizePartNumber(row.manufacturerPartNumber)
          : '';
      const identity =
        row.brandId && normalizedManufacturerPartNumber
          ? articleIdentityKey(
              PartNumberType.MANUFACTURER,
              row.brandId,
              normalizedManufacturerPartNumber,
            )
          : null;

      if (seenRowKeys.has(rowKey)) {
        errors.push('CATALOG_IMPORT_DUPLICATE_ROW_KEY');
      } else {
        seenRowKeys.add(rowKey);
      }

      if (identity) {
        const previousRowKey = seenIdentities.get(identity);
        if (previousRowKey) {
          errors.push(
            `CATALOG_IMPORT_DUPLICATE_IDENTITY: duplicates row ${previousRowKey}`,
          );
        } else {
          seenIdentities.set(identity, rowKey);
        }
      }

      let prepared: PreparedArticleCreation | null = null;
      if (errors.length === 0) {
        try {
          prepared = await this.prepareArticleCreation(
            {
              productTypeId: row.productTypeId,
              schemaVersion: row.schemaVersion,
              ...(row.brandId ? { brandId: row.brandId } : {}),
              ...(row.manufacturerPartNumber
                ? {
                    manufacturerPartNumber:
                      row.manufacturerPartNumber,
                  }
                : {}),
              ...(row.unitOfMeasureId
                ? { unitOfMeasureId: row.unitOfMeasureId }
                : {}),
              ...(row.packQuantity !== undefined
                ? { packQuantity: row.packQuantity }
                : {}),
              name: row.name,
              description: row.description ?? null,
              values: row.values,
            },
            {
              actorId,
              source: ArticleSource.APPROVED_CATALOG_IMPORT,
              sourceReference:
                row.sourceReference?.trim() || datasetReference,
            },
          );
        } catch (error) {
          errors.push(this.importErrorMessage(error));
        }
      }

      if (prepared && errors.length === 0) {
        preparedRows.push({ rowNumber, rowKey, prepared });
      }

      previewRows.push({
        rowNumber,
        rowKey,
        productTypeId: row.productTypeId,
        brandId: row.brandId ?? null,
        normalizedManufacturerPartNumber:
          normalizedManufacturerPartNumber || null,
        errors,
      });
    }

    const invalidRows = previewRows.filter(
      (row) => row.errors.length > 0,
    ).length;

    return {
      preview: {
        datasetReference,
        totalRows: previewRows.length,
        validRows: previewRows.length - invalidRows,
        invalidRows,
        rows: previewRows,
      },
      preparedRows,
    };
  }

  private importErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (
        typeof response === 'object' &&
        response !== null
      ) {
        const record = response as Record<string, unknown>;
        const code =
          typeof record.code === 'string'
            ? record.code
            : 'CATALOG_IMPORT_VALIDATION_FAILED';
        const message = Array.isArray(record.message)
          ? record.message.join('; ')
          : typeof record.message === 'string'
            ? record.message
            : null;
        return message ? `${code}: ${message}` : code;
      }
    }
    return 'CATALOG_IMPORT_VALIDATION_FAILED';
  }

  private async validateArticleCreationContext(
    context: ArticleCreationContext,
  ): Promise<{
    source: ArticleSource;
    sourceSellerId: string | null;
    sourceReference: string | null;
  }> {
    const sourceSellerId = context.sourceSellerId ?? null;
    const sourceReference = context.sourceReference?.trim() || null;

    if (sourceReference && sourceReference.length > 200) {
      throw new BadRequestException({
        code: 'ARTICLE_SOURCE_REFERENCE_TOO_LONG',
        message: 'Article source reference must be 200 characters or fewer',
      });
    }

    if (context.source === ArticleSource.SELLER_SUBMISSION) {
      if (!sourceSellerId) {
        throw new BadRequestException({
          code: 'ARTICLE_SOURCE_SELLER_REQUIRED',
          message: 'Seller-submitted Manufacturer Articles require a source Seller',
        });
      }

      const seller = await this.database.seller.findUnique({
        where: { id: sourceSellerId },
        select: {
          userId: true,
          status: true,
          approvalStatus: true,
          verificationStatus: true,
        },
      });
      if (
        !seller ||
        seller.userId !== context.actorId ||
        seller.status !== SellerStatus.ACTIVE ||
        seller.approvalStatus !== SellerApprovalStatus.APPROVED ||
        seller.verificationStatus !== SellerVerificationStatus.VERIFIED
      ) {
        throw new ConflictException({
          code: 'ARTICLE_SOURCE_SELLER_NOT_OPERATIONAL',
          message:
            'Seller-submitted Manufacturer Articles require the authenticated operational Seller',
        });
      }
    } else if (sourceSellerId) {
      throw new BadRequestException({
        code: 'ARTICLE_SOURCE_SELLER_NOT_ALLOWED',
        message:
          'A source Seller can only be attached to a Seller submission',
      });
    }

    return {
      source: context.source,
      sourceSellerId,
      sourceReference,
    };
  }

  private async validateArticleCreationPreconditions(input: {
    productTypeId: string;
    schemaVersionId: string;
    categoryId: string;
    productFamilyId: string;
    brandId: string | null;
    manufacturerPartNumber: string;
    articlePolicy: ArticlePolicy;
    unitOfMeasureId: string | null;
    packQuantity: number | null;
  }): Promise<void> {
    const [productType, category] = await Promise.all([
      this.database.productType.findUnique({
        where: { id: input.productTypeId },
        select: {
          categoryId: true,
          productFamilyId: true,
          currentSchemaVersionId: true,
          status: true,
        },
      }),
      this.database.category.findUnique({
        where: { id: input.categoryId },
        select: { status: true },
      }),
    ]);

    if (!productType || productType.status !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'ARTICLE_PRODUCT_TYPE_NOT_ACTIVE',
        message:
          'Manufacturer Article creation requires an Active Product Type',
      });
    }
    if (
      productType.categoryId !== input.categoryId ||
      productType.productFamilyId !== input.productFamilyId
    ) {
      throw new ConflictException({
        code: 'ARTICLE_CATALOG_HIERARCHY_MISMATCH',
        message:
          'The published Product Type schema no longer matches its current Category and Part Group',
      });
    }
    if (productType.currentSchemaVersionId !== input.schemaVersionId) {
      throw new ConflictException({
        code: 'ARTICLE_SCHEMA_NOT_CURRENT',
        message:
          'Manufacturer Articles must be created from the current published Product Type schema',
      });
    }
    if (!category || category.status !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'ARTICLE_CATEGORY_NOT_ACTIVE',
        message:
          'Manufacturer Article creation requires an Active Category',
      });
    }

    this.validateArticleBrandPolicy(
      input.articlePolicy.brand,
      input.brandId,
    );
    this.validateArticleIdentifierPolicy(
      input.articlePolicy.identifier,
      input.manufacturerPartNumber,
    );

    if (input.brandId) {
      await this.requireBrand(input.brandId, true);
    }
    await this.validateProductStructure({
      productFamilyId: input.productFamilyId,
      unitOfMeasureId: input.unitOfMeasureId,
      packQuantity: input.packQuantity,
      requireActive: true,
    });
  }

  private async validateProductStructure(input: {
    productFamilyId: string;
    unitOfMeasureId: string | null;
    packQuantity: number | null;
    requireActive: boolean;
  }): Promise<void> {
    if (input.packQuantity !== null && !input.unitOfMeasureId) {
      throw new BadRequestException({
        code: 'PRODUCT_PACK_UNIT_REQUIRED',
        message: 'Pack quantity requires a controlled Unit of Measure',
      });
    }

    const partGroup = await this.database.productFamily.findUnique({
      where: { id: input.productFamilyId },
      select: { status: true },
    });
    if (!partGroup) {
      throw new ConflictException({
        code: 'PRODUCT_PART_GROUP_NOT_FOUND',
        message: 'The Part Group in the bound schema no longer exists',
      });
    }
    if (input.requireActive && partGroup.status !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'PRODUCT_PART_GROUP_NOT_ACTIVE',
        message: 'An Active Product requires an Active Part Group',
      });
    }

    if (input.unitOfMeasureId) {
      const unit = await this.database.unitOfMeasure.findUnique({
        where: { id: input.unitOfMeasureId },
        select: { status: true },
      });
      if (!unit) {
        throw new BadRequestException({
          code: 'PRODUCT_UNIT_NOT_FOUND',
          message: 'The selected Unit of Measure does not exist',
        });
      }
      if (input.requireActive && unit.status !== MasterDataStatus.ACTIVE) {
        throw new ConflictException({
          code: 'PRODUCT_UNIT_NOT_ACTIVE',
          message: 'An Active Product requires an Active Unit of Measure',
        });
      }
    }
  }

  private async assertArticleIdentityAvailable(
    brandId: string,
    normalizedManufacturerPartNumber: string,
    client: Pick<Prisma.TransactionClient, 'partNumber'> = this.database,
  ): Promise<void> {
    const duplicate = await client.partNumber.findFirst({
      where: {
        issuerBrandId: brandId,
        type: PartNumberType.MANUFACTURER,
        normalizedPartNumber: normalizedManufacturerPartNumber,
      },
      select: { productId: true },
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

  private async assertNoSupersessionBrandDependency(
    transaction: Prisma.TransactionClient,
    articleId: string,
  ): Promise<void> {
    const relation = await transaction.articleRelation.findFirst({
      where: {
        type: ArticleRelationType.SUPERSEDES,
        status: { not: MasterDataStatus.ARCHIVED },
        OR: [
          { sourceArticleId: articleId },
          { targetArticleId: articleId },
        ],
      },
      select: { id: true },
    });
    if (relation) {
      throw new ConflictException({
        code: 'ARTICLE_BRAND_RELATION_IMMUTABLE',
        message:
          'Archive the non-archived supersession relation before changing the Article Brand',
      });
    }
  }

  private async assertArticleRelationLifecycleCompatible(
    transaction: Prisma.TransactionClient,
    articleId: string,
    nextStatus: ProductStatus,
  ): Promise<void> {
    const relation =
      nextStatus === ProductStatus.DEPRECATED
        ? await transaction.articleRelation.findFirst({
            where: {
              status: MasterDataStatus.ACTIVE,
              OR: [
                { sourceArticleId: articleId },
                {
                  targetArticleId: articleId,
                  type: {
                    in: [
                      ArticleRelationType.INTERCHANGEABLE,
                      ArticleRelationType.RELATED,
                    ],
                  },
                },
              ],
            },
            select: { id: true, type: true },
          })
        : await transaction.articleRelation.findFirst({
            where: {
              status: MasterDataStatus.ACTIVE,
              OR: [
                { sourceArticleId: articleId },
                { targetArticleId: articleId },
              ],
            },
            select: { id: true, type: true },
          });

    if (relation) {
      throw new ConflictException({
        code: 'ARTICLE_RELATION_LIFECYCLE_CONFLICT',
        message:
          nextStatus === ProductStatus.DEPRECATED
            ? 'Resolve Active outgoing, interchangeable, or related Article relations before deprecating this Article'
            : 'Resolve Active Article relations before moving this Article out of the Active lifecycle',
      });
    }
  }

  private async requireBrand(
    brandId: string,
    requireActive: boolean,
  ): Promise<void> {
    const brand = await this.database.brand.findUnique({
      where: { id: brandId },
      select: { status: true },
    });
    if (!brand) {
      throw new BadRequestException({
        code: 'PRODUCT_BRAND_NOT_FOUND',
        message: 'The selected Brand does not exist',
      });
    }
    if (requireActive && brand.status !== MasterDataStatus.ACTIVE) {
      throw new ConflictException({
        code: 'PRODUCT_BRAND_NOT_ACTIVE',
        message: 'An Active Product requires an Active Brand',
      });
    }
  }

  private schemaValidationFailed(
    issues: Array<{ code: string; attributeCode: string; message: string }>,
  ): BadRequestException {
    return new BadRequestException({
      code: 'PRODUCT_SCHEMA_VALIDATION_FAILED',
      message:
        'Product Attribute values do not satisfy the bound published schema',
      issues,
    });
  }

  private schemaSnapshotInvalid(): ConflictException {
    return new ConflictException({
      code: 'PRODUCT_SCHEMA_SNAPSHOT_INVALID',
      message:
        'The published Product Type schema snapshot cannot be used for Product persistence',
    });
  }

  private productNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product was not found',
    });
  }

  private productVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'PRODUCT_VERSION_CONFLICT',
      message: 'The Product changed; reload it before updating',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
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
      if (
        fields.some(
          (field) =>
            field.includes('dataset_reference') ||
            field.includes('datasetReference'),
        )
      ) {
        throw new ConflictException({
          code: 'CATALOG_ARTICLE_IMPORT_ALREADY_COMMITTED',
          message:
            'This dataset reference has already been committed as an Article import job',
        });
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.productVersionConflict();
    }
    throw error;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
