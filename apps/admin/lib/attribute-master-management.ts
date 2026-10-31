import type {
  AttributeDefinitionRecord,
  AttributeValueSource,
} from './catalog-attribute-contracts';

export function createAttributeCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return 'ATTR_';
  return normalized.startsWith('ATTR_') ? normalized : `ATTR_${normalized}`;
}

export function createAllowedValueCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function isStaticValueAttribute(
  attribute: Pick<AttributeDefinitionRecord, 'valueSource'> | null,
): boolean {
  return attribute?.valueSource === 'STATIC';
}

export function supportsManagedValues(source: AttributeValueSource): boolean {
  return source === 'STATIC';
}
