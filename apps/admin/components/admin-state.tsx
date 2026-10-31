import type { ReactNode } from 'react';

export function AdminLoadingState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? 'catalog-state catalog-state--compact' : 'catalog-state'}
      role="status"
      aria-live="polite"
    >
      <span className="spinner spinner--dark" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  actions,
  compact = false,
  headingLevel = 2,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <div
      className={compact ? 'catalog-empty catalog-empty--compact' : 'catalog-empty'}
    >
      <Heading>{title}</Heading>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="catalog-empty__actions">{actions}</div> : null}
    </div>
  );
}
