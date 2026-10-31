'use client';

import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';

export function AdminSavedViewsToolbar({
  idPrefix,
  savedViews,
  loading,
  saving,
  selectedId,
  name,
  namePlaceholder,
  error,
  onSelect,
  onNameChange,
  onSaveAsNew,
  onUpdate,
  onDelete,
}: {
  idPrefix: string;
  savedViews: AdminSavedViewRecord[];
  loading: boolean;
  saving: boolean;
  selectedId: string;
  name: string;
  namePlaceholder: string;
  error: string;
  onSelect: (view: AdminSavedViewRecord | null) => void;
  onNameChange: (value: string) => void;
  onSaveAsNew: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="catalog-toolbar catalog-toolbar--filters">
        <div className="catalog-filter">
          <label htmlFor={`${idPrefix}-saved-view`}>Saved view</label>
          <select
            id={`${idPrefix}-saved-view`}
            value={selectedId}
            disabled={loading || saving}
            onChange={(event) => {
              const view =
                savedViews.find((item) => item.id === event.target.value) ??
                null;
              onSelect(view);
            }}
          >
            <option value="">
              {loading ? 'Loading views…' : 'Choose saved view'}
            </option>
            {savedViews.map((view) => (
              <option value={view.id} key={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor={`${idPrefix}-view-name`}>View name (required)</label>
          <input
            id={`${idPrefix}-view-name`}
            value={name}
            maxLength={100}
            placeholder={`Enter a name, e.g. ${namePlaceholder.replace(/^e\.g\.\s*/iu, '')}`}
            disabled={saving}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>

        <button
          className="button button--secondary"
          type="button"
          disabled={saving}
          onClick={onSaveAsNew}
        >
          {saving ? 'Saving…' : 'Save as new'}
        </button>

        <button
          className="button button--quiet"
          type="button"
          disabled={saving || !selectedId}
          onClick={onUpdate}
        >
          Update selected
        </button>

        <button
          className="button button--quiet"
          type="button"
          disabled={saving || !selectedId}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}
