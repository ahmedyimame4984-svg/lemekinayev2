import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleIdentifierType,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductAssetType,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import { CatalogSchemaValidationService } from '../catalog/catalog-schema-validation.service.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  ArticleValidationIssueDto,
  ArticleValidationResponseDto,
} from './dto/article-validation.dto.js';

export type ArticleValidationOverrides = {
  brandId?: string | null;
  values?: Record<string, unknown>;
};

type ArticleRequirements = {
  brand: ProductTypeRequirementLevel;
  identifier: ProductTypeIdentifierRequirement;
  gtin: ProductTypeRequirementLevel;
  oeReference: ProductTypeRequirementLevel;
  crossReference: ProductTypeRequirementLevel;
  fitment: ProductTypeRequirementLevel;
};

const readinessStatuses = [MasterDataStatus.DRAFT, MasterDataStatus.ACTIVE];
const gtinTypes = new Set<ArticleIdentifierType>([
  ArticleIdentifierType.GTIN_8,
  ArticleIdentifierType.GTIN_12,
  ArticleIdentifierType.GTIN_13,
  ArticleIdentifierType.GTIN_14,
]);

@Injectable()
export class ArticleValidationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly schemaValidation: CatalogSchemaValidationService,
  ) {}

  async validate(
    articleId: string,
    overrides: ArticleValidationOverrides = {},
  ): Promise<ArticleValidationResponseDto> {
    const article = await this.database.product.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        brandId: true,
        brandRequirement: true,
        identifierRequirement: true,
        gtinRequirement: true,
        oemReferenceRequirement: true,
        crossReferenceRequirement: true,
        fitmentRequirement: true,
        schemaVersion: {
          select: {
            id: true,
            productTypeId: true,
            schemaVersion: true,
            schemaHash: true,
            snapshot: true,
            publishedAt: true,
          },
        },
        attributeValues: {
          select: {
            valueString: true,
            valueNumeric: true,
            valueBoolean: true,
            valueReferenceId: true,
            valueJson: true,
            attribute: { select: { code: true } },
          },
        },
        partNumbers: {
          where: { status: { in: readinessStatuses } },
          select: { type: true, isPrimary: true },
        },
        articleIdentifiers: {
          where: { status: { in: readinessStatuses } },
          select: { type: true },
        },
        compatibilities: {
          where: { status: { in: readinessStatuses } },
          select: { verificationStatus: true },
        },
        assets: {
          where: { status: { in: readinessStatuses } },
          select: { type: true },
        },
      },
    });

    if (!article) {
      throw new NotFoundException({
        code: 'ARTICLE_NOT_FOUND',
        message: 'Manufacturer Article was not found',
      });
    }

    const values = overrides.values ?? this.toValues(article.attributeValues);
    const brandId =
      overrides.brandId !== undefined ? overrides.brandId : article.brandId;
    const requirements: ArticleRequirements = {
      brand: article.brandRequirement,
      identifier: article.identifierRequirement,
      gtin: article.gtinRequirement,
      oeReference: article.oemReferenceRequirement,
      crossReference: article.crossReferenceRequirement,
      fitment: article.fitmentRequirement,
    };
    // Fail closed if a deployment skipped the policy backfill.
    const levels = [requirements.brand, requirements.gtin, requirements.oeReference,
      requirements.crossReference, requirements.fitment];
    if (levels.some(level => !Object.values(ProductTypeRequirementLevel).includes(level)) ||
        !Object.values(ProductTypeIdentifierRequirement).includes(requirements.identifier)) {
      throw new ConflictException({ code: 'ARTICLE_REQUIREMENTS_MISSING',
        message: 'Article requirement snapshot is incomplete. Apply the reviewed backfill before validation.' });
    }
    const issues: ArticleValidationIssueDto[] = [];

    const technical = this.schemaValidation.validatePublishedSchema(
      article.schemaVersion,
      values,
      { skipSellerMediaRequirements: true },
    );
    for (const issue of technical.issues) {
      issues.push({
        code: issue.code,
        area: 'TECHNICAL_ATTRIBUTES',
        attributeCode: issue.attributeCode,
        message: issue.message,
      });
    }

    this.validateRequirement(
      requirements.brand,
      Boolean(brandId),
      issues,
      'BRAND',
      'ARTICLE_BRAND_REQUIRED',
      'ARTICLE_BRAND_NOT_APPLICABLE',
      'A Brand is required by the bound Product Type schema.',
      'The bound Product Type schema does not allow a Brand.',
    );

    const articleIdentifiers = article.partNumbers.filter(
      (identifier) =>
        identifier.type !== PartNumberType.OE &&
        identifier.type !== PartNumberType.CROSS_REFERENCE,
    );
    const identifierCount = articleIdentifiers.length;
    const primaryManufacturer = articleIdentifiers.some(
      (identifier) =>
        identifier.type === PartNumberType.MANUFACTURER &&
        identifier.isPrimary,
    );
    if (
      requirements.identifier ===
        ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER &&
      !primaryManufacturer
    ) {
      issues.push({
        code: 'ARTICLE_MANUFACTURER_PART_NUMBER_REQUIRED',
        area: 'IDENTIFIER',
        message:
          'A primary Manufacturer Part Number is required by the bound Product Type schema.',
      });
    } else if (
      requirements.identifier ===
        ProductTypeIdentifierRequirement.ANY_PART_NUMBER &&
      identifierCount === 0
    ) {
      issues.push({
        code: 'ARTICLE_IDENTIFIER_REQUIRED',
        area: 'IDENTIFIER',
        message:
          'At least one Article identifier is required by the bound Product Type schema.',
      });
    } else if (
      requirements.identifier ===
        ProductTypeIdentifierRequirement.NOT_APPLICABLE &&
      identifierCount > 0
    ) {
      issues.push({
        code: 'ARTICLE_IDENTIFIER_NOT_APPLICABLE',
        area: 'IDENTIFIER',
        message:
          'The bound Product Type schema does not allow Article identifiers.',
      });
    }

    const gtinCount = article.articleIdentifiers.filter((identifier) =>
      gtinTypes.has(identifier.type),
    ).length;
    this.validateRequirement(
      requirements.gtin,
      gtinCount > 0,
      issues,
      'GTIN',
      'ARTICLE_GTIN_REQUIRED',
      'ARTICLE_GTIN_NOT_APPLICABLE',
      'At least one GTIN-8, GTIN-12, GTIN-13 or GTIN-14 is required by the bound Product Type schema.',
      'The bound Product Type schema does not allow GTIN identifiers.',
    );

    const oeReferenceCount = article.partNumbers.filter(
      (identifier) => identifier.type === PartNumberType.OE,
    ).length;
    this.validateRequirement(
      requirements.oeReference,
      oeReferenceCount > 0,
      issues,
      'OE_REFERENCE',
      'ARTICLE_OE_REFERENCE_REQUIRED',
      'ARTICLE_OE_REFERENCE_NOT_APPLICABLE',
      'At least one OE reference is required by the bound Product Type schema.',
      'The bound Product Type schema does not allow OE references.',
    );

    const crossReferenceCount = article.partNumbers.filter(
      (identifier) => identifier.type === PartNumberType.CROSS_REFERENCE,
    ).length;
    this.validateRequirement(
      requirements.crossReference,
      crossReferenceCount > 0,
      issues,
      'CROSS_REFERENCE',
      'ARTICLE_CROSS_REFERENCE_REQUIRED',
      'ARTICLE_CROSS_REFERENCE_NOT_APPLICABLE',
      'At least one cross-reference is required by the bound Product Type schema.',
      'The bound Product Type schema does not allow cross-references.',
    );

    const verifiedFitmentCount = article.compatibilities.filter(
      (fitment) =>
        fitment.verificationStatus === CompatibilityVerificationStatus.VERIFIED ||
        fitment.verificationStatus === CompatibilityVerificationStatus.APPROVED,
    ).length;
    this.validateRequirement(
      requirements.fitment,
      verifiedFitmentCount > 0,
      issues,
      'FITMENT',
      'ARTICLE_FITMENT_REQUIRED',
      'ARTICLE_FITMENT_NOT_APPLICABLE',
      'At least one verified fitment is required by the bound Product Type schema.',
      'The bound Product Type schema does not allow fitment records.',
      article.compatibilities.length > 0,
    );

    // Preserve existing response counts for diagnostics; media requirements
    // are enforced at Seller Listing review rather than Article activation.
    const imageCount = article.assets.filter(
      (asset) => asset.type === ProductAssetType.IMAGE,
    ).length;
    const documentCount = article.assets.filter(
      (asset) => asset.type === ProductAssetType.DOCUMENT,
    ).length;

    const qualityScore = this.qualityScore(issues);

    return {
      articleId: article.id,
      readyForActivation: issues.length === 0,
      qualityScore,
      qualityBand: this.qualityBand(qualityScore),
      schemaVersion: article.schemaVersion.schemaVersion,
      schemaHash: article.schemaVersion.schemaHash,
      summary: {
        identifierCount,
        gtinCount,
        oeReferenceCount,
        crossReferenceCount,
        verifiedFitmentCount,
        imageCount,
        documentCount,
      },
      issues,
    };
  }

  async assertReadyForActivation(
    articleId: string,
    overrides: ArticleValidationOverrides = {},
  ): Promise<ArticleValidationResponseDto> {
    const result = await this.validate(articleId, overrides);
    if (!result.readyForActivation) {
      throw new ConflictException({
        code: 'ARTICLE_VALIDATION_FAILED',
        message:
          'Manufacturer Article cannot be activated until all bound Article requirements are satisfied',
        qualityScore: result.qualityScore,
        qualityBand: result.qualityBand,
        issues: result.issues,
        summary: result.summary,
      });
    }
    return result;
  }

  private qualityScore(issues: ArticleValidationIssueDto[]): number {
    if (issues.length === 0) return 100;

    const areaWeights: Record<string, number> = {
      TECHNICAL_ATTRIBUTES: 30,
      BRAND: 10,
      IDENTIFIER: 15,
      GTIN: 10,
      OE_REFERENCE: 10,
      CROSS_REFERENCE: 5,
      FITMENT: 15,
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

  private validateRequirement(
    requirement: ProductTypeRequirementLevel,
    present: boolean,
    issues: ArticleValidationIssueDto[],
    area: string,
    requiredCode: string,
    notApplicableCode: string,
    requiredMessage: string,
    notApplicableMessage: string,
    anyPresent = present,
  ): void {
    if (requirement === ProductTypeRequirementLevel.REQUIRED && !present) {
      issues.push({ code: requiredCode, area, message: requiredMessage });
    } else if (
      requirement === ProductTypeRequirementLevel.NOT_APPLICABLE &&
      anyPresent
    ) {
      issues.push({
        code: notApplicableCode,
        area,
        message: notApplicableMessage,
      });
    }
  }

  private toValues(
    values: Array<{
      valueString: string | null;
      valueNumeric: Prisma.Decimal | null;
      valueBoolean: boolean | null;
      valueReferenceId: string | null;
      valueJson: Prisma.JsonValue | null;
      attribute: { code: string };
    }>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const item of values) {
      if (item.valueString !== null) result[item.attribute.code] = item.valueString;
      else if (item.valueNumeric !== null)
        result[item.attribute.code] = Number(item.valueNumeric);
      else if (item.valueBoolean !== null)
        result[item.attribute.code] = item.valueBoolean;
      else if (item.valueReferenceId !== null)
        result[item.attribute.code] = item.valueReferenceId;
      else result[item.attribute.code] = item.valueJson;
    }
    return result;
  }

}
