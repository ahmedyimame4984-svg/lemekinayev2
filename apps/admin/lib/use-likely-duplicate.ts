'use client';

import { useEffect, useState } from 'react';

export interface LikelyDuplicateRecord {
  id: string;
  name?: string;
  label?: string;
  transmissionType?: string;
  code?: string | null;
}

export interface LikelyDuplicateMatch {
  record: LikelyDuplicateRecord;
  reason: 'name' | 'code';
}

export function useLikelyDuplicate({
  enabled = true,
  name,
  code,
  searchUrl = '',
  records,
  excludeId,
}: {
  enabled?: boolean;
  name: string;
  code?: string;
  searchUrl?: string;
  records?: LikelyDuplicateRecord[];
  excludeId?: string;
}): {
  match: LikelyDuplicateMatch | null;
  checking: boolean;
} {
  const [match, setMatch] = useState<LikelyDuplicateMatch | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const trimmedName = name.trim();
    const trimmedCode = code?.trim() ?? '';
    const queryValue = trimmedName || trimmedCode;
    if (
      !enabled ||
      queryValue.length < 2 ||
      (!searchUrl && records === undefined)
    ) {
      setMatch(null);
      setChecking(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        let candidates = records ?? [];
        if (searchUrl) {
          const queryTerms = [...new Set([trimmedName, trimmedCode])]
            .map((value) => value.trim())
            .filter((value) => value.length >= 2);
          const resultSets = await Promise.all(
            queryTerms.map(async (term) => {
              const separator = searchUrl.includes('?') ? '&' : '?';
              const response = await fetch(
                `${searchUrl}${separator}search=${encodeURIComponent(term)}&page=1&pageSize=100`,
                {
                  credentials: 'same-origin',
                  cache: 'no-store',
                },
              );
              if (!response.ok) throw new Error('Duplicate preflight failed');

              const body = (await response.json()) as
                | { items?: LikelyDuplicateRecord[] }
                | LikelyDuplicateRecord[];
              return Array.isArray(body) ? body : (body.items ?? []);
            }),
          );
          candidates = [
            ...new Map(
              resultSets.flat().map((record) => [record.id, record]),
            ).values(),
          ];
        }

        if (!active) return;
        setMatch(
          findLikelyDuplicate(
            candidates,
            trimmedName,
            trimmedCode,
            excludeId,
          ),
        );
      } catch {
        if (active) setMatch(null);
      } finally {
        if (active) setChecking(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [code, enabled, excludeId, name, records, searchUrl]);

  return { match, checking };
}

export function findLikelyDuplicate(
  records: LikelyDuplicateRecord[],
  name: string,
  code = '',
  excludeId?: string,
): LikelyDuplicateMatch | null {
  const normalizedName = normalizeIdentity(name);
  const normalizedCode = normalizeIdentity(code);
  const eligible = records.filter((record) => record.id !== excludeId);

  if (normalizedName.length > 0) {
    const nameMatch = eligible.find(
      (record) =>
        normalizeIdentity(
          record.name ?? record.label ?? record.transmissionType ?? '',
        ) === normalizedName,
    );
    if (nameMatch) return { record: nameMatch, reason: 'name' };
  }

  if (normalizedCode.length > 0) {
    const codeMatch = eligible.find(
      (record) => normalizeIdentity(record.code ?? '') === normalizedCode,
    );
    if (codeMatch) return { record: codeMatch, reason: 'code' };
  }

  return null;
}

export function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
