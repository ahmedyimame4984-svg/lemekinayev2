import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  ArticleIdentifierType, ArticleSource, CompatibilityFitmentType,
  CompatibilitySource, CompatibilityVerificationStatus, MasterDataStatus,
  PartNumberType, Prisma, ProductStatus, ProductTypeRequirementLevel,
} from '@prisma/client';
import { ProductService } from '../product/product.service.js';
import { canonicalPartNumber, normalizePartNumber } from '../product/article-identity.js';
import {
  canonicalArticleIdentifierValue, expectedGtinLength, hasValidGtinCheckDigit,
  isGtinType, normalizeArticleIdentifierValue,
} from '../product/article-identifier.js';
import { canonicalSellerArticleIdentity, sellerArticleIdentityFingerprint, type SellerArticleIdentity } from './seller-article-full-identity.js';
import type { SubmitSellerArticleDto } from './dto/seller-article.dto.js';
import type { SellerEntryIdentifiersDto } from './dto/seller-entry.dto.js';

export type InlineArticleSelection = {
  article: SubmitSellerArticleDto;
  identifiers?: SellerEntryIdentifiersDto;
  vehicleConfigurationIds?: string[];
};

function attributesFromRows(rows: Array<{
  attribute: { code: string }; valueString: string | null;
  valueNumeric: Prisma.Decimal | null; valueBoolean: boolean | null;
  valueReferenceId: string | null; valueJson: Prisma.JsonValue | null;
}>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const row of rows) {
    values[row.attribute.code] = row.valueString ?? (row.valueNumeric === null ? null : Number(row.valueNumeric))
      ?? row.valueBoolean ?? row.valueReferenceId ?? row.valueJson;
  }
  return values;
}

function requirement(snapshot: unknown, key: 'fitment' | 'gtin' | 'oeReference' | 'crossReference'): ProductTypeRequirementLevel {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return ProductTypeRequirementLevel.OPTIONAL;
  const outer = snapshot as Record<string, unknown>;
  const raw = outer.articleRequirements ?? outer.requirements;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ProductTypeRequirementLevel.OPTIONAL;
  const rules = raw as Record<string, unknown>;
  const value = rules[key] ?? (key === 'oeReference' ? rules.oemReference : undefined);
  return value === ProductTypeRequirementLevel.REQUIRED || value === ProductTypeRequirementLevel.NOT_APPLICABLE
    ? value : ProductTypeRequirementLevel.OPTIONAL;
}

/**
 * The shared Article is never edited on Seller save. Exact five-dimension
 * identity is compared before reuse; a different identity creates a new Draft.
 */
@Injectable()
export class SellerArticleIdentityResolver {
  constructor(private readonly products: ProductService) {}

