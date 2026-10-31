import { describe, expect, it } from 'vitest';
import { canSaveArticleDraft, isArticleMediaAttribute } from './seller-article-form';

const ready = {
  hasType: true, hasSchema: true, identityChecked: true,
  missingRequired: 0, blockedRequired: 0, busy: false,
};

describe('single-page Seller Article Draft', () => {
  it('keeps document and image schema controls out of canonical Article entry', () => {
    expect(isArticleMediaAttribute({ dataType: 'MULTI_IMAGE' })).toBe(true);
    expect(isArticleMediaAttribute({ dataType: 'DOCUMENT' })).toBe(true);
    expect(isArticleMediaAttribute({ dataType: 'TEXT' })).toBe(false);
    expect(isArticleMediaAttribute({ dataType: 'SELECT' })).toBe(false);
  });

  it('allows saving an identity-checked Article with all required schema fields', () => {
    expect(canSaveArticleDraft(ready)).toBe(true);
  });
  it('requires Product Type, published schema and an identity check', () => {
    expect(canSaveArticleDraft({ ...ready, hasType: false })).toBe(false);
    expect(canSaveArticleDraft({ ...ready, hasSchema: false })).toBe(false);
    expect(canSaveArticleDraft({ ...ready, identityChecked: false })).toBe(false);
  });
  it('blocks missing, noneditable and in-flight values', () => {
    expect(canSaveArticleDraft({ ...ready, missingRequired: 1 })).toBe(false);
    expect(canSaveArticleDraft({ ...ready, blockedRequired: 1 })).toBe(false);
    expect(canSaveArticleDraft({ ...ready, busy: true })).toBe(false);
  });
});
