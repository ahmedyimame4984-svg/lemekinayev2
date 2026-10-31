'use client';

export function AdminFilterResetButton({
  active,
  onReset,
}: {
  active: boolean;
  onReset: () => void;
}) {
  if (!active) return null;

  return (
    <button
      className="button button--quiet"
      type="button"
      onClick={onReset}
    >
      Clear filters
    </button>
  );
}
