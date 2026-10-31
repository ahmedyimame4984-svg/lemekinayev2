import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleIdentifierType,
  ArticleSource,
  CompatibilityFitmentType,
  CompatibilitySource,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  ProductAssetType,
  ProductAssetVisibility,
  ProductStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import { CatalogSchemaService } from '../catalog/catalog-schema.service.js';
import type { ProductTypeSchemaVersionResponseDto } from '../catalog/dto/product-type-schema.dto.js';
import { CompatibilityService } from '../compatibility/compatibility.service.js';
import type { VehicleCompatibilityResponseDto } from '../compatibility/dto/compatibility.dto.js';
import { DatabaseService } from '../database/database.service.js';
import { normalizePartNumber } from '../product/article-identity.js';
import { ArticleIdentifierService } from '../product/article-identifier.service.js';
import { ArticleRelationService } from '../product/article-relation.service.js';
import { ArticleValidationService } from '../product/article-validation.service.js';
import type { ArticleIdentifierResponseDto } from '../product/dto/article-identifier.dto.js';
import type { ArticleRelationResponseDto } from '../product/dto/article-relation.dto.js';
import type { ProductAssetResponseDto } from '../product/dto/product-asset.dto.js';
import type { PartNumberResponseDto } from '../product/dto/product-identity.dto.js';
import { ProductAssetService } from '../product/product-asset.service.js';
import { ProductIdentityService } from '../product/product-identity.service.js';
import { ProductService } from '../product/product.service.js';
import type {
  AddSellerArticleAssetDto,
  AddSellerArticleDirectIdentifierDto,
  AddSellerArticleExactFitmentDto,
  AddSellerArticleIdentifierDto,
  AddSellerArticleRelationDto,
  ResolveSellerArticleIdentityDto,
  SellerArticleProductTypeResponseDto,
  SellerArticleClassificationResponseDto,
  SellerArticleReviewReadinessDto,
  SellerArticleReviewSubmissionResultDto,
  SellerArticleSubmissionResultDto,
  SellerArticleSubmissionSummaryDto,
  SubmitSellerArticleDto,
  UpdateSellerArticleDraftDto,
} from './dto/seller-article.dto.js';
import { SellerService } from './seller.service.js';

const sellerGtinTypes = new Set<ArticleIdentifierType>([
  ArticleIdentifierType.GTIN_8,
  ArticleIdentifierType.GTIN_12,
  ArticleIdentifierType.GTIN_13,
  ArticleIdentifierType.GTIN_14,
]);

type ArticleRequirements = {
  brand: ProductTypeRequirementLevel;
  identifier: ProductTypeIdentifierRequirement;
  gtin: ProductTypeRequirementLevel;
  oeReference: ProductTypeRequirementLevel;
  crossReference: ProductTypeRequirementLevel;
  fitment: ProductTypeRequirementLevel;
  image: ProductTypeRequirementLevel;
  minimumImageCount: number;
  document: ProductTypeRequirementLevel;
  minimumDocumentCount: number;
};

