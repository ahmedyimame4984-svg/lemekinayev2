import { describe, expect, it } from 'vitest';
import {
  classifyVehicleReconstructionRecord,
  type VehicleAuditInput,
} from './vehicle-reconstruction-audit.js';
const input = (patch: Partial<VehicleAuditInput> = {}): VehicleAuditInput => ({
  entityType: 'VehicleConfiguration',
  id: 'id',
  code: 'CODE',
  status: 'ACTIVE',
  version: 1,
  steeringSide: 'LHD',
  hasVerifiedProvenance: false,
  issues: [],
  references: {},
  canonicalMatch: 'NOT_COMPARED',
  ...patch,
});
describe('vehicle reconstruction recommendations', () => {
  it('does not trust legacy-code matches or blindly recommend KEEP', () => {
    expect(
      classifyVehicleReconstructionRecord(input({ legacyLibraryMatch: true })),
    ).toMatchObject({
      disposition: 'CORRECT',
      mutationAuthorized: false,
      requiresHumanReview: true,
    });
  });
  it.each([
    { steeringSide: 'RHD' },
    { marketCode: 'SOUTHERN_AFRICA' },
    { code: 'DEMO_CONFIG' },
  ])(
    'archives excluded configured identities including unused drafts',
    (patch) => {
      expect(
        classifyVehicleReconstructionRecord(
          input({ ...patch, status: 'DRAFT' }),
        ),
      ).toMatchObject({ disposition: 'ARCHIVE', preserveIdentity: true });
    },
  );
  it('only proposes DELETE for a disposable supporting draft', () => {
    const draft = input({
      entityType: 'VehicleEngine',
      code: 'DEMO_ENGINE',
      status: 'DRAFT',
    });
    expect(classifyVehicleReconstructionRecord(draft).disposition).toBe(
      'DELETE',
    );
    expect(
      classifyVehicleReconstructionRecord({
        ...draft,
        references: { auditHistory: 1 },
      }).disposition,
    ).toBe('ARCHIVE');
    expect(
      classifyVehicleReconstructionRecord({ ...draft, version: 2 }).disposition,
    ).toBe('ARCHIVE');
  });
  it('requires verified canonical comparison before KEEP/MERGE/REPLACE', () => {
    expect(
      classifyVehicleReconstructionRecord(input({ duplicateOf: 'target' }))
        .disposition,
    ).toBe('CORRECT');
    expect(
      classifyVehicleReconstructionRecord(
        input({
          canonicalMatch: 'EXACT_VERIFIED',
          hasVerifiedProvenance: true,
        }),
      ).disposition,
    ).toBe('KEEP');
    expect(
      classifyVehicleReconstructionRecord(
        input({ canonicalMatch: 'EXACT_VERIFIED', duplicateOf: 'target' }),
      ).disposition,
    ).toBe('MERGE');
    expect(
      classifyVehicleReconstructionRecord(
        input({
          canonicalMatch: 'DIFFERENT_VERIFIED',
          references: { profiles: 1 },
        }),
      ),
    ).toMatchObject({ disposition: 'REPLACE', preserveIdentity: true });
  });
});
