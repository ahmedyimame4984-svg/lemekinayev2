import type { MasterDataStatus } from './catalog-contracts';

export type SupplierType =
  | 'MANUFACTURER'
  | 'AUTHORIZED_DISTRIBUTOR'
  | 'DISTRIBUTOR'
  | 'WHOLESALER'
  | 'EXPORTER'
  | 'TRADING_COMPANY'
  | 'OTHER';

export type SourcingIncoterm =
  | 'EXW'
  | 'FCA'
  | 'CPT'
  | 'CIP'
  | 'DAP'
  | 'DPU'
  | 'DDP'
  | 'FAS'
  | 'FOB'
  | 'CFR'
  | 'CIF';

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  supplierType: SupplierType;
  countryCode: string;
  contactEmail: string | null;
  website: string | null;
  notes: string | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPage {
  items: SupplierRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  supplierType: SupplierType;
  countryCode: string;
  contactEmail?: string;
  website?: string;
  notes?: string;
  status?: MasterDataStatus;
}

export interface UpdateSupplierInput {
  version: number;
  name?: string;
  supplierType?: SupplierType;
  countryCode?: string;
  contactEmail?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: MasterDataStatus;
}

export interface BulkUpdateSupplierStatusInput {
  items: Array<{ id: string; version: number }>;
  status: MasterDataStatus;
}

export interface SupplierBulkStatusResult {
  items: SupplierRecord[];
  updated: number;
}

export interface SupplierOfferRecord {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku: string | null;
  unitCost: number;
  currency: string;
  minOrderQuantity: number;
  orderMultiple: number;
  availableQuantity: number | null;
  leadTimeDaysMin: number | null;
  leadTimeDaysMax: number | null;
  incoterm: SourcingIncoterm | null;
  originCountryCode: string | null;
  validFrom: string | null;
  validTo: string | null;
  notes: string | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierOfferInput {
  supplierId: string;
  productId: string;
  supplierSku?: string;
  unitCost: number;
  currency: string;
  minOrderQuantity?: number;
  orderMultiple?: number;
  availableQuantity?: number | null;
  leadTimeDaysMin?: number | null;
  leadTimeDaysMax?: number | null;
  incoterm?: SourcingIncoterm | null;
  originCountryCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  notes?: string | null;
  status?: MasterDataStatus;
}

export interface UpdateSupplierOfferInput {
  version: number;
  supplierId?: string;
  supplierSku?: string | null;
  unitCost?: number;
  currency?: string;
  minOrderQuantity?: number;
  orderMultiple?: number;
  availableQuantity?: number | null;
  leadTimeDaysMin?: number | null;
  leadTimeDaysMax?: number | null;
  incoterm?: SourcingIncoterm | null;
  originCountryCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  notes?: string | null;
  status?: MasterDataStatus;
}
