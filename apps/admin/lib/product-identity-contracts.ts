import type { MasterDataStatus } from './catalog-contracts';

export type PartNumberType =
  | 'OE'
  | 'MANUFACTURER'
  | 'AFTERMARKET'
  | 'SUPPLIER'
  | 'CROSS_REFERENCE'
  | 'OTHER';

export type ArticleIdentifierType =
  | 'GTIN_8'
  | 'GTIN_12'
  | 'GTIN_13'
  | 'GTIN_14'
  | 'TRADE_NUMBER';

export interface ArticleIdentifierRecord {
  id: string;
  productId: string;
  type: ArticleIdentifierType;
  value: string;
  rawValue: string | null;
  normalizedValue: string;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandRecord {
  id: string;
  code: string;
  name: string;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandPage {
  items: BrandRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateBrandInput {
  code: string;
  name: string;
  status?: MasterDataStatus;
}

export interface UpdateBrandInput {
  version: number;
  name?: string;
  status?: MasterDataStatus;
}

export interface BulkUpdateBrandStatusInput {
  items: Array<{ id: string; version: number }>;
  status: MasterDataStatus;
}

export interface BrandBulkStatusResult {
  items: BrandRecord[];
  updated: number;
}

export interface PartNumberRecord {
  id: string;
  productId: string;
  issuerBrandId: string | null;
  partNumber: string;
  rawPartNumber: string | null;
  normalizedPartNumber: string;
  type: PartNumberType;
  isPrimary: boolean;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartNumberInput {
  issuerBrandId?: string;
  partNumber: string;
  rawPartNumber?: string;
  type: PartNumberType;
  isPrimary?: boolean;
  status?: MasterDataStatus;
}

export interface UpdatePartNumberInput {
  version: number;
  issuerBrandId?: string | null;
  partNumber?: string;
  rawPartNumber?: string;
  type?: PartNumberType;
  isPrimary?: boolean;
  status?: MasterDataStatus;
}
