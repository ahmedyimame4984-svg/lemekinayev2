import type { PendingArticleIdentifiers } from './seller-article-identifiers';
import type { SellerArticleProductType, SellerProductTypeSchema, RequirementLevel } from './seller-contracts';

type IdentifierRequirement = SellerArticleProductType['identifierRequirement'];
export type ArticleRequirements = Pick<SellerArticleProductType,
  'brandRequirement' | 'identifierRequirement' | 'oeReferenceRequirement' |
  'crossReferenceRequirement' | 'fitmentRequirement'> & { gtinRequirement: RequirementLevel };

function level(value: unknown, fallback: RequirementLevel): RequirementLevel {
  return value === 'REQUIRED' || value === 'OPTIONAL' || value === 'NOT_APPLICABLE' ? value : fallback;
}

/** Use the published contract, never later editable Product Type policies. */
export function articleRequirements(
  schema: SellerProductTypeSchema, fallback: SellerArticleProductType,
): ArticleRequirements {
  const rules = schema.snapshot.articleRequirements ?? schema.snapshot.requirements ?? {};
  const identifier = rules.identifier;
  return {
    brandRequirement: level(rules.brand, fallback.brandRequirement),
    identifierRequirement: ['MANUFACTURER_PART_NUMBER', 'ANY_PART_NUMBER', 'OPTIONAL', 'NOT_APPLICABLE']
      .includes(String(identifier)) ? identifier as IdentifierRequirement : fallback.identifierRequirement,
    gtinRequirement: level(rules.gtin, 'OPTIONAL'),
    oeReferenceRequirement: level(rules.oeReference, fallback.oeReferenceRequirement),
    crossReferenceRequirement: level(rules.crossReference, fallback.crossReferenceRequirement),
    fitmentRequirement: level(rules.fitment, fallback.fitmentRequirement),
  };
}

/** Creation checks only: saved Draft references are validated by the API. */
export function requiredArticleFieldError(
  requirements: ArticleRequirements, brandId: string, manufacturerPartNumber: string,
  identifiers: PendingArticleIdentifiers,
): string | null {
  if (requirements.brandRequirement === 'REQUIRED' && !brandId) return 'Select a Brand.';
  if (requirements.identifierRequirement === 'MANUFACTURER_PART_NUMBER' && !manufacturerPartNumber.trim()) {
    return 'Enter a manufacturer part number.';
  }
  if (requirements.identifierRequirement === 'ANY_PART_NUMBER' && !manufacturerPartNumber.trim() &&
      !(requirements.oeReferenceRequirement !== 'NOT_APPLICABLE' && identifiers.oeReference.trim()) &&
      !(requirements.crossReferenceRequirement !== 'NOT_APPLICABLE' && identifiers.crossReference.trim())) {
    return 'Enter a manufacturer part number, OE reference or cross reference.';
  }
  if (requirements.gtinRequirement === 'REQUIRED' && !identifiers.gtin.trim()) return 'Enter a GTIN.';
  if (requirements.oeReferenceRequirement === 'REQUIRED' && !identifiers.oeReference.trim()) return 'Enter an OE reference.';
  if (requirements.crossReferenceRequirement === 'REQUIRED' && !identifiers.crossReference.trim()) return 'Enter a cross reference.';
  return null;
}
