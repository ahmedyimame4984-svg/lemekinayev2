import type {
  BulkUpdateProductTypeAttributeAssignmentsInput,
  ProductTypeAttributeAssignmentRecord,
} from './catalog-attribute-contracts';

export type AttributeSettingPatch = Partial<
  Pick<
    ProductTypeAttributeAssignmentRecord,
    'requirement' | 'displayMode' | 'displayOrder' |
    'searchable' | 'filterable' | 'comparable' |
    'variantDefining' | 'marketplaceVisible' | 'sellerEditable'
  >
>;

export type AttributeSettingDrafts = Record<string, AttributeSettingPatch>;

// Match BulkUpdateProductTypeAttributeAssignmentsDto's bounded atomic request.
export const MAX_ATTRIBUTE_SETTINGS_PER_SAVE = 200;
export const ATTRIBUTE_SETTINGS_LIMIT_MESSAGE =
  `You can edit up to ${MAX_ATTRIBUTE_SETTINGS_PER_SAVE} Attributes per save. ` +
  'Save your pending changes first, or select fewer Attributes. Your existing edits are retained.';

export interface AttributeSettingsDraftState {
  drafts: AttributeSettingDrafts;
  error: string;
}

/** Reject an oversized staging action as a whole, without truncating a selection. */
export function stageAttributeSettingsBatch(
  current: AttributeSettingDrafts,
  saved: ProductTypeAttributeAssignmentRecord[],
  changes: AttributeSettingPatch,
): AttributeSettingsDraftState {
  const next = saved.reduce(
    (drafts, assignment) => stageAttributeSettings(drafts, assignment, changes),
    current,
  );
  return Object.keys(next).length > MAX_ATTRIBUTE_SETTINGS_PER_SAVE
    ? { drafts: current, error: ATTRIBUTE_SETTINGS_LIMIT_MESSAGE }
    : { drafts: next, error: '' };
}

export function stageAttributeSettings(
  current: AttributeSettingDrafts,
  saved: ProductTypeAttributeAssignmentRecord,
  changes: AttributeSettingPatch,
): AttributeSettingDrafts {
  const nextSettings: AttributeSettingPatch = { ...current[saved.id], ...changes };
  for (const key of Object.keys(nextSettings) as (keyof AttributeSettingPatch)[]) {
    if (nextSettings[key] === saved[key]) delete nextSettings[key];
  }
  const next = { ...current };
  if (Object.keys(nextSettings).length === 0) delete next[saved.id];
  else next[saved.id] = nextSettings;
  return next;
}

/**
 * An HTTP-success response is not proof that every staged Attribute was saved.
 * Keep the drafts intact until the returned IDs, versions and settings match.
 */
export function verifySavedAttributeSettings(
  requested: BulkUpdateProductTypeAttributeAssignmentsInput['assignments'],
  response: unknown,
  expectedProductTypeId: string,
): ProductTypeAttributeAssignmentRecord[] {
  const verificationError =
    'The Save All request returned incomplete or inconsistent Attribute settings. ' +
    'Your edits are retained; reload the Product Type to verify what was saved.';
  if (!Array.isArray(response) || response.length !== requested.length) {
    throw new Error(verificationError);
  }

  const expected = new Map(requested.map((item) => [item.id, item]));
  if (expected.size !== requested.length) throw new Error(verificationError);

  const seen = new Set<string>();
  const settingKeys: (keyof AttributeSettingPatch)[] = [
    'requirement',
    'displayMode',
    'displayOrder',
    'searchable',
    'filterable',
    'comparable',
    'variantDefining',
    'marketplaceVisible',
    'sellerEditable',
  ];

  for (const item of response as unknown[]) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(verificationError);
    }
    const saved = item as ProductTypeAttributeAssignmentRecord;
    const original = expected.get(saved.id);
    if (
      !original ||
      seen.has(saved.id) ||
      saved.productTypeId !== expectedProductTypeId ||
      !Number.isInteger(saved.version) ||
      saved.version <= original.version ||
      settingKeys.some(
        (key) => original[key] !== undefined && saved[key] !== original[key],
      )
    ) {
      throw new Error(verificationError);
    }
    seen.add(saved.id);
  }
  return response as ProductTypeAttributeAssignmentRecord[];
}
