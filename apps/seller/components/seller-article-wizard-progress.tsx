'use client';

import {
  articleWizardSteps,
  type ArticleWizardStep,
  type ArticleWizardProgress,
  canNavigateArticleStep,
} from '@/lib/seller-article-wizard';

export function SellerArticleWizardProgress({
  active,
  progress,
  onNavigate,
}: {
  active: ArticleWizardStep;
  progress: ArticleWizardProgress;
  onNavigate: (step: ArticleWizardStep) => void;
}) {
  return (
    <nav aria-label="Product Article creation steps" className="rounded-xl border border-slate-200 bg-white p-3">
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {articleWizardSteps.map((step, index) => {
          const enabled = canNavigateArticleStep(step.key, progress);
          const current = active === step.key;
          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={!enabled}
                aria-current={current ? 'step' : undefined}
                onClick={() => onNavigate(step.key)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-3 text-left text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] ${current ? 'border-[#a71920] bg-red-50 text-[#a71920]' : 'border-slate-200 text-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800">{index + 1}</span>
                <span>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
