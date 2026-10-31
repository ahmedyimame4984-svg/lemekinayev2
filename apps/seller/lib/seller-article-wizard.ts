/** Article Drafts are persisted before fitment evidence is collected. */
export const articleWizardSteps = [
  { key: 'CLASSIFICATION', label: 'Classification' },
  { key: 'IDENTITY', label: 'Identity' },
  { key: 'ATTRIBUTES', label: 'Technical attributes' },
  { key: 'FITMENT', label: 'Fitment & evidence' },
  { key: 'REVIEW', label: 'Review' },
] as const;

export type ArticleWizardStep = (typeof articleWizardSteps)[number]['key'];

export interface ArticleWizardProgress {
  hasProductType: boolean;
  identityChecked: boolean;
  hasArticle: boolean;
  editableDraft: boolean;
}

export function canNavigateArticleStep(
  target: ArticleWizardStep,
  progress: ArticleWizardProgress,
): boolean {
  if (progress.hasArticle) {
    return target === 'REVIEW' || (progress.editableDraft && (target === 'FITMENT' || target === 'ATTRIBUTES'));
  }

  switch (target) {
    case 'CLASSIFICATION':
      return true;
    case 'IDENTITY':
      return progress.hasProductType;
    case 'ATTRIBUTES':
      return progress.hasProductType && progress.identityChecked;
    case 'FITMENT':
    case 'REVIEW':
      return false;
  }
}

/** A vehicle fitment is not a prerequisite for saving a canonical Article Draft. */
export function initialEvidenceStep(fitmentRequirement: string | undefined): {
  step: ArticleWizardStep;
  section: 'FITMENT' | 'IDENTIFIERS';
} {
  return {
    step: 'FITMENT',
    section: fitmentRequirement === 'NOT_APPLICABLE' ? 'IDENTIFIERS' : 'FITMENT',
  };
}
