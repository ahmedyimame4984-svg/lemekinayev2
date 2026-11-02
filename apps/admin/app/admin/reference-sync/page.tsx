'use client';

import { useCallback, useEffect, useState } from 'react';

type State = {
  isConfigured: boolean;
  snapshotStatus: string;
  feedCursor: string | null;
  lastSnapshotAt: string | null;
  lastIncrementalAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  totalApplied: number;
  totalSkipped: number;
  totalFailed: number;
  isLocked: boolean;
  workerId: string | null;
};

type Operation = 'snapshot' | 'incremental' | 'reconcile';

export default function ReferenceSyncPage() {
  const [status, setStatus] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmFull, setConfirmFull] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/reference-sync/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Status unavailable (HTTP ${response.status})`);
      setStatus((await response.json()) as State);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read synchronization status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function run(action: Operation, forceFull = false) {
    if (busy || status?.isLocked) return;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/reference-sync/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: action === 'snapshot' ? JSON.stringify({ forceFull }) : undefined,
      });
      if (!response.ok) throw new Error(`Synchronization request failed (HTTP ${response.status})`);
      setNotice(`${action} operation completed. Review the refreshed checkpoint below.`);
      setConfirmFull(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synchronization request failed');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const disabled = Boolean(busy || status?.isLocked || !status?.isConfigured);
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : 'Not yet';

  return (
    <section style={{ maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1>Autotechdoc synchronization</h1>
        <p>Monitor published automotive reference data copied to LemekinayeV2. Marketplace-owned requirements are managed separately.</p>
      </header>
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p>Loading synchronization status…</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}><strong>Connection</strong><p>{status?.isConfigured ? 'Configured' : 'Not configured'}</p></div>
            <div className="card" style={{ padding: 20 }}><strong>Snapshot</strong><p>{status?.snapshotStatus ?? 'Unknown'}</p></div>
            <div className="card" style={{ padding: 20 }}><strong>Worker</strong><p>{status?.isLocked ? 'Running' : 'Idle'}</p></div>
            <div className="card" style={{ padding: 20 }}><strong>Applied records</strong><p>{status?.totalApplied ?? 0}</p></div>
          </div>
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h2>Manual operations</h2>
            <p>Normally an independently deployed worker performs initial and five-minute incremental synchronization. These actions are for authorized administrators.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" disabled={disabled} onClick={() => void run('incremental')}>Synchronize now</button>
              <button type="button" disabled={disabled} onClick={() => void run('reconcile')}>Reconcile data</button>
              <button type="button" disabled={disabled} onClick={() => void run('snapshot')}>Resume / initial snapshot</button>
              <button type="button" disabled={disabled} onClick={() => setConfirmFull(true)}>Full resynchronization</button>
            </div>
            {confirmFull && (
              <div role="group" aria-label="Confirm full resynchronization" style={{ marginTop: 18 }}>
                <p>Restart the complete snapshot? This may be expensive. Existing marketplace data must remain intact.</p>
                <button type="button" disabled={disabled} onClick={() => void run('snapshot', true)}>Confirm full resynchronization</button>
                <button type="button" onClick={() => setConfirmFull(false)}>Cancel</button>
              </div>
            )}
          </div>
          <div className="card" style={{ padding: 24 }}>
            <h2>Synchronization history</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 2fr', gap: 12 }}>
              <dt>Last snapshot</dt><dd>{date(status?.lastSnapshotAt)}</dd>
              <dt>Last incremental</dt><dd>{date(status?.lastIncrementalAt)}</dd>
              <dt>Last success</dt><dd>{date(status?.lastSuccessAt)}</dd>
              <dt>Last failure</dt><dd>{date(status?.lastFailureAt)}</dd>
              <dt>Skipped records</dt><dd>{status?.totalSkipped ?? 0}</dd>
              <dt>Failed runs</dt><dd>{status?.totalFailed ?? 0}</dd>
              <dt>Last error</dt><dd>{status?.lastError ?? 'None'}</dd>
              <dt>Checkpoint cursor</dt><dd style={{ overflowWrap: 'anywhere' }}>{status?.feedCursor ?? 'Beginning of feed'}</dd>
            </dl>
            <button type="button" onClick={() => void refresh()}>Refresh status</button>
          </div>
        </>
      )}
    </section>
  );
}
