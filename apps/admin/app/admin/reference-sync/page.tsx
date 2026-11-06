'use client';

import { useCallback, useEffect, useState } from 'react';

type State = {
  isConfigured: boolean;
  snapshotStatus: string;
  snapshotId: string | null;
  snapshotThrough: string | null;
  snapshotExpiresAt: string | null;
  batchThrough: string | null;
  entityStates: Array<{ entityType: string; status: string; recordCount: number }>;
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
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

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

  const refreshSchedule = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/reference-sync/schedule', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Schedule unavailable (HTTP ${response.status})`);
      const result = (await response.json()) as { enabled: boolean; intervalMinutes: number };
      setScheduleEnabled(result.enabled);
      setIntervalMinutes(result.intervalMinutes);
      setScheduleLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read schedule');
    }
  }, []);

  async function saveSchedule() {
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
      setError('Choose an interval between 1 and 1440 minutes.');
      return;
    }
    setScheduleBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/reference-sync/schedule', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: scheduleEnabled, intervalMinutes }),
      });
      if (!response.ok) throw new Error(`Could not save schedule (HTTP ${response.status})`);
      setNotice(`Automatic synchronization ${scheduleEnabled ? `scheduled every ${intervalMinutes} minute(s), every day` : 'disabled'}. Worker checks configuration every 15 seconds.`);
      await refreshSchedule();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update schedule');
    } finally {
      setScheduleBusy(false);
    }
  }

  useEffect(() => {
    void refreshSchedule();
  }, [refreshSchedule]);

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
            <h2>Automatic synchronization schedule</h2>
            <p>Runs every day, 24 hours a day. Default: every 5 minutes (:00, :05, :10, etc.). Setting changes apply to the managed worker without restarting it.</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} disabled={scheduleBusy || !scheduleLoaded} />
              Enable automatic synchronization
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 260 }}>
              Interval in minutes (1–1440)
              <input type="number" min={1} max={1440} step={1} value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))} disabled={scheduleBusy || !scheduleLoaded} />
            </label>
            <p>Checks are aligned to the configured interval; a long-running sync will not overlap another worker. Manual synchronization remains available if automatic scheduling is disabled.</p>
            <button type="button" disabled={scheduleBusy || !scheduleLoaded} onClick={() => void saveSchedule()}>
              {scheduleBusy ? 'Saving…' : 'Save schedule'}
            </button>
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
              <dt>Committed journal sequence</dt><dd style={{ overflowWrap: 'anywhere' }}>{status?.feedCursor ?? 'Not initialized'}</dd>
              <dt>Current feed batch through</dt><dd>{status?.batchThrough ?? 'No partial batch'}</dd>
              <dt>Frozen snapshot watermark</dt><dd>{status?.snapshotThrough ?? 'Not yet'}</dd>
              <dt>Snapshot ID</dt><dd style={{ overflowWrap: 'anywhere' }}>{status?.snapshotId ?? 'Not yet'}</dd>
              <dt>Snapshot expiry</dt><dd>{date(status?.snapshotExpiresAt)}</dd>
              <dt>Entity tables completed</dt><dd>{status?.entityStates?.filter((entity) => entity.status === 'COMPLETED').length ?? 0} / {status?.entityStates?.length ?? 0}</dd>
            </dl>
            <button type="button" onClick={() => void refresh()}>Refresh status</button>
            <h3 style={{ marginTop: 22 }}>Snapshot entity progress</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr><th scope="col">Canonical entity</th><th scope="col">Status</th><th scope="col">Imported</th></tr>
                </thead>
                <tbody>
                  {status?.entityStates?.length ? status.entityStates.map((item) => (
                    <tr key={item.entityType}>
                      <th scope="row">{item.entityType}</th>
                      <td>{item.status}</td>
                      <td>{item.recordCount}</td>
                    </tr>
                  )) : <tr><td colSpan={3}>No snapshot has been started.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
