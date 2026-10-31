import { createHash } from 'node:crypto';

/**
 * Complete canonical identity for a Seller Article. A part-number match alone
 * must never imply equivalence of technical attributes or vehicle fitments.
 */
export type SellerArticleIdentity = {
  productTypeId: string;
  brandId: string | null;
  identifiers: readonly { type: string; value: string; issuerBrandId?: string | null }[];
  attributes: Readonly<Record<string, unknown>>;
  vehicleConfigurationIds: readonly string[];
};

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function canonicalSellerArticleIdentity(identity: SellerArticleIdentity): string {
  const identifiers = identity.identifiers.map(item => ({
    type: item.type.trim().toUpperCase(),
    value: item.value.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, ''),
    issuerBrandId: item.issuerBrandId ?? null,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const vehicleConfigurationIds = [...new Set(identity.vehicleConfigurationIds)].sort();
  return JSON.stringify(canonicalValue({
    productTypeId: identity.productTypeId,
    brandId: identity.brandId ?? null,
    identifiers,
    attributes: identity.attributes,
    vehicleConfigurationIds,
  }));
}

export function sellerArticleIdentityFingerprint(identity: SellerArticleIdentity): string {
  return createHash('sha256').update(canonicalSellerArticleIdentity(identity)).digest('hex');
}
