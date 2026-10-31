import { describe, expect, it } from 'vitest';
import { productTypePublicationVerificationError } from './product-type-publication';

const base = {
  expectedProductTypeId: 'brake-pad',
  expectedSchemaId: 'schema-3',
  expectedAssignmentIds: ['assignment-1'],
  productType: {
    id: 'brake-pad',
    status: 'ACTIVE' as const,
    currentSchemaVersionId: 'schema-3',
  },
  assignments: [{ id: 'assignment-1', status: 'ACTIVE' as const }],
};

describe('Product Type publication verification', () => {
  it('accepts only the saved active Product Type and published schema', () => {
    expect(productTypePublicationVerificationError(base)).toBeNull();
  });

  it('rejects a green publication response when the saved record remains Draft', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      productType: { ...base.productType, status: 'DRAFT' },
    })).toContain('still DRAFT');
  });

  it('rejects an absent or mismatched current published schema', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      productType: { ...base.productType, currentSchemaVersionId: null },
    })).toContain('does not reference');
  });

  it('rejects remaining Draft attribute assignments after publishing', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      assignments: [{ id: 'assignment-1', status: 'DRAFT' }],
    })).toContain('1 assigned Attribute(s) remain Draft');
  });

  it('rejects verification for a different Product Type', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      productType: { ...base.productType, id: 'wrong-type' },
    })).toContain('different Product Type');
  });

  it('rejects an empty assignment readback instead of reporting activation', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      assignments: [],
    })).toContain('could not be verified');
  });

  it('handles malformed assignment JSON without crashing the workbench', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      assignments: null as unknown as typeof base.assignments,
    })).toContain('could not be verified');
  });

  it('requires every assignment submitted for publication to be present and Active', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      expectedAssignmentIds: ['assignment-1', 'assignment-2'],
    })).toContain('missing or are not Active');
    expect(productTypePublicationVerificationError({
      ...base,
      assignments: [{ id: 'assignment-1', status: 'INACTIVE' }],
    })).toContain('missing or are not Active');
  });

  it('allows historical inactive assignments outside the published selection', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      assignments: [
        ...base.assignments,
        { id: 'historical-assignment', status: 'INACTIVE' },
      ],
    })).toBeNull();
  });

  it('rejects a missing schema identity in both the publish and readback responses', () => {
    expect(productTypePublicationVerificationError({
      ...base,
      expectedSchemaId: '',
      productType: { ...base.productType, currentSchemaVersionId: '' },
    })).toContain('does not reference');
  });
});
