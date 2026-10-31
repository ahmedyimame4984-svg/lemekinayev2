import type { SellerSchemaAttribute } from './seller-contracts';

/** Product images and documents are not canonical Seller Article fields. */
export function isArticleMediaAttribute(attribute: SellerSchemaAttribute): boolean {
  return ['IMAGE', 'MULTI_IMAGE', 'DOCUMENT', 'MULTI_DOCUMENT', 'FILE', 'MULTI_FILE']
    .includes(attribute.dataType ?? '');
}

/** Client-side Draft affordance; server validation remains authoritative. */
export interface SellerArticleDraftSaveState {
  hasType: boolean;
  hasSchema: boolean;
  identityChecked: boolean;
  missingRequired: number;
  blockedRequired: number;
  busy: boolean;
}

export function canSaveArticleDraft(state: SellerArticleDraftSaveState): boolean {
  return state.hasType && state.hasSchema && state.identityChecked &&
    state.missingRequired === 0 && state.blockedRequired === 0 && !state.busy;
}
