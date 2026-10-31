'use client';

import { type ReactNode, useEffect, useState } from 'react';

export type AdminPageSize = 25 | 50 | 100;

const PAGE_SIZE_OPTIONS: AdminPageSize[] = [25, 50, 100];

export function normalizeAdminPageSize(
  value: unknown,
  fallback: AdminPageSize = 50,
): AdminPageSize {
  return value === 25 || value === 50 || value === 100 ? value : fallback;
}

function joinClassNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export function AdminLibraryToolbar({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={joinClassNames(
        'catalog-toolbar',
        'catalog-toolbar--filters',
        'admin-library-shell__toolbar',
        className,
      )}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function AdminLibraryCount({
  count,
  singular,
  plural,
  prefix,
}: {
  count: number;
  singular: string;
  plural?: string;
  prefix?: string;
}) {
  return (
    <span className="catalog-count admin-library-shell__count">
      {prefix ? `${prefix} ` : ''}
      {count} {count === 1 ? singular : (plural ?? `${singular}s`)}
    </span>
  );
}

export function AdminLibraryPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: {
  page: number;
  pageCount: number;
  pageSize: AdminPageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: AdminPageSize) => void;
  disabled?: boolean;
}) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(pageCount === 0 ? 0 : page));
  }, [page, pageCount]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  function commitPage() {
    if (pageCount === 0) {
      setPageInput('0');
      return;
    }
    const parsed = Number(pageInput);
    const nextPage = Number.isInteger(parsed)
      ? Math.min(pageCount, Math.max(1, parsed))
      : page;
    setPageInput(String(nextPage));
    if (nextPage !== page) onPageChange(nextPage);
  }

  return (
    <nav
      className="catalog-pagination admin-library-shell__pagination"
      aria-label="Library pages"
    >
      <span className="admin-library-shell__range">
        {rangeStart}–{rangeEnd} of {total}
      </span>

      <div className="admin-library-shell__pagination-controls">
        <button
          className="button button--quiet"
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(1)}
        >
          First
        </button>
        <button
          className="button button--quiet"
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>

        <label className="admin-library-shell__page-jump">
          <span>Page</span>
          <input
            type="number"
            min={pageCount === 0 ? 0 : 1}
            max={Math.max(1, pageCount)}
            inputMode="numeric"
            value={pageInput}
            disabled={disabled || pageCount === 0}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={commitPage}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitPage();
                event.currentTarget.blur();
              }
            }}
            aria-label="Go to page"
          />
          <span>of {pageCount}</span>
        </label>

        <button
          className="button button--quiet"
          type="button"
          disabled={disabled || pageCount === 0 || page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Next
        </button>
        <button
          className="button button--quiet"
          type="button"
          disabled={disabled || pageCount === 0 || page >= pageCount}
          onClick={() => onPageChange(pageCount)}
        >
          Last
        </button>
      </div>

      <label className="admin-library-shell__page-size">
        <span>Rows</span>
        <select
          value={pageSize}
          disabled={disabled}
          onChange={(event) =>
            onPageSizeChange(Number(event.target.value) as AdminPageSize)
          }
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
