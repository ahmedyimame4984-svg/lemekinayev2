'use client';

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ADMIN_FORM_DIRTY_EVENT } from '@/lib/use-admin-inline-form-keyboard';

export type AdminComboboxOption = {
  id: string;
  label: string;
  meta?: string;
  keywords?: string[];
};

const MAX_VISIBLE_OPTIONS = 30;

export function AdminSearchableCombobox({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage = 'No matches found.',
  disabled = false,
  onChange,
  onSearchChange,
}: {
  id: string;
  value: string;
  options: AdminComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.id === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const searchable = [
        option.label,
        option.meta ?? '',
        ...(option.keywords ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, options]);

  const visibleOptions = filteredOptions.slice(0, MAX_VISIBLE_OPTIONS);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
        setActiveIndex(0);
        onSearchChange?.('');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onSearchChange, open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function close(restoreFocus = false) {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    onSearchChange?.('');
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function choose(option: AdminComboboxOption) {
    const changed = option.id !== value;
    onChange(option.id);
    if (changed) {
      rootRef.current?.dispatchEvent(
        new CustomEvent(ADMIN_FORM_DIRTY_EVENT, { bubbles: true }),
      );
    }
    close(true);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }

    if (visibleOptions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, visibleOptions.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) choose(option);
    }
  }

  return (
    <div className="admin-combobox" ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        className="admin-combobox__trigger"
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            close(true);
          }
        }}
      >
        <span className={selected ? undefined : 'is-placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <span className="admin-combobox__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="admin-combobox__panel">
          <div className="admin-combobox__search">
            <input
              ref={searchRef}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              value={query}
              placeholder={searchPlaceholder ?? `Search ${placeholder.toLowerCase()}…`}
              aria-label={searchPlaceholder ?? `Search ${placeholder}`}
              aria-controls={`${id}-listbox`}
              aria-activedescendant={
                visibleOptions[activeIndex]
                  ? `${id}-option-${visibleOptions[activeIndex].id}`
                  : undefined
              }
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                onSearchChange?.(nextQuery);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          <div
            id={`${id}-listbox`}
            className="admin-combobox__options"
            role="listbox"
            aria-label={placeholder}
          >
            {visibleOptions.map((option, index) => (
              <button
                id={`${id}-option-${option.id}`}
                className={[
                  'admin-combobox__option',
                  option.id === value ? 'is-selected' : '',
                  index === activeIndex ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                role="option"
                aria-selected={option.id === value}
                key={option.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.meta ? <small>{option.meta}</small> : null}
                </span>
                {option.id === value ? <b aria-hidden="true">✓</b> : null}
              </button>
            ))}

            {visibleOptions.length === 0 ? (
              <div className="admin-combobox__empty">{emptyMessage}</div>
            ) : null}
          </div>

          {filteredOptions.length > MAX_VISIBLE_OPTIONS ? (
            <div className="admin-combobox__hint">
              Showing the first {MAX_VISIBLE_OPTIONS} matches. Keep typing to narrow
              the list.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
