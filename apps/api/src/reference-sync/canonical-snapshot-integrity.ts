import { createHash } from 'node:crypto';

/**
 * Published v2 snapshot content chain (SHA-256).
 *
 * The chain uses canonical JSON key ordering, a domain-separated initial
 * digest and explicit [prior, entity type, record] frames. Entity streams
 * and records must be processed in the canonical source order. This protects
 * against omissions/substitution even when the total record count matches.
 *
 * Integrity is authenticated by the B2B HTTPS channel, not a cryptographic
 * source signature. Do not present it as a signed snapshot.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('Undefined canonical snapshot value');
    return serialized;
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map(key =>
    JSON.stringify(key) + ':' + canonicalJson(record[key]),
  ).join(',') + '}';
}

export const INITIAL_SNAPSHOT_DIGEST = createHash('sha256')
  .update('ATD-PUBLISHING-V2-FROZEN-CONTENT-SHA256-V1\n', 'utf8')
  .digest('hex');

export function extendSnapshotDigest(
  previous: string, entityType: string, record: unknown,
): string {
  if (!/^[a-f0-9]{64}$/u.test(previous) || !entityType) {
    throw new Error('Invalid canonical content digest frame');
  }
  return createHash('sha256')
    .update(JSON.stringify([previous, entityType, canonicalJson(record)]), 'utf8')
    .digest('hex');
}
