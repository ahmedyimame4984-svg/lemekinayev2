export interface AttributeMasterInstallResult {
  attributeGroups: number;
  unitDimensions: number;
  attributeUnits: number;
  optionSets: number;
  optionValues: number;
  attributes: number;
  attributeAliases: number;
  allowedValues: number;
}

export interface MasterReferenceInstallResult {
  attributes: number;
  allowedValues: number;
  rootCategories: number;
  subcategories: number;
  categories: number;
  parentProductTypes: number;
  childProductTypes: number;
  productTypes: number;
  attributeAssignments: number;
  publishedSchemas: number;
  vehicleMakes: number;
  vehicleModels: number;
  vehicleDerivatives: number;
  vehicleGenerations: number;
  vehicleTrims: number;
  vehicleConfigurations: number;
}

export interface MasterReferenceStatusCount {
  actual: number;
  expected: number | null;
}

export interface MasterReferenceStatus {
  /** Canonical Attribute baseline readiness, not Vehicle quality certification. */
  ready: boolean;
  attributeLibraryReady: boolean;
  vehicleLibraryState: 'EMPTY' | 'MASTERS_ONLY' | 'CONFIGURATIONS_PRESENT';
  catalogManagedByAdmin: boolean;
  replacementInProgress: boolean;
  counts: {
    attributeGroups: MasterReferenceStatusCount;
    unitDimensions: MasterReferenceStatusCount;
    attributeUnits: MasterReferenceStatusCount;
    optionSets: MasterReferenceStatusCount;
    optionValues: MasterReferenceStatusCount;
    attributes: MasterReferenceStatusCount;
    attributeAliases: MasterReferenceStatusCount;
    allowedValues: MasterReferenceStatusCount;
    rootCategories: MasterReferenceStatusCount;
    subcategories: MasterReferenceStatusCount;
    categories: MasterReferenceStatusCount;
    parentProductTypes: MasterReferenceStatusCount;
    childProductTypes: MasterReferenceStatusCount;
    productTypes: MasterReferenceStatusCount;
    vehicleMakes: MasterReferenceStatusCount;
    vehicleModels: MasterReferenceStatusCount;
    vehicleDerivatives: MasterReferenceStatusCount;
    vehicleGenerations: MasterReferenceStatusCount;
    vehicleTrims: MasterReferenceStatusCount;
    vehicleEngines: MasterReferenceStatusCount;
    vehicleTransmissions: MasterReferenceStatusCount;
    vehicleBodyTypes: MasterReferenceStatusCount;
    vehicleMarkets: MasterReferenceStatusCount;
    vehicleConfigurations: MasterReferenceStatusCount;
  };
  blockers: {
    products: number;
    sellerListings: number;
    vehicleProfiles: number;
    vehicleCompatibilities: number;
  };
}
