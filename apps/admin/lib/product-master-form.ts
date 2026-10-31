import type {
  ProductTypeRecord,
  ProductTypeSchemaSnapshot,
} from './catalog-contracts';

export type ProductDraftValue = string | string[];
export type ProductDraftValues = Record<string, ProductDraftValue>;

export type ProductSchemaAttribute = NonNullable<
  ProductTypeSchemaSnapshot['attributes']
>[number];

export function buildProductTypePaths(
  productTypes: ProductTypeRecord[],
): Map<string, string> {
  const byId = new Map(productTypes.map((item) => [item.id, item]));
  const paths = new Map<string, string>();

  function resolve(
    productType: ProductTypeRecord,
    seen = new Set<string>(),
  ): string {
    const cached = paths.get(productType.id);
    if (cached) return cached;
    if (seen.has(productType.id)) return productType.name;

    const nextSeen = new Set(seen);
    nextSeen.add(productType.id);
    const parent = productType.parentId
      ? byId.get(productType.parentId)
      : undefined;
    const value = parent
      ? `${resolve(parent, nextSeen)} / ${productType.name}`
      : productType.name;

    paths.set(productType.id, value);
    return value;
  }

  for (const productType of productTypes) resolve(productType);
  return paths;
}

export function sortedSchemaAttributes(
  snapshot: ProductTypeSchemaSnapshot,
): ProductSchemaAttribute[] {
  return [...(snapshot.attributes ?? [])]
    .filter(
      (attribute): attribute is ProductSchemaAttribute =>
        typeof attribute.code === 'string' && attribute.code.length > 0,
    )
    .sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        (a.name ?? a.code ?? '').localeCompare(b.name ?? b.code ?? ''),
    );
}

export function toDraftValues(
  attributes: ProductSchemaAttribute[],
  values: Record<string, unknown>,
): ProductDraftValues {
  const draft: ProductDraftValues = {};

  for (const attribute of attributes) {
    if (!attribute.code) continue;
    const value = values[attribute.code];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      draft[attribute.code] = value.map(String);
    } else if (typeof value === 'boolean') {
      draft[attribute.code] = value ? 'true' : 'false';
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      draft[attribute.code] = String(value);
    } else {
      draft[attribute.code] = JSON.stringify(value);
    }
  }

  return draft;
}

export function toProductValues(
  attributes: ProductSchemaAttribute[],
  draft: ProductDraftValues,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const attribute of attributes) {
    if (!attribute.code) continue;
    const raw = draft[attribute.code];

    if (Array.isArray(raw)) {
      if (raw.length > 0) values[attribute.code] = raw;
      continue;
    }

    const trimmed = raw?.trim() ?? '';
    if (!trimmed) continue;

    switch (attribute.dataType) {
      case 'INTEGER':
        values[attribute.code] = Number.parseInt(trimmed, 10);
        break;
      case 'DECIMAL':
      case 'MONEY':
      case 'MEASUREMENT':
        values[attribute.code] = Number(trimmed);
        break;
      case 'BOOLEAN':
        values[attribute.code] = trimmed === 'true';
        break;
      case 'MULTI_SELECT':
      case 'MULTI_IMAGE':
      case 'MULTI_REFERENCE':
        values[attribute.code] = trimmed
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        break;
      default:
        values[attribute.code] = trimmed;
        break;
    }
  }

  return values;
}

export function formatProductValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}
