// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReferenceSyncPage from './page';

const status = {
  isConfigured: true, snapshotStatus: 'COMPLETED', snapshotId: 'frozen-example',
  snapshotThrough: '922', snapshotExpiresAt: '2026-11-06T21:00:00Z',
  feedCursor: '930', batchThrough: null,
  lastSnapshotAt: '2026-11-06T12:00:00Z',
  lastIncrementalAt: '2026-11-06T12:05:00Z',
  lastSuccessAt: '2026-11-06T12:05:00Z',
  lastFailureAt: null, lastError: null,
  totalApplied: 5, totalSkipped: 0, totalFailed: 0,
  isLocked: false, workerId: null,
  entityStates: [{ entityType: 'Brand', status: 'COMPLETED', recordCount: 2 },
    { entityType: 'VehicleConfiguration', status: 'COMPLETED', recordCount: 3 }],
};

const schedule = { enabled: true, intervalMinutes: 5 };
let requests: Array<{ url: string; method: string; body: string | undefined }>;
let locked = false;
let failing = false;

beforeEach(() => {
  requests = [];
  locked = false;
  failing = false;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push({
      url, method, body: typeof init?.body === 'string' ? init.body : undefined,
    });
    if (failing) return { ok: false, status: 503 };
    if (url.endsWith('/schedule')) return { ok: true, json: async () => schedule };
    if (url.endsWith('/status')) return {
      ok: true, json: async () => ({ ...status, isLocked: locked }),
    };
    return { ok: true, json: async () => ({ status: 'SUCCESS' }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ATD-07 Admin sync monitoring and manual controls', () => {
  it('shows durable v2 snapshot and journal watermarks with per-entity counts', async () => {
    render(createElement(ReferenceSyncPage));
    expect(await screen.findByText('frozen-example')).toBeTruthy();
    expect(screen.getByText('922')).toBeTruthy();
    expect(screen.getByText('930')).toBeTruthy();
    expect(screen.getByText('VehicleConfiguration')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByText('Snapshot entity progress')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Synchronize now' })).toBeTruthy();
    expect(requests.some(row => row.url.endsWith('/status'))).toBe(true);
    expect(requests.some(row => row.url.endsWith('/schedule'))).toBe(true);
  });

  it('requires explicit confirmation for full resynchronization', async () => {
    render(createElement(ReferenceSyncPage));
    const button = await screen.findByRole('button', { name: 'Full resynchronization' });
    fireEvent.click(button);
    expect(requests.every(row => row.method === 'GET')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm full resynchronization' }));
    await waitFor(() => {
      expect(requests).toContainEqual({
        url: '/api/admin/reference-sync/snapshot',
        method: 'POST',
        body: JSON.stringify({ forceFull: true }),
      });
    });
  });

  it('disables manual operations when another worker holds the lease', async () => {
    locked = true;
    render(createElement(ReferenceSyncPage));
    const button = await screen.findByRole('button', { name: 'Synchronize now' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Full resynchronization' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows server errors without treating them as successful synchronization', async () => {
    failing = true;
    render(createElement(ReferenceSyncPage));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('snapshot operation completed.')).toBeNull();
  });
});
