import type { ProductTypeRecord } from './catalog-contracts';
import type { ProductTypeAttributeAssignmentRecord } from './catalog-attribute-contracts';

/**
 * The schema POST can succeed while a stale UI still shows Draft. Confirm
 * persisted state before claiming successful Product Type activation.
 */
export function productTypePublicationVerificationError({
  productType,
  assignments,
  expectedProductTypeId,
  expectedSchemaId,
  expectedAssignmentIds,
}: {
  productType: Pick<ProductTypeRecord, 'id' | 'status' | 'currentSchemaVersionId'>;
  assignments: ReadonlyArray<Pick<ProductTypeAttributeAssignmentRecord, 'id' | 'status'>>;
  expectedProductTypeId: string;
  expectedSchemaId: string;
  expectedAssignmentIds: readonly string[];
}): string | null {
  if (!productType || productType.id !== expectedProductTypeId) {
    return 'Publication returned a different Product Type. Reload and review its status.';
  }
  if (productType.status !== 'ACTIVE') {
    return `A schema version was created, but the saved Product Type is still ${productType.status}. It has not been activated.`;
  }
  if (!expectedSchemaId || productType.currentSchemaVersionId !== expectedSchemaId) {
    return 'The saved Product Type does not reference the published schema version. Reload and review its status.';
  }
  if (
    !Array.isArray(assignments) ||
    assignments.length === 0 ||
    assignments.some(
      (assignment) =>
        !assignment ||
        typeof assignment.id !== 'string' ||
        typeof assignment.status !== 'string',
    )
  ) {
    return 'The saved Attribute assignments could not be verified. Reload and inspect the assignments.';
  }
  const remainingDrafts = assignments.filter(
    (assignment) => assignment.status === 'DRAFT',
  ).length;
  if (remainingDrafts > 0) {
    return `The Product Type is Active, but ${remainingDrafts} assigned Attribute(s) remain Draft. Reload and inspect the assignments.`;
  }
  const activeIds = new Set(
    assignments
      .filter((assignment) => assignment.status === 'ACTIVE')
      .map((assignment) => assignment.id),
  );
  if (
    expectedAssignmentIds.length === 0 ||
    expectedAssignmentIds.some((id) => !activeIds.has(id))
  ) {
    return 'Some published Attribute assignments are missing or are not Active. Reload and inspect the assignments.';
  }
  return null;
}
