import type { LikelyDuplicateMatch } from '@/lib/use-likely-duplicate';

export function LikelyDuplicateWarning({
  match,
  checking = false,
}: {
  match: LikelyDuplicateMatch | null;
  checking?: boolean;
}) {
  if (checking && !match) {
    return (
      <small className="duplicate-preflight duplicate-preflight--checking">
        Checking for existing master records…
      </small>
    );
  }

  if (!match) return null;

  const label =
    match.record.name ??
    match.record.label ??
    match.record.transmissionType ??
    match.record.code ??
    'Existing record';

  return (
    <div className="duplicate-preflight" role="status">
      <strong>Possible duplicate</strong>
      <span>
        “{label}”
        {match.record.code ? ` · ${match.record.code}` : ''} already looks
        like this master record. Review the existing record before creating
        another one.
      </span>
    </div>
  );
}
