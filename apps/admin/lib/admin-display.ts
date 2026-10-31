export function formatAdminEnumLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\s+/gu, ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}
