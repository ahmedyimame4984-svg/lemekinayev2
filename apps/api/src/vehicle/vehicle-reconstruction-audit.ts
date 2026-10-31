import { VEHICLE_DATA_STANDARD } from './vehicle-reconstruction-standard.js';

export type VehicleReconstructionDisposition =
  'KEEP' | 'CORRECT' | 'MERGE' | 'REPLACE' | 'ARCHIVE' | 'DELETE';
export interface VehicleAuditInput {
  entityType: string;
  id: string;
  code: string | null;
  status: string;
  version: number;
  steeringSide?: string | null;
  marketCode?: string | null;
  legacyLibraryMatch?: boolean;
  hasVerifiedProvenance: boolean;
  issues: string[];
  duplicateOf?: string;
  references: Record<string, number>;
  canonicalMatch: 'EXACT_VERIFIED' | 'DIFFERENT_VERIFIED' | 'NOT_COMPARED';
}

/** Recommendations only. A report never authorizes mutation or reference repointing. */
export function classifyVehicleReconstructionRecord(input: VehicleAuditInput) {
  const reasons = [...input.issues];
  const referenced = Object.values(input.references).some((count) => count > 0);
  const configuration = input.entityType === 'VehicleConfiguration';
  const disposable =
    !configuration &&
    !referenced &&
    input.status === 'DRAFT' &&
    input.version === 1;
  const demo = /(^DEMO_|\bDEMO\b)/i.test(input.code ?? '');
  const excluded =
    input.steeringSide === 'RHD' || input.marketCode === 'SOUTHERN_AFRICA';
  if (input.steeringSide === 'RHD')
    reasons.push('RHD is outside Ethiopia LHD production scope');
  if (input.marketCode === 'SOUTHERN_AFRICA')
    reasons.push(
      'Southern Africa-only applicability requires source-market re-evaluation',
    );
  if (demo) reasons.push('Development/demo code');
  if (input.legacyLibraryMatch)
    reasons.push('Matches retired Africa library; match is not verification');
  if (!input.hasVerifiedProvenance)
    reasons.push('Missing verified provenance; research required');
  let disposition: VehicleReconstructionDisposition;
  if ((demo || excluded) && disposable) disposition = 'DELETE';
  else if (demo || excluded || input.status === 'ARCHIVED')
    disposition = 'ARCHIVE';
  else if (
    input.duplicateOf &&
    input.canonicalMatch === 'EXACT_VERIFIED' &&
    input.issues.length === 0
  )
    disposition = 'MERGE';
  else if (input.canonicalMatch === 'DIFFERENT_VERIFIED')
    disposition = 'REPLACE';
  else if (
    input.canonicalMatch === 'EXACT_VERIFIED' &&
    input.hasVerifiedProvenance &&
    input.issues.length === 0
  )
    disposition = 'KEEP';
  else disposition = 'CORRECT';
  return {
    standard: VEHICLE_DATA_STANDARD,
    entityType: input.entityType,
    id: input.id,
    code: input.code,
    status: input.status,
    version: input.version,
    disposition,
    reasons: [...new Set(reasons)],
    references: input.references,
    preserveIdentity: configuration || referenced || !disposable,
    requiresHumanReview: true,
    mutationAuthorized: false,
    canonicalComparison: input.canonicalMatch,
  };
}
