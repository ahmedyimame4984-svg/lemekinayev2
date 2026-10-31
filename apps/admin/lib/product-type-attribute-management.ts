import type {
  AttributeDefinitionRecord,
  ProductTypeAttributeAssignmentRecord,
} from './catalog-attribute-contracts';

export function hasCatalogManagePermission(
  permissions: readonly string[],
): boolean {
  return permissions.includes('catalog.manage');
}

export function getAvailableAttributes(
  attributes: readonly AttributeDefinitionRecord[],
  assignments: readonly ProductTypeAttributeAssignmentRecord[],
): AttributeDefinitionRecord[] {
  const assignedIds = new Set(assignments.map((assignment) => assignment.attributeId));
  return [...attributes]
    .filter(
      (attribute) =>
        attribute.status === 'ACTIVE' && !assignedIds.has(attribute.id),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function resolveAvailableAttributes(
  masterAttributes: readonly AttributeDefinitionRecord[],
  assignments: readonly ProductTypeAttributeAssignmentRecord[],
  serverAvailableAttributes: readonly AttributeDefinitionRecord[] = [],
): AttributeDefinitionRecord[] {
  if (masterAttributes.length > 0) {
    return getAvailableAttributes(masterAttributes, assignments);
  }

  const assignedIds = new Set(
    assignments.map((assignment) => assignment.attributeId),
  );

  return [...serverAvailableAttributes]
    .filter((attribute) => !assignedIds.has(attribute.id))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function parseOptionalRuleJson(
  value: string,
): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Rule JSON must be valid JSON.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error('Rule JSON must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

export function buildValidationRule(input: {
  min: string;
  max: string;
  minLength: string;
  maxLength: string;
}): Record<string, number> | null {
  const rule: Record<string, number> = {};

  const parseNumber = (label: string, value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} must be a valid number.`);
    }
    return parsed;
  };

  const parseLength = (label: string, value: string): number | undefined => {
    const parsed = parseNumber(label, value);
    if (parsed === undefined) return undefined;
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative whole number.`);
    }
    return parsed;
  };

  const min = parseNumber('Minimum', input.min);
  const max = parseNumber('Maximum', input.max);
  const minLength = parseLength('Minimum length', input.minLength);
  const maxLength = parseLength('Maximum length', input.maxLength);

  if (min !== undefined) rule.min = min;
  if (max !== undefined) rule.max = max;
  if (minLength !== undefined) rule.minLength = minLength;
  if (maxLength !== undefined) rule.maxLength = maxLength;

  if (min !== undefined && max !== undefined && min > max) {
    throw new Error('Minimum cannot be greater than maximum.');
  }
  if (
    minLength !== undefined &&
    maxLength !== undefined &&
    minLength > maxLength
  ) {
    throw new Error('Minimum length cannot be greater than maximum length.');
  }

  return Object.keys(rule).length === 0 ? null : rule;
}
