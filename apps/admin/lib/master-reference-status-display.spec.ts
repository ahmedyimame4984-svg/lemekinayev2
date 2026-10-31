import { describe, expect, it } from 'vitest';
import {
  isMasterReferenceStatusPayload,
  masterReferenceCountDisplay,
} from './master-reference-status-display';

describe('Admin master-data count rendering', () => {
  it('shows missing and malformed count entries as unavailable rather than zero', () => {
    for (const input of [
      undefined,
      null,
      {},
      { actual: 10 },
      { actual: undefined, expected: null },
      { actual: -1, expected: null },
      { actual: 5, expected: undefined },
      { actual: Number.NaN, expected: null },
      { actual: 1, expected: '10' },
      { actual: 1, expected: -1 },
    ]) {
      expect(masterReferenceCountDisplay(input)).toEqual({
        available: false,
        baselineMet: false,
        badge: 'Unavailable',
        value: '—',
        description: 'The API did not return a valid count.',
      });
    }
  });

  it('shows actual admin-managed counts without inventing a target', () => {
    expect(masterReferenceCountDisplay({ actual: 0, expected: null })).toMatchObject({
      available: true,
      badge: 'Admin-managed',
      value: '0',
      description: 'Current records',
    });
    expect(masterReferenceCountDisplay({ actual: 25, expected: null })).toMatchObject({
      available: true,
      badge: 'Admin-managed',
      value: '25',
    });
  });

  it('preserves real attribute-baseline indicators', () => {
    expect(masterReferenceCountDisplay({ actual: 3, expected: 5 })).toMatchObject({
      badge: 'Below baseline',
      value: '3 / 5',
      baselineMet: false,
    });
    expect(masterReferenceCountDisplay({ actual: 5, expected: 5 })).toMatchObject({
      badge: 'Baseline count met',
      value: '5 / 5',
      baselineMet: true,
    });
  });

  it('rejects malformed API envelopes and tolerates missing individual count keys', () => {
    const payload = {
      attributeLibraryReady: true,
      replacementInProgress: false,
      vehicleLibraryState: 'EMPTY',
      counts: { attributes: { actual: 1, expected: 1 } },
      blockers: {
        products: 0,
        sellerListings: 0,
        vehicleProfiles: 0,
        vehicleCompatibilities: 0,
      },
    };
    expect(isMasterReferenceStatusPayload(payload)).toBe(true);
    expect(masterReferenceCountDisplay((payload.counts as Record<string, unknown>)['vehicleMakes'])).toMatchObject({
      available: false,
      badge: 'Unavailable',
    });
    expect(isMasterReferenceStatusPayload({ ...payload, counts: undefined })).toBe(false);
    expect(isMasterReferenceStatusPayload({ ...payload, blockers: undefined })).toBe(false);
    expect(isMasterReferenceStatusPayload({ ...payload, vehicleLibraryState: 'UNKNOWN' })).toBe(false);
  });
});