@Injectable()
export class SellerArticleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
    private readonly schemas: CatalogSchemaService,
    private readonly products: ProductService,
    private readonly identity: ProductIdentityService,
    private readonly articleIdentifiers: ArticleIdentifierService,
    private readonly articleRelations: ArticleRelationService,
    private readonly compatibility: CompatibilityService,
    private readonly assets: ProductAssetService,
    private readonly validation: ArticleValidationService,
  ) {}

  /** Read-only Seller-facing match details: only Active catalog products are exposed. */
  async previewCatalogProduct(productId: string, userId: string) {
    await this.sellers.requireOperationalSellerByUser(userId);
    const product = await this.database.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
      select: {
        id: true, name: true, fitmentRequirement: true,
        brand: { select: { name: true } },
        productType: { select: { name: true } },
        partNumbers: {
          where: { status: MasterDataStatus.ACTIVE },
          select: { type: true, partNumber: true },
        },
        attributeValues: {
          select: {
            attribute: { select: { code: true, name: true } },
            valueString: true, valueNumeric: true, valueBoolean: true,
            valueReferenceId: true, valueJson: true, unit: true,
          },
          take: 40,
        },
        compatibilities: {
          where: {
            status: MasterDataStatus.ACTIVE,
            fitmentType: CompatibilityFitmentType.EXACT,
            vehicleConfigurationId: { not: null },
          },
          select: {
            vehicleConfigurationId: true,
            vehicleConfiguration: {
              select: {
                id: true, modelYear: true,
                make: { select: { name: true } },
                model: { select: { name: true } },
                generation: { select: { name: true } },
                trim: { select: { name: true } },
                engine: { select: { name: true } },
                transmission: { select: { code: true } },
                bodyType: { select: { name: true } },
                market: { select: { name: true } },
              },
            },
          },
          take: 40,
        },
      },
    });
    if (!product) throw new NotFoundException('The selected approved product is unavailable. Search again.');
    return product;
  }

  /**
   * Load the actual catalog hierarchy independently of Product Type readiness.
   * An Active Category or Part Group remains selectable even if its Product Types
   * have not yet been activated and given a published schema by Admin.
   */
  async listClassification(
    userId: string,
  ): Promise<SellerArticleClassificationResponseDto> {
    await this.sellers.requireOperationalSellerByUser(userId);

    const [categories, partGroups] = await Promise.all([
      this.database.category.findMany({
        where: { status: MasterDataStatus.ACTIVE },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.database.productFamily.findMany({
        where: {
          status: MasterDataStatus.ACTIVE,
          category: { status: MasterDataStatus.ACTIVE },
        },
        select: { id: true, categoryId: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return { categories, partGroups };
  }

  async listProductTypes(
    userId: string,
  ): Promise<SellerArticleProductTypeResponseDto[]> {
    await this.sellers.requireOperationalSellerByUser(userId);

    const records = await this.database.productType.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        category: { status: MasterDataStatus.ACTIVE },
        productFamily: { status: MasterDataStatus.ACTIVE },
        productFamilyId: { not: null },
        currentSchemaVersionId: { not: null },
      },
      select: {
        id: true,
        categoryId: true,
        productFamilyId: true,
        code: true,
        name: true,
        category: { select: { name: true } },
        productFamily: { select: { name: true } },
        currentSchemaVersion: {
          select: {
            schemaVersion: true,
            snapshot: true,
          },
        },
      },
      orderBy: [
        { category: { name: 'asc' } },
        { productFamily: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    return records.flatMap((record) => {
      if (
        !record.productFamilyId ||
        !record.productFamily ||
        !record.currentSchemaVersion
      ) {
        return [];
      }

      const requirements = this.readRequirements(
        record.currentSchemaVersion.snapshot,
      );
      const snapshot = record.currentSchemaVersion.snapshot;
      const snapshotRecord = this.isRecord(snapshot) ? snapshot : {};
      const legacy = this.isRecord(snapshotRecord.requirements)
        ? snapshotRecord.requirements : {};
      const offer = this.isRecord(snapshotRecord.offerRequirements)
        ? snapshotRecord.offerRequirements
        : this.isRecord(legacy.listing) ? legacy.listing : {};
      const sellingLevel = (value: unknown, fallback: ProductTypeRequirementLevel) =>
        typeof value === 'string' && Object.values(ProductTypeRequirementLevel).includes(value as ProductTypeRequirementLevel)
          ? value as ProductTypeRequirementLevel : fallback;


      return [
        {
          id: record.id,
          categoryId: record.categoryId,
          productFamilyId: record.productFamilyId,
          categoryName: record.category.name,
          partGroupName: record.productFamily.name,
          code: record.code,
          name: record.name,
          brandRequirement: requirements.brand,
          identifierRequirement: requirements.identifier,
          gtinRequirement: requirements.gtin,
          oeReferenceRequirement: requirements.oeReference,
          crossReferenceRequirement: requirements.crossReference,
          fitmentRequirement: requirements.fitment,
          imageRequirement: requirements.image,
          minimumImageCount: requirements.minimumImageCount,
          documentRequirement: requirements.document,
          minimumDocumentCount: requirements.minimumDocumentCount,
          priceRequirement: sellingLevel(offer.price, ProductTypeRequirementLevel.REQUIRED),
          stockRequirement: sellingLevel(offer.stock, ProductTypeRequirementLevel.REQUIRED),
          conditionRequirement: sellingLevel(offer.condition, ProductTypeRequirementLevel.REQUIRED),
          warrantyRequirement: sellingLevel(offer.warranty, ProductTypeRequirementLevel.OPTIONAL),
          schemaVersion: record.currentSchemaVersion.schemaVersion,
        },
      ];
    });
  }

  async getProductTypeSchema(
    productTypeId: string,
    userId: string,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    await this.sellers.requireOperationalSellerByUser(userId);
    return this.schemas.getCurrentPublishedSchema(productTypeId);
  }

  async listOwnSubmissions(
    userId: string,
  ): Promise<SellerArticleSubmissionSummaryDto[]> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const records = await this.database.product.findMany({
      where: {
        articleSource: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: seller.id,
      },
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
        name: true,
        status: true,
        submittedAt: true,
        catalogReviewSubmittedAt: true,
        publishedAt: true,
        schemaVersion: { select: { schemaVersion: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });

    const feedbackCandidateIds = records
      .filter(
        (record) =>
          record.status === ProductStatus.DRAFT &&
          record.catalogReviewSubmittedAt === null,
      )
      .map((record) => record.id);
    const feedbackLogs =
      feedbackCandidateIds.length === 0
        ? []
        : await this.database.auditLog.findMany({
            where: {
              action: 'SELLER_ARTICLE_RETURNED_FOR_CHANGES',
              entityType: 'Product',
              entityId: { in: feedbackCandidateIds },
            },
            select: {
              entityId: true,
              metadata: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          });
    const feedbackByArticle = new Map<
      string,
      { reason: string; createdAt: Date }
    >();
    for (const log of feedbackLogs) {
      if (!log.entityId || feedbackByArticle.has(log.entityId)) continue;
      const reason = this.reviewFeedbackReason(log.metadata);
      if (reason) {
        feedbackByArticle.set(log.entityId, {
          reason,
          createdAt: log.createdAt,
        });
      }
    }

    return records.map((record) => {
      const feedback = feedbackByArticle.get(record.id) ?? null;
      return {
        id: record.id,
        productTypeId: record.productTypeId,
        brandId: record.brandId,
        name: record.name,
        status: record.status,
        schemaVersion: record.schemaVersion.schemaVersion,
        submittedAt: record.submittedAt,
        catalogReviewSubmittedAt: record.catalogReviewSubmittedAt,
        publishedAt: record.publishedAt,
        reviewFeedback: feedback?.reason ?? null,
        reviewFeedbackAt: feedback?.createdAt ?? null,
      };
    });
  }

  async resolveIdentity(
    input: ResolveSellerArticleIdentityDto,
    userId: string,
  ): Promise<SellerArticleSubmissionResultDto | null> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const manufacturerPartNumber = input.manufacturerPartNumber.trim();
    const normalizedManufacturerPartNumber = normalizePartNumber(
      manufacturerPartNumber,
    );
    if (!normalizedManufacturerPartNumber) {
      throw new BadRequestException({
        code: 'PART_NUMBER_INVALID',
        message:
          'Manufacturer Part Number must contain at least one letter or digit.',
      });
    }

    return this.resolveExistingIdentity(
      input.brandId,
      normalizedManufacturerPartNumber,
      seller.id,
    );
  }

  async previewDuplicates(input: SubmitSellerArticleDto, userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const schema = await this.schemas.getCurrentPublishedSchema(input.productTypeId);
    return this.products.previewDuplicateCandidates({
      productTypeId: input.productTypeId, schemaVersion: schema.schemaVersion,
      brandId: input.brandId, manufacturerPartNumber: input.manufacturerPartNumber,
      unitOfMeasureId: input.unitOfMeasureId, packQuantity: input.packQuantity,
      values: input.values, name: 'Duplicate preflight',
    }, { actorId: userId, source: ArticleSource.SELLER_SUBMISSION, sourceSellerId: seller.id });
  }

  async submit(
    input: SubmitSellerArticleDto,
    userId: string,
  ): Promise<SellerArticleSubmissionResultDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const productType = await this.database.productType.findFirst({
      where: {
        id: input.productTypeId,
        status: MasterDataStatus.ACTIVE,
        currentSchemaVersionId: { not: null },
      },
      select: {
        id: true,
        name: true,
        currentSchemaVersion: {
          select: { schemaVersion: true },
        },
      },
    });

    if (!productType?.currentSchemaVersion) {
      throw new NotFoundException({
        code: 'SELLER_ARTICLE_PRODUCT_TYPE_NOT_READY',
        message:
          'This Product Type is not Active with a published schema and cannot accept seller submissions.',
      });
    }

    const manufacturerPartNumber =
      input.manufacturerPartNumber?.trim() ?? '';
    const normalizedManufacturerPartNumber = manufacturerPartNumber
      ? normalizePartNumber(manufacturerPartNumber)
      : '';

    if (manufacturerPartNumber && !normalizedManufacturerPartNumber) {
      throw new BadRequestException({
        code: 'PART_NUMBER_INVALID',
        message:
          'Manufacturer Part Number must contain at least one letter or digit.',
      });
    }

    if (input.brandId && normalizedManufacturerPartNumber) {
      const resolution = await this.resolveExistingIdentity(
        input.brandId,
        normalizedManufacturerPartNumber,
        seller.id,
      );
      if (resolution) return resolution;
    }

    const brand = input.brandId
      ? await this.database.brand.findUnique({
          where: { id: input.brandId },
          select: { name: true },
        })
      : null;

    if (input.brandId && !brand) {
      throw new BadRequestException({
        code: 'PRODUCT_BRAND_NOT_FOUND',
        message: 'The selected Brand does not exist.',
      });
    }

    const article = await this.products.create(
      {
        productTypeId: input.productTypeId,
        schemaVersion: productType.currentSchemaVersion.schemaVersion,
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(manufacturerPartNumber
          ? { manufacturerPartNumber }
          : {}),
        ...(input.unitOfMeasureId
          ? { unitOfMeasureId: input.unitOfMeasureId }
          : {}),
        ...(input.packQuantity !== undefined
          ? { packQuantity: input.packQuantity }
          : {}),
        name: this.buildDisplayName(
          brand?.name ?? null,
          manufacturerPartNumber || null,
          productType.name,
        ),
        shortDescription: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        manufacturerNotes: input.manufacturerNotes?.trim() || null,
        values: input.values,
        duplicateReviewReason: input.duplicateReviewReason,
      },
      {
        actorId: userId,
        source: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: seller.id,
        sourceReference: input.sourceReference?.trim() || null,
      },
    );

    return {
      resolution: 'CREATED_DRAFT',
      articleId: article.id,
      productTypeId: input.productTypeId,
      status: article.status,
      reused: false,
      canPrepareOffer: true,
        canSubmitOffer: false,
      requiresCatalogReview: true,
      catalogReviewSubmittedAt: null,
      message:
        'A Draft Manufacturer Article was created. Add the required technical evidence, check readiness, then submit it for catalog review.',
    };
  }

  /** Seller Draft editing never changes manufacturer identity, Product Type or status. */
  async getOwnDraftDetails(articleId: string, userId: string) {
    const owned = await this.requireOwnDraft(articleId, userId);
    const product = await this.products.getAdmin(articleId);
    const attributes = this.readBoundSellerAttributes(owned.schemaVersion.snapshot);
    const editableCodes = new Set(attributes.map(attribute => attribute.code));
    return {
      article: {
        id: product.id,
        name: product.name,
        productTypeId: product.productTypeId,
        version: product.version,
        shortDescription: product.shortDescription,
        description: product.description,
        manufacturerNotes: product.manufacturerNotes,
        values: Object.fromEntries(Object.entries(product.values).filter(([code]) => editableCodes.has(code))),
      },
      attributes,
    };
  }

  async updateOwnDraft(
    articleId: string,
    input: UpdateSellerArticleDraftDto,
    userId: string,
  ) {
    const owned = await this.requireOwnDraft(articleId, userId);
    if (input.values !== undefined) this.assertIdentityNotFingerprintBound(owned);
    const existing = await this.products.getAdmin(articleId);
    const attributes = this.readBoundSellerAttributes(owned.schemaVersion.snapshot);

    if (input.values !== undefined) {
      const editableCodes = new Set(attributes
        .filter(attribute =>
          attribute.sellerEditable !== false &&
          attribute.marketplaceVisible !== false &&
          attribute.displayMode !== 'HIDDEN' &&
          attribute.displayMode !== 'READ_ONLY',
        )
        .map(attribute => attribute.code)
        .filter((code): code is string => typeof code === 'string' && code.length > 0),
      );
      for (const code of Object.keys(input.values)) {
        if (!editableCodes.has(code)) {
          throw new BadRequestException({
            code: 'SELLER_ARTICLE_ATTRIBUTE_NOT_EDITABLE',
            message: 'One or more technical attributes cannot be edited by Sellers.',
          });
        }
      }
    }

    // The shared Product API owns schema validation, optimistic concurrency
    // and audit logging. Preserve existing Admin-managed values in a full replacement.
    const article = await this.products.update(
      articleId,
      {
        version: input.version,
        ...(input.values !== undefined
          ? { values: { ...existing.values, ...input.values } }
          : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.manufacturerNotes !== undefined
          ? { manufacturerNotes: input.manufacturerNotes }
          : {}),
      },
      userId,
    );
    const editableCodes = new Set(attributes.map(attribute => attribute.code));
    return {
      article: {
        id: article.id,
        name: article.name,
        productTypeId: article.productTypeId,
        version: article.version,
        shortDescription: article.shortDescription,
        description: article.description,
        manufacturerNotes: article.manufacturerNotes,
        values: Object.fromEntries(Object.entries(article.values).filter(([code]) => editableCodes.has(code))),
      },
      attributes,
    };
  }

  private readBoundSellerAttributes(snapshot: unknown): Array<{
    code?: string;
    name?: string;
    group?: { name?: string };
    requirement?: string;
    dataType?: string;
    displayMode?: string;
    marketplaceVisible?: boolean;
    sellerEditable?: boolean;
    [key: string]: unknown;
  }> {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
    const attributes = (snapshot as Record<string, unknown>).attributes;
    if (!Array.isArray(attributes)) return [];
    return attributes.filter((attribute): attribute is Record<string, unknown> =>
      typeof attribute === 'object' && attribute !== null && !Array.isArray(attribute) &&
      typeof attribute.code === 'string',
    ).filter(attribute =>
      attribute.sellerEditable !== false &&
      attribute.marketplaceVisible !== false &&
      attribute.displayMode !== 'HIDDEN' &&
      attribute.displayMode !== 'READ_ONLY',
    ).map(attribute => ({ ...attribute }));
  }

  async addDirectIdentifier(
    articleId: string,
    input: AddSellerArticleDirectIdentifierDto,
    userId: string,
  ): Promise<ArticleIdentifierResponseDto> {
    const article = await this.requireOwnDraft(articleId, userId);
    this.assertIdentityNotFingerprintBound(article);
    const requirements = this.readRequirements(article.schemaVersion.snapshot);

    if (
      sellerGtinTypes.has(input.type) &&
      requirements.gtin === ProductTypeRequirementLevel.NOT_APPLICABLE
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_GTIN_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow GTIN identifiers.',
      });
    }

    return this.articleIdentifiers.create(
      articleId,
      {
        type: input.type,
        value: input.value,
        ...(input.rawValue ? { rawValue: input.rawValue } : {}),
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  }

  async addIdentifier(
    articleId: string,
    input: AddSellerArticleIdentifierDto,
    userId: string,
  ): Promise<PartNumberResponseDto> {
    const article = await this.requireOwnDraft(articleId, userId);
    this.assertIdentityNotFingerprintBound(article);
    const requirements = this.readRequirements(article.schemaVersion.snapshot);

    if (input.type === PartNumberType.MANUFACTURER) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_MANUFACTURER_IDENTITY_IMMUTABLE',
        message:
          'The canonical Manufacturer Part Number must be supplied when the Article submission is created.',
      });
    }

    if (input.type === PartNumberType.SUPPLIER) {
      throw new BadRequestException({
        code: 'SELLER_ARTICLE_SUPPLIER_IDENTIFIER_NOT_ALLOWED',
        message:
          'Supplier SKU/reference data belongs to Supplier Offer, not the canonical Manufacturer Article.',
      });
    }

    if (
      input.type === PartNumberType.OE &&
      requirements.oeReference === ProductTypeRequirementLevel.NOT_APPLICABLE
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_OE_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow OE references.',
      });
    }

    if (
      input.type === PartNumberType.CROSS_REFERENCE &&
      requirements.crossReference ===
        ProductTypeRequirementLevel.NOT_APPLICABLE
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_CROSS_REFERENCE_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow cross-references.',
      });
    }

    if (
      input.type !== PartNumberType.OE &&
      input.type !== PartNumberType.CROSS_REFERENCE &&
      requirements.identifier === ProductTypeIdentifierRequirement.NOT_APPLICABLE
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_IDENTIFIER_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow Article identifiers.',
      });
    }

    return this.identity.createPartNumber(
      articleId,
      {
        ...(input.issuerBrandId
          ? { issuerBrandId: input.issuerBrandId }
          : {}),
        partNumber: input.partNumber,
        ...(input.rawPartNumber
          ? { rawPartNumber: input.rawPartNumber }
          : {}),
        type: input.type,
        isPrimary: false,
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  }

  async addRelation(
    articleId: string,
    input: AddSellerArticleRelationDto,
    userId: string,
  ): Promise<ArticleRelationResponseDto> {
    await this.requireOwnDraft(articleId, userId);

    return this.articleRelations.create(
      articleId,
      {
        targetArticleId: input.targetArticleId,
        type: input.type,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.componentQuantity !== undefined
          ? { componentQuantity: input.componentQuantity }
          : {}),
        ...(input.componentRole?.trim()
          ? { componentRole: input.componentRole.trim() }
          : {}),
        ...(input.componentOrder !== undefined
          ? { componentOrder: input.componentOrder }
          : {}),
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  }

  async addExactFitment(
    articleId: string,
    input: AddSellerArticleExactFitmentDto,
    userId: string,
  ): Promise<VehicleCompatibilityResponseDto> {
    const article = await this.requireOwnDraft(articleId, userId);
    this.assertIdentityNotFingerprintBound(article);
    const requirements = this.readRequirements(article.schemaVersion.snapshot);

    if (requirements.fitment === ProductTypeRequirementLevel.NOT_APPLICABLE) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_FITMENT_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow vehicle fitment.',
      });
    }

    const existing = await this.database.vehicleCompatibility.findFirst({
      where: {
        productId: articleId,
        vehicleConfigurationId: input.vehicleConfigurationId,
        fitmentType: CompatibilityFitmentType.EXACT,
        status: { not: MasterDataStatus.ARCHIVED },
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (existing) {
      const current = await this.compatibility.getAdmin(existing.id);
      const hasChanges =
        input.position !== undefined ||
        input.criteria !== undefined ||
        input.notes !== undefined;

      if (!hasChanges) return current;

      return this.compatibility.update(
        existing.id,
        {
          version: current.version,
          ...(input.position !== undefined
            ? { position: input.position.trim() }
            : {}),
          ...(input.criteria !== undefined ? { criteria: input.criteria } : {}),
          ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        },
        userId,
      );
    }

    return this.compatibility.create(
      {
        productId: articleId,
        vehicleConfigurationId: input.vehicleConfigurationId,
        fitmentType: CompatibilityFitmentType.EXACT,
        source: CompatibilitySource.SELLER,
        verificationStatus:
          CompatibilityVerificationStatus.SELLER_SUBMITTED,
        status: MasterDataStatus.DRAFT,
        ...(input.position?.trim()
          ? { position: input.position.trim() }
          : {}),
        ...(input.criteria !== undefined ? { criteria: input.criteria } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
      userId,
    );
  }

  async addAsset(
    articleId: string,
    input: AddSellerArticleAssetDto,
    userId: string,
  ): Promise<ProductAssetResponseDto> {
    const article = await this.requireOwnDraft(articleId, userId);
    const requirements = this.readRequirements(article.schemaVersion.snapshot);

    if (
      input.type !== ProductAssetType.IMAGE &&
      input.type !== ProductAssetType.DOCUMENT
    ) {
      throw new BadRequestException({
        code: 'SELLER_ARTICLE_ASSET_TYPE_INVALID',
        message:
          'Seller Article submissions accept only image or technical document assets.',
      });
    }

    if (
      input.type === ProductAssetType.IMAGE &&
      requirements.image === ProductTypeRequirementLevel.NOT_APPLICABLE
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_IMAGE_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow image assets.',
      });
    }

    if (
      input.type === ProductAssetType.DOCUMENT &&
      requirements.document === ProductTypeRequirementLevel.NOT_APPLICABLE
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_DOCUMENT_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow technical documents.',
      });
    }

    return this.assets.create(
      articleId,
      {
        type: input.type,
        title: input.title,
        storageReference: input.storageReference,
        mimeType: input.mimeType ?? null,
        visibility: ProductAssetVisibility.PUBLIC,
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  }

  async validateSubmission(
    articleId: string,
    userId: string,
  ): Promise<SellerArticleReviewReadinessDto> {
    await this.requireOwnSubmission(articleId, userId);
    const activation = await this.validation.validate(articleId);
    const fitmentEvidenceCount = await this.database.vehicleCompatibility.count({
      where: {
        productId: articleId,
        status: { in: [MasterDataStatus.DRAFT, MasterDataStatus.ACTIVE] },
        verificationStatus: {
          in: [
            CompatibilityVerificationStatus.SELLER_SUBMITTED,
            CompatibilityVerificationStatus.VERIFIED,
            CompatibilityVerificationStatus.APPROVED,
          ],
        },
      },
    });

    const issues = activation.issues.filter(
      (issue) =>
        !(
          issue.code === 'ARTICLE_FITMENT_REQUIRED' &&
          fitmentEvidenceCount > 0
        ),
    );
    const qualityScore = this.qualityScore(issues);

    return {
      articleId: activation.articleId,
      readyForReview: issues.length === 0,
      qualityScore,
      qualityBand: this.qualityBand(qualityScore),
      schemaVersion: activation.schemaVersion,
      schemaHash: activation.schemaHash,
      summary: {
        ...activation.summary,
        fitmentEvidenceCount,
      },
      issues,
    };
  }

  async submitForReview(
    articleId: string,
    userId: string,
  ): Promise<SellerArticleReviewSubmissionResultDto> {
    await this.requireOwnDraft(articleId, userId);
    const readiness = await this.validateSubmission(articleId, userId);
    if (!readiness.readyForReview) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_REVIEW_NOT_READY',
        message:
          'Complete the required Manufacturer Article evidence before submitting it for catalog review.',
        issues: readiness.issues,
        summary: readiness.summary,
      });
    }

    const catalogReviewSubmittedAt = new Date();
    await this.database.$transaction(async (transaction) => {
      const update = await transaction.product.updateMany({
        where: {
          id: articleId,
          status: ProductStatus.DRAFT,
          catalogReviewSubmittedAt: null,
        },
        data: {
          catalogReviewSubmittedAt,
          version: { increment: 1 },
          updatedById: userId,
        },
      });
      if (update.count !== 1) {
        throw new ConflictException({
          code: 'SELLER_ARTICLE_REVIEW_SUBMISSION_CONFLICT',
          message:
            'This Manufacturer Article is no longer an editable Seller Draft. Reload before continuing.',
        });
      }

      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'SELLER_ARTICLE_SUBMITTED_FOR_REVIEW',
          entityType: 'Product',
          entityId: articleId,
          metadata: {
            catalogReviewSubmittedAt: catalogReviewSubmittedAt.toISOString(),
            qualityScore: readiness.qualityScore,
            schemaVersion: readiness.schemaVersion,
            schemaHash: readiness.schemaHash,
            summary: { ...readiness.summary },
          },
        },
      });
    });

    return {
      articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt,
      readiness,
    };
  }

  private async resolveExistingIdentity(
    brandId: string,
    normalizedManufacturerPartNumber: string,
    sellerId: string,
  ): Promise<SellerArticleSubmissionResultDto | null> {
    const identifier = await this.database.partNumber.findFirst({
      where: {
        issuerBrandId: brandId,
        type: PartNumberType.MANUFACTURER,
        normalizedPartNumber: normalizedManufacturerPartNumber,
      },
      select: {
        product: {
          select: {
            id: true,
            productTypeId: true,
            status: true,
            articleSource: true,
            sourceSellerId: true,
            catalogReviewSubmittedAt: true,
          },
        },
      },
    });
    if (!identifier) return null;

    const article = identifier.product;
    if (article.status === ProductStatus.ACTIVE) {
      return {
        resolution: 'REUSED_ACTIVE',
        articleId: article.id,
        productTypeId: article.productTypeId,
        status: article.status,
        reused: true,
        canPrepareOffer: true,
        canSubmitOffer: true,
        requiresCatalogReview: false,
        catalogReviewSubmittedAt: article.catalogReviewSubmittedAt,
        message:
          'An approved Manufacturer Article already uses this Brand and Manufacturer Part Number, so the canonical Article was reused.',
      };
    }

    if (
      article.status === ProductStatus.DRAFT &&
      article.articleSource === ArticleSource.SELLER_SUBMISSION &&
      article.sourceSellerId === sellerId
    ) {
      if (article.catalogReviewSubmittedAt) {
        return {
          resolution: 'REUSED_OWN_REVIEW',
          articleId: article.id,
          productTypeId: article.productTypeId,
          status: article.status,
          reused: true,
          canPrepareOffer: true,
          canSubmitOffer: false,
          requiresCatalogReview: true,
          catalogReviewSubmittedAt: article.catalogReviewSubmittedAt,
          message:
            'Your Manufacturer Article with this canonical identity is already submitted for catalog review.',
        };
      }

      return {
        resolution: 'REUSED_OWN_DRAFT',
        articleId: article.id,
        productTypeId: article.productTypeId,
        status: article.status,
        reused: true,
        canPrepareOffer: true,
        canSubmitOffer: false,
        requiresCatalogReview: true,
        catalogReviewSubmittedAt: null,
        message:
          'Your existing editable Draft with this canonical identity was reused instead of creating a duplicate.',
      };
    }

    return {
      resolution: 'EXISTING_REVIEW_REQUIRED',
      articleId: article.id,
      productTypeId: article.productTypeId,
      status: article.status,
      reused: true,
      canPrepareOffer: false,
        canSubmitOffer: false,
      requiresCatalogReview: true,
      catalogReviewSubmittedAt: article.catalogReviewSubmittedAt,
      message:
        'A Manufacturer Article with this canonical identity already exists but is not currently reusable. Catalog review is required instead of creating a duplicate.',
    };
  }

  private assertIdentityNotFingerprintBound(article: { identityFingerprint: string | null }) {
    if (article.identityFingerprint) {
      throw new ConflictException({
        code: 'SELLER_LISTING_ARTICLE_COPY_ON_WRITE_REQUIRED',
        message: 'This product is used by a Listing. Update its specifications through Edit Listing to preserve identity and other Sellers.',
      });
    }
  }

  private async requireOwnDraft(
    articleId: string,
    userId: string,
  ): Promise<{
    id: string;
    schemaVersion: { snapshot: unknown };
    identityFingerprint: string | null;
    catalogReviewSubmittedAt: Date | null;
  }> {
    const article = await this.requireOwnSubmission(articleId, userId);
    if (
      article.status !== ProductStatus.DRAFT ||
      article.catalogReviewSubmittedAt !== null
    ) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_NOT_EDITABLE',
        message:
          'Seller technical evidence can only be changed before the Draft Manufacturer Article is submitted for catalog review.',
      });
    }
    return article;
  }

  private async requireOwnSubmission(
    articleId: string,
    userId: string,
  ): Promise<{
    id: string;
    status: ProductStatus;
    catalogReviewSubmittedAt: Date | null;
    identityFingerprint: string | null;
    schemaVersion: { snapshot: unknown };
  }> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const article = await this.database.product.findFirst({
      where: {
        id: articleId,
        articleSource: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: seller.id,
      },
      select: {
        id: true,
        status: true,
        catalogReviewSubmittedAt: true,
        identityFingerprint: true,
        schemaVersion: { select: { snapshot: true } },
      },
    });

    if (!article) {
      throw new NotFoundException({
        code: 'SELLER_ARTICLE_SUBMISSION_NOT_FOUND',
        message:
          'The Manufacturer Article submission was not found for this Seller.',
      });
    }
    return article;
  }

  private reviewFeedbackReason(metadata: unknown): string | null {
    if (
      typeof metadata !== 'object' ||
      metadata === null ||
      Array.isArray(metadata)
    ) {
      return null;
    }
    const reason = (metadata as Record<string, unknown>).reason;
    return typeof reason === 'string' && reason.trim()
      ? reason.trim()
      : null;
  }

  private qualityScore(
    issues: Array<{ area: string }>,
  ): number {
    if (issues.length === 0) return 100;
    const areaWeights: Record<string, number> = {
      TECHNICAL_ATTRIBUTES: 30,
      BRAND: 10,
      IDENTIFIER: 15,
      GTIN: 10,
      OE_REFERENCE: 10,
      CROSS_REFERENCE: 5,
      FITMENT: 15,
      IMAGE: 10,
      DOCUMENT: 5,
    };
    const failedAreas = new Set(issues.map((issue) => issue.area));
    const penalty = [...failedAreas].reduce(
      (total, area) => total + (areaWeights[area] ?? 0),
      0,
    );
    return Math.max(0, 100 - penalty);
  }

  private qualityBand(
    score: number,
  ): 'COMPLETE' | 'GOOD' | 'NEEDS_WORK' | 'POOR' {
    if (score === 100) return 'COMPLETE';
    if (score >= 80) return 'GOOD';
    if (score >= 60) return 'NEEDS_WORK';
    return 'POOR';
  }

  private buildDisplayName(
    brandName: string | null,
    manufacturerPartNumber: string | null,
    productTypeName: string,
  ): string {
    const value = [brandName, manufacturerPartNumber, productTypeName]
      .filter((item): item is string => Boolean(item?.trim()))
      .join(' · ')
      .trim();

    if (value.length < 2) {
      throw new ConflictException({
        code: 'SELLER_ARTICLE_NAME_UNAVAILABLE',
        message:
          'A Manufacturer Article display name could not be generated from the selected catalog identity.',
      });
    }
    return value.slice(0, 180);
  }

  private readRequirements(snapshot: unknown): ArticleRequirements {
    const source =
      this.isRecord(snapshot) && this.isRecord(snapshot.articleRequirements)
        ? snapshot.articleRequirements
        : this.isRecord(snapshot) && this.isRecord(snapshot.requirements)
          ? snapshot.requirements
          : {};

    return {
      brand: this.requirementLevel(source.brand),
      identifier: this.identifierRequirement(source.identifier),
      gtin: this.requirementLevel(source.gtin),
      oeReference: this.requirementLevel(
        source.oeReference ?? source.oemReference,
      ),
      crossReference: this.requirementLevel(source.crossReference),
      fitment: this.requirementLevel(source.fitment),
      image: this.requirementLevel(source.image),
      minimumImageCount: this.nonNegativeInteger(source.minimumImageCount),
      document: this.requirementLevel(source.document),
      minimumDocumentCount: this.nonNegativeInteger(
        source.minimumDocumentCount,
      ),
    };
  }

  private requirementLevel(value: unknown): ProductTypeRequirementLevel {
    return typeof value === 'string' &&
      Object.values(ProductTypeRequirementLevel).includes(
        value as ProductTypeRequirementLevel,
      )
      ? (value as ProductTypeRequirementLevel)
      : ProductTypeRequirementLevel.OPTIONAL;
  }

  private identifierRequirement(
    value: unknown,
  ): ProductTypeIdentifierRequirement {
    return typeof value === 'string' &&
      Object.values(ProductTypeIdentifierRequirement).includes(
        value as ProductTypeIdentifierRequirement,
      )
      ? (value as ProductTypeIdentifierRequirement)
      : ProductTypeIdentifierRequirement.OPTIONAL;
  }

  private nonNegativeInteger(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? value
      : 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