  async resolve(
    tx: Prisma.TransactionClient,
    input: InlineArticleSelection,
    sellerId: string,
    actorId: string,
  ): Promise<{ articleId: string; created: boolean }> {
    const { article, identifiers = {} } = input;
    const vehicleIds = [...new Set(input.vehicleConfigurationIds ?? [])].sort();
    if (vehicleIds.length > 50) throw new BadRequestException('Select at most 50 Vehicle Configurations.');

    const type = await tx.productType.findFirst({
      where: { id: article.productTypeId, status: MasterDataStatus.ACTIVE, currentSchemaVersionId: { not: null } },
      select: { name: true, currentSchemaVersion: { select: { schemaVersion: true, snapshot: true } } },
    });
    if (!type?.currentSchemaVersion) throw new ConflictException('Select a published, Active Product Type.');

    const snapshot = type.currentSchemaVersion.snapshot;
    const gtin = identifiers.gtin?.trim() || '';
    const gtinType = identifiers.gtinType ?? ArticleIdentifierType.GTIN_13;
    if (gtin && !isGtinType(gtinType)) throw new BadRequestException('Select a GTIN type.');
    if (gtin) {
      const value = normalizeArticleIdentifierValue(gtinType, gtin);
      if (!/^\d+$/u.test(value) || value.length !== expectedGtinLength(gtinType) || !hasValidGtinCheckDigit(value)) {
        throw new BadRequestException('Invalid GTIN length or check digit.');
      }
    }
    for (const [name, value] of [
      ['gtin', gtin],
      ['oeReference', identifiers.oeReference?.trim() ?? ''],
      ['crossReference', identifiers.crossReference?.trim() ?? ''],
    ] as const) {
      const rule = requirement(snapshot, name);
      if (rule === ProductTypeRequirementLevel.REQUIRED && !value) {
        throw new BadRequestException(`${name} is required for this Product Type.`);
      }
      if (rule === ProductTypeRequirementLevel.NOT_APPLICABLE && value) {
        throw new BadRequestException(`${name} is not applicable to this Product Type.`);
      }
    }
    if (identifiers.oeReference?.trim() && !identifiers.issuerBrandId) {
      throw new BadRequestException('An OE reference requires its issuing Brand.');
    }
    if (identifiers.issuerBrandId) {
      const brand = await tx.brand.findUnique({ where: { id: identifiers.issuerBrandId }, select: { id: true } });
      if (!brand) throw new BadRequestException('Reference issuing Brand not found.');
    }
    if (requirement(snapshot, 'fitment') === ProductTypeRequirementLevel.REQUIRED && !vehicleIds.length) {
      throw new BadRequestException('Select at least one configured vehicle.');
    }
    if (requirement(snapshot, 'fitment') === ProductTypeRequirementLevel.NOT_APPLICABLE && vehicleIds.length) {
      throw new BadRequestException('Vehicle fitment is not applicable.');
    }
    const configurations = await tx.vehicleConfiguration.findMany({
      where: { id: { in: vehicleIds }, status: MasterDataStatus.ACTIVE },
      select: {
        id: true, makeId: true, modelId: true, generationId: true, trimId: true,
        engineId: true, transmissionId: true, bodyTypeId: true, marketId: true,
        steeringSide: true, transmission: { select: { driveType: true } },
      },
    });
    if (configurations.length !== vehicleIds.length) {
      throw new BadRequestException('Choose existing Active Vehicle Configurations only.');
    }
    const identities: SellerArticleIdentity['identifiers'][number][] = [];
    const mpn = article.manufacturerPartNumber?.trim();
    if (mpn) identities.push({ type: PartNumberType.MANUFACTURER, value: mpn, issuerBrandId: article.brandId ?? null });
    if (gtin) identities.push({ type: gtinType, value: gtin });
    if (identifiers.oeReference?.trim()) {
      identities.push({ type: PartNumberType.OE, value: identifiers.oeReference, issuerBrandId: identifiers.issuerBrandId });
    }
    if (identifiers.crossReference?.trim()) {
      identities.push({ type: PartNumberType.CROSS_REFERENCE, value: identifiers.crossReference, issuerBrandId: identifiers.issuerBrandId ?? null });
    }
    const identity: SellerArticleIdentity = {
      productTypeId: article.productTypeId, brandId: article.brandId ?? null,
      identifiers: identities, attributes: article.values, vehicleConfigurationIds: vehicleIds,
    };
    const canonical = canonicalSellerArticleIdentity(identity);
    const fingerprint = sellerArticleIdentityFingerprint(identity);

    // Include legacy Articles that predate the fingerprint migration. An exact
    // identifier hit alone is never sufficient to reuse a shared Article.
    const candidates = await tx.product.findMany({
      where: {
        productTypeId: article.productTypeId,
        brandId: article.brandId ?? null,
        status: { not: ProductStatus.ARCHIVED },
        OR: [
          { identityFingerprint: fingerprint },
          ...(mpn ? [{ partNumbers: { some: { type: PartNumberType.MANUFACTURER,
            normalizedPartNumber: normalizePartNumber(mpn) } } }] : []),
          ...(gtin ? [{ articleIdentifiers: { some: {
            type: gtinType, normalizedValue: normalizeArticleIdentifierValue(gtinType, gtin),
          } } }] : []),
          ...(!mpn && !gtin ? [{ identityFingerprint: null }] : []),
        ],
      },
      select: {
        id: true, status: true, sourceSellerId: true,
        partNumbers: {
          where: { status: { not: MasterDataStatus.ARCHIVED } },
          select: { type: true, partNumber: true, issuerBrandId: true },
        },
        articleIdentifiers: {
          where: { status: { not: MasterDataStatus.ARCHIVED } },
          select: { type: true, value: true },
        },
        attributeValues: { select: {
          attribute: { select: { code: true } },
          valueString: true, valueNumeric: true, valueBoolean: true,
          valueReferenceId: true, valueJson: true,
        } },
        compatibilities: {
          where: { fitmentType: CompatibilityFitmentType.EXACT,
            vehicleConfigurationId: { not: null }, status: { not: MasterDataStatus.ARCHIVED } },
          select: { vehicleConfigurationId: true },
        },
      },
    });
    for (const existing of candidates) {
      const existingIdentity: SellerArticleIdentity = {
        productTypeId: article.productTypeId, brandId: article.brandId ?? null,
        identifiers: [
          ...existing.partNumbers.map(item => ({
            type: item.type, value: item.partNumber, issuerBrandId: item.issuerBrandId,
          })),
          ...existing.articleIdentifiers.map(item => ({
            type: item.type, value: item.value,
          })),
        ],
        attributes: attributesFromRows(existing.attributeValues),
        vehicleConfigurationIds: existing.compatibilities
          .map(row => row.vehicleConfigurationId).filter((id): id is string => id !== null),
      };
      if (canonicalSellerArticleIdentity(existingIdentity) !== canonical) continue;
      if (existing.status !== ProductStatus.ACTIVE &&
          !(existing.status === ProductStatus.DRAFT && existing.sourceSellerId === sellerId)) {
        throw new ConflictException('An identical Article is already undergoing catalog review.');
      }
      return { articleId: existing.id, created: false };
    }

    const brand = article.brandId
      ? await tx.brand.findUnique({ where: { id: article.brandId }, select: { name: true } })
      : null;
    const name = [brand?.name, mpn, type.name].filter(Boolean).join(' ');
    const articleId = await this.products.createInSellerTransaction(tx, {
      productTypeId: article.productTypeId,
      schemaVersion: type.currentSchemaVersion.schemaVersion,
      brandId: article.brandId,
      manufacturerPartNumber: mpn,
      name,
      values: article.values,
      duplicateReviewReason: article.duplicateReviewReason,
    }, { actorId, source: ArticleSource.SELLER_SUBMISSION, sourceSellerId: sellerId }, fingerprint);

    if (gtin) {
      await tx.articleIdentifier.create({ data: {
        productId: articleId, type: gtinType,
        value: canonicalArticleIdentifierValue(gtinType, gtin),
        normalizedValue: normalizeArticleIdentifierValue(gtinType, gtin),
        // A GTIN alone is not the complete Article identity.
        globalIdentityKey: null, status: MasterDataStatus.DRAFT,
        createdById: actorId, updatedById: actorId,
      } });
    }
    for (const reference of [
      { type: PartNumberType.OE, value: identifiers.oeReference?.trim() },
      { type: PartNumberType.CROSS_REFERENCE, value: identifiers.crossReference?.trim() },
    ]) {
      if (!reference.value) continue;
      const normalized = normalizePartNumber(reference.value);
      if (!normalized) throw new BadRequestException('Reference must contain letters or digits.');
      await tx.partNumber.create({ data: {
        productId: articleId, type: reference.type, partNumber: canonicalPartNumber(reference.value),
        normalizedPartNumber: normalized, rawPartNumber: reference.value,
        issuerBrandId: identifiers.issuerBrandId ?? null, articleIdentityKey: null,
        isPrimary: false, status: MasterDataStatus.DRAFT,
        createdById: actorId, updatedById: actorId,
      } });
    }
    for (const configuration of configurations) {
      await tx.vehicleCompatibility.create({ data: {
        productId: articleId, vehicleConfigurationId: configuration.id,
        makeId: configuration.makeId, modelId: configuration.modelId,
        generationId: configuration.generationId, trimId: configuration.trimId,
        engineId: configuration.engineId, transmissionId: configuration.transmissionId,
        bodyTypeId: configuration.bodyTypeId, marketId: configuration.marketId,
        steeringSide: configuration.steeringSide,
        driveType: configuration.transmission?.driveType ?? null,
        fitmentType: CompatibilityFitmentType.EXACT, source: CompatibilitySource.SELLER,
        verificationStatus: CompatibilityVerificationStatus.SELLER_SUBMITTED,
        status: MasterDataStatus.DRAFT, createdById: actorId, updatedById: actorId,
      } });
      await tx.productVehicleArticle.create({ data: { productId: articleId, vehicleConfigurationId: configuration.id } });
    }
    await tx.auditLog.create({ data: {
      actorId, action: 'SELLER_ARTICLE_IDENTITY_RESOLVED', entityType: 'Product',
      entityId: articleId, metadata: { fingerprint, identifierCount: identities.length,
        attributeCount: Object.keys(article.values).length, vehicleConfigurationCount: vehicleIds.length },
    } });
    return { articleId, created: true };
  }
}
