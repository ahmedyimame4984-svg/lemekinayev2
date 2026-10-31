export interface GlobalSearchArticleResult {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  productTypeId: string;
  productTypeName: string;
  primaryManufacturerPartNumber: string | null;
  score: number;
  matchedBy: string[];
}

export interface GlobalSearchBrandResult {
  id: string;
  code: string;
  name: string;
  score: number;
  matchedBy: string[];
}

export interface GlobalSearchProductTypeResult {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  partGroupName: string | null;
  score: number;
  matchedBy: string[];
}

export interface GlobalSearchVehicleResult {
  vehicleConfigurationId: string;
  make: string;
  model: string;
  generation: string | null;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  modelYear: number | null;
  score: number;
  matchedBy: string[];
}

export interface GlobalCatalogSearchResult {
  query: string;
  normalizedQuery: string;
  articles: GlobalSearchArticleResult[];
  brands: GlobalSearchBrandResult[];
  productTypes: GlobalSearchProductTypeResult[];
  vehicles: GlobalSearchVehicleResult[];
}
