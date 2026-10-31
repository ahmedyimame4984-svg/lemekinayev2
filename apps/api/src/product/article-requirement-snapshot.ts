import { ConflictException } from '@nestjs/common';
import {
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';

/** Immutable policy saved on each canonical Article at creation time. */
export interface ArticleRequirementColumns {
  brandRequirement: ProductTypeRequirementLevel;
  identifierRequirement: ProductTypeIdentifierRequirement;
  gtinRequirement: ProductTypeRequirementLevel;
  oemReferenceRequirement: ProductTypeRequirementLevel;
  crossReferenceRequirement: ProductTypeRequirementLevel;
  fitmentRequirement: ProductTypeRequirementLevel;
  imageRequirement: ProductTypeRequirementLevel;
  minimumImageCount: number;
  maximumImageCount: number;
  documentRequirement: ProductTypeRequirementLevel;
  minimumDocumentCount: number;
  priceRequirement: ProductTypeRequirementLevel;
  stockRequirement: ProductTypeRequirementLevel;
  conditionRequirement: ProductTypeRequirementLevel;
  warrantyRequirement: ProductTypeRequirementLevel;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function invalidSnapshot(): never {
  throw new ConflictException({
    code: 'PRODUCT_SCHEMA_REQUIREMENTS_INVALID',
    message: 'The published Product Type contains invalid Article requirements',
  });
}

function requirement(
  source: JsonRecord,
  key: string,
  fallback: ProductTypeRequirementLevel,
): ProductTypeRequirementLevel {
  const value = source[key];
  if (value === undefined || value === null || value === '') return fallback;
  if (
    Object.values(ProductTypeRequirementLevel).includes(
      value as ProductTypeRequirementLevel,
    )
  ) {
    return value as ProductTypeRequirementLevel;
  }
  return invalidSnapshot();
}

function identifierRequirement(
  source: JsonRecord,
): ProductTypeIdentifierRequirement {
  const value = source.identifier;
  if (value === undefined || value === null || value === '') {
    return ProductTypeIdentifierRequirement.ANY_PART_NUMBER;
  }
  if (
    Object.values(ProductTypeIdentifierRequirement).includes(
      value as ProductTypeIdentifierRequirement,
    )
  ) {
    return value as ProductTypeIdentifierRequirement;
  }
  return invalidSnapshot();
}

function count(source: JsonRecord, key: string, fallback: number): number {
  const value = source[key];
  if (value === undefined || value === null || value === '') return fallback;
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 20
  ) {
    return value;
  }
  return invalidSnapshot();
}

/**
 * Copy from the exact published Product Type schema bound to this Article.
 * NEVER query mutable product_types: later schema publications must not
 * silently change an existing Article's frozen requirements.
 *
 * Legacy snapshots may omit newer fields; defaults match the migration.
 */
export function articleRequirementColumnsFromSchema(
  snapshot: unknown,
): ArticleRequirementColumns {
  const root = asRecord(snapshot);
  if (!root) return invalidSnapshot();

  for (const key of [
    'articleRequirements',
    'requirements',
    'offerRequirements',
  ]) {
    if (root[key] !== undefined && !asRecord(root[key]))
      return invalidSnapshot();
  }
  const article =
    asRecord(root.articleRequirements) ?? asRecord(root.requirements) ?? {};
  const offer = asRecord(root.offerRequirements) ?? {};

  const imageRequirement = requirement(
    article,
    'image',
    ProductTypeRequirementLevel.REQUIRED,
  );
  const documentRequirement = requirement(
    article,
    'document',
    ProductTypeRequirementLevel.OPTIONAL,
  );
  const minimumImageCount = count(
    article,
    'minimumImageCount',
    imageRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE ? 0 : 1,
  );
  const maximumImageCount = count(
    article,
    'maximumImageCount',
    imageRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE ? 0 : 20,
  );
  if (
    maximumImageCount < minimumImageCount ||
    (imageRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE
      ? minimumImageCount !== 0 || maximumImageCount !== 0
      : maximumImageCount === 0)
  ) return invalidSnapshot();

  return {
    brandRequirement: requirement(
      article,
      'brand',
      ProductTypeRequirementLevel.OPTIONAL,
    ),
    identifierRequirement: identifierRequirement(article),
    gtinRequirement: requirement(
      article,
      'gtin',
      ProductTypeRequirementLevel.OPTIONAL,
    ),
    oemReferenceRequirement: requirement(
      { ...article, oeReference: article.oeReference ?? article.oemReference },
      'oeReference',
      ProductTypeRequirementLevel.OPTIONAL,
    ),
    crossReferenceRequirement: requirement(
      article,
      'crossReference',
      ProductTypeRequirementLevel.OPTIONAL,
    ),
    fitmentRequirement: requirement(
      article,
      'fitment',
      ProductTypeRequirementLevel.REQUIRED,
    ),
    imageRequirement,
    minimumImageCount,
    maximumImageCount,
    documentRequirement,
    minimumDocumentCount: count(article, 'minimumDocumentCount', 0),
    priceRequirement: requirement(
      offer,
      'price',
      ProductTypeRequirementLevel.REQUIRED,
    ),
    stockRequirement: requirement(
      offer,
      'stock',
      ProductTypeRequirementLevel.REQUIRED,
    ),
    conditionRequirement: requirement(
      offer,
      'condition',
      ProductTypeRequirementLevel.REQUIRED,
    ),
    warrantyRequirement: requirement(
      offer,
      'warranty',
      ProductTypeRequirementLevel.OPTIONAL,
    ),
  };
}
