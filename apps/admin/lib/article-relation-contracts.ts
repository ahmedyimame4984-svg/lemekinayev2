import type { MasterDataStatus } from './catalog-contracts';

export type ArticleRelationType =
  | 'SUPERSEDES'
  | 'INTERCHANGEABLE'
  | 'ACCESSORY'
  | 'REPAIR_KIT'
  | 'CONTAINS'
  | 'CONTAINED_IN'
  | 'PAIRED_WITH'
  | 'RELATED';

export interface ArticleRelationRecord {
  id: string;
  sourceArticleId: string;
  targetArticleId: string;
  type: ArticleRelationType;
  note: string | null;
  componentQuantity: number | null;
  componentRole: string | null;
  componentOrder: number | null;
  status: MasterDataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
