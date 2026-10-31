import type {
  CanonicalCriteriaLibraryInstallResult,
  CanonicalCriteriaLibraryStatus,
} from './catalog-attribute-contracts';
import type {
  CanonicalProductCatalogInstallResult,
  CanonicalProductCatalogStatus,
} from './catalog-contracts';

export interface AttributeMasterInstallCounts {
  attributeGroups: number;
  unitDimensions: number;
  attributeUnits: number;
  optionSets: number;
  optionValues: number;
  attributes: number;
  attributeAliases: number;
  allowedValues: number;
}

export interface CanonicalAttributeMasterStatus {
  valid: boolean;
  validationErrors: string[];
  ready: boolean;
  expected: AttributeMasterInstallCounts;
}

export interface ProfessionalCatalogBaselineStatus {
  ready: boolean;
  reconciliationInProgress: boolean;
  attributes: CanonicalAttributeMasterStatus;
  catalog: CanonicalProductCatalogStatus;
  criteria: CanonicalCriteriaLibraryStatus;
}

export interface ProfessionalCatalogBaselineReconcileResult
  extends ProfessionalCatalogBaselineStatus {
  reconciled: {
    attributes: AttributeMasterInstallCounts;
    catalog: CanonicalProductCatalogInstallResult;
    criteria: CanonicalCriteriaLibraryInstallResult;
  };
}
