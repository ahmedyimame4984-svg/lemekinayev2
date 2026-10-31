export const NON_TECHNICAL_ATTRIBUTE_GROUP_CODES = new Set([
  'IDENTITY',
  'FITMENT',
  'WARRANTY',
  'MEDIA',
  'COMMERCIAL',
  'COMMERCE',
  'PRICING',
  'INVENTORY',
]);

export const NON_TECHNICAL_ATTRIBUTE_CODES = new Set([
  'ATTR_PRODUCT_TYPE',
  'ATTR_BRAND',
  'ATTR_MANUFACTURER',
  'ATTR_MODEL_NAME',
  'ATTR_MODEL_NUMBER',
  'ATTR_PART_NUMBER',
  'ATTR_OEM_NUMBER',
  'ATTR_MPN',
  'ATTR_CROSS_REFERENCE',
  'ATTR_COMMON_NAME',
  'ATTR_SKU',
  'ATTR_GTIN',
  'ATTR_SERIES',
  'ATTR_CONDITION',
  'ATTR_UNIT_OF_MEASURE',
  'ATTR_COUNTRY_OF_ORIGIN',
  'ATTR_VEHICLE_MAKE',
  'ATTR_VEHICLE_MODEL',
  'ATTR_VEHICLE_GENERATION',
  'ATTR_VEHICLE_TRIM',
  'ATTR_VEHICLE_YEAR',
  'ATTR_YEAR_FROM',
  'ATTR_YEAR_TO',
  'ATTR_ENGINE',
  'ATTR_TRANSMISSION',
  'ATTR_DRIVE_TYPE',
  'ATTR_BODY_STYLE',
  'ATTR_FUEL_TYPE',
  'ATTR_MARKET',
  'ATTR_STEERING_SIDE',
  'ATTR_COMPATIBILITY_TYPE',
  'ATTR_WARRANTY_AVAILABLE',
  'ATTR_WARRANTY_TYPE',
  'ATTR_WARRANTY_PERIOD',
  'ATTR_PACKAGE_QUANTITY',
  'ATTR_PACKAGE_CONTENTS',
  'ATTR_PACKAGE_MATERIAL',
  'ATTR_RECYCLABLE_PACKAGING',
  'ATTR_MAIN_IMAGE',
  'ATTR_PRODUCT_IMAGES',
  'ATTR_INSTALLATION_GUIDE',
  'ATTR_TECHNICAL_DATASHEET',
  'ATTR_VIDEO',
  'ATTR_SEARCH_KEYWORDS',
  'ATTR_FUNCTIONAL_STATUS',
  'ATTR_COSMETIC_CONDITION',
]);

const NON_TECHNICAL_ATTRIBUTE_CODE_PATTERNS = [
  /(?:^|_)PRICE(?:_|$)/u,
  /(?:^|_)COST(?:_|$)/u,
  /(?:^|_)CURRENCY(?:_|$)/u,
  /(?:^|_)STOCK(?:_|$)/u,
  /(?:^|_)INVENTORY(?:_|$)/u,
  /(?:^|_)SKU(?:_|$)/u,
  /(?:^|_)GTIN(?:_|$)/u,
  /(?:^|_)EAN(?:_|$)/u,
  /(?:^|_)UPC(?:_|$)/u,
  /(?:^|_)MPN(?:_|$)/u,
  /(?:^|_)WARRANTY(?:_|$)/u,
  /(?:^|_)PART_NUMBER(?:_|$)/u,
  /(?:^|_)PART_NO(?:_|$)/u,
  /(?:^|_)ARTICLE_NUMBER(?:_|$)/u,
  /(?:^|_)ARTICLE_NO(?:_|$)/u,
  /(?:^|_)OEM_NUMBER(?:_|$)/u,
  /(?:^|_)OEM_REFERENCE(?:_|$)/u,
  /(?:^|_)OEM_REF(?:_|$)/u,
  /(?:^|_)OE_NUMBER(?:_|$)/u,
  /(?:^|_)OE_REFERENCE(?:_|$)/u,
  /(?:^|_)OE_REF(?:_|$)/u,
  /(?:^|_)CROSS_REFERENCE(?:_|$)/u,
  /(?:^|_)BRAND(?:_|$)/u,
  /(?:^|_)MANUFACTURER(?:_|$)/u,
  /(?:^|_)DISCOUNT(?:_|$)/u,
  /(?:^|_)PROMOTIONAL_PRICE(?:_|$)/u,
  /(?:^|_)MIN_ORDER_QUANTITY(?:_|$)/u,
  /(?:^|_)AVAILABLE_QUANTITY(?:_|$)/u,
  /(?:^|_)QUANTITY_ON_HAND(?:_|$)/u,
  /(?:^|_)DELIVERY(?:_|$)/u,
  /(?:^|_)COMMERCIAL_TERMS(?:_|$)/u,
];

function policyTokens(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

export function nonTechnicalAttributeReason(
  code: string,
  name?: string,
): string | null {
  const normalized = code.trim().toUpperCase();

  if (NON_TECHNICAL_ATTRIBUTE_CODES.has(normalized)) {
    return 'Article identity, structured fitment, media, warranty and commerce data must use their dedicated domain models';
  }

  const searchable = [normalized, name ? policyTokens(name) : ''].filter(Boolean);

  if (
    NON_TECHNICAL_ATTRIBUTE_CODE_PATTERNS.some((pattern) =>
      searchable.some((value) => pattern.test(value)),
    )
  ) {
    return 'Pricing, inventory, identifiers and commercial terms are not generic technical attributes';
  }

  return null;
}

export function nonTechnicalAttributeGroupReason(
  code: string,
  name?: string,
): string | null {
  const searchable = [
    policyTokens(code),
    name ? policyTokens(name) : '',
  ].filter(Boolean);

  if (
    searchable.some((value) =>
      /(^|_)(IDENTITY|FITMENT|WARRANTY|MEDIA|COMMERCIAL|COMMERCE|PRICING|INVENTORY)(_|$)/u.test(
        value,
      ),
    )
  ) {
    return 'Generic Attribute Groups are for technical specifications only; use the dedicated article, fitment, media or commerce models instead';
  }

  return null;
}

export function isNonTechnicalAttributeGroupCode(code: string): boolean {
  return nonTechnicalAttributeGroupReason(code) !== null;
}
