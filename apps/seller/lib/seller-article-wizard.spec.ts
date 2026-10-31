import { describe, expect, it } from 'vitest';
import { articleWizardSteps, canNavigateArticleStep, initialEvidenceStep } from './seller-article-wizard';

describe('Product Article wizard navigation', () => {
  it('requires catalog classification before identity, and an identity check before attributes', () => {
    const start = { hasProductType: false, identityChecked: false, hasArticle: false, editableDraft: false };
    expect(articleWizardSteps).toHaveLength(5);
    expect(canNavigateArticleStep('CLASSIFICATION', start)).toBe(true);
    expect(canNavigateArticleStep('IDENTITY', start)).toBe(false);
    expect(canNavigateArticleStep('ATTRIBUTES', start)).toBe(false);
    expect(canNavigateArticleStep('FITMENT', start)).toBe(false);
    expect(canNavigateArticleStep('IDENTITY', { ...start, hasProductType: true })).toBe(true);
    expect(canNavigateArticleStep('ATTRIBUTES', { ...start, hasProductType: true, identityChecked: true })).toBe(true);
  });

  it('allows an Article Draft to progress to evidence and review before adding vehicles', () => {
    const saved = { hasProductType: true, identityChecked: true, hasArticle: true, editableDraft: true };
    expect(canNavigateArticleStep('FITMENT', saved)).toBe(true);
    expect(canNavigateArticleStep('REVIEW', saved)).toBe(true);
    expect(canNavigateArticleStep('ATTRIBUTES', saved)).toBe(true);
    expect(initialEvidenceStep('REQUIRED')).toEqual({ step: 'FITMENT', section: 'FITMENT' });
    expect(initialEvidenceStep('NOT_APPLICABLE')).toEqual({ step: 'FITMENT', section: 'IDENTIFIERS' });
  });

  it('does not allow editing existing or submitted canonical Articles through the wizard', () => {
    const reviewed = { hasProductType: true, identityChecked: true, hasArticle: true, editableDraft: false };
    expect(canNavigateArticleStep('FITMENT', reviewed)).toBe(false);
    expect(canNavigateArticleStep('REVIEW', reviewed)).toBe(true);
    expect(canNavigateArticleStep('IDENTITY', reviewed)).toBe(false);
  });
});
