'use client';

import { useEffect, useMemo, useState } from 'react';
import type { VehicleMakeRecord, VehicleModelRecord } from '@/lib/vehicle-contracts';

export function CanonicalVehicleMakesModels({ view }: { view: 'makes' | 'models' }) {
  const [records, setRecords] = useState<Array<VehicleMakeRecord | VehicleModelRecord>>([]);
  const [makes, setMakes] = useState<VehicleMakeRecord[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/vehicles/${view}`, { signal: controller.signal, cache: 'no-store' }),
      fetch('/api/admin/vehicles/makes', { signal: controller.signal, cache: 'no-store' }),
    ]).then(async ([rows, parent]) => {
      if (!rows.ok || !parent.ok) throw new Error('Unable to load synchronized vehicle reference data');
      return [await rows.json(), await parent.json()] as [Array<VehicleMakeRecord | VehicleModelRecord>, VehicleMakeRecord[]];
    }).then(([rows, parent]) => {
      setRecords(rows);
      setMakes(parent);
      setError('');
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Vehicle library unavailable');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [view]);

  const makeNames = useMemo(() => new Map(makes.map((m) => [m.id, m.name])), [makes]);
  const filtered = records.filter((record) => {
    const parentName = 'makeId' in record ? makeNames.get(record.makeId) ?? '' : '';
    return `${record.name} ${record.code} ${parentName}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <section className="catalog-page">
      <span className="eyebrow">Synced from Autotechdoc · Read-only</span>
      <h1>{view === 'makes' ? 'Vehicle Makes' : 'Vehicle Models'}</h1>
      <p>Canonical vehicle identities are created, edited, and approved in Autotechdoc. LemekinayeV2 displays its local synchronized copy.</p>
      <nav className="catalog-tabs" aria-label="Vehicle reference libraries">
        <a href="/admin/vehicles/configurations">Configurations</a>
        <a href="/admin/vehicles/makes">Makes</a>
        <a href="/admin/vehicles/models">Models</a>
      </nav>
      <label className="field" style={{ maxWidth: 520, margin: '18px 0' }}>
        <span className="field__label">Search reference records</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search name, code or make" />
      </label>
      {loading ? <p role="status">Loading vehicle reference data…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error ? (
        <div>
          <p>{filtered.length} records</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th>Name</th><th>Code</th>{view === 'models' && <th>Make</th>}<th>Status</th><th>Version</th></tr></thead>
              <tbody>{filtered.map((record) => (
                <tr key={record.id}><td>{record.name}</td><td>{record.code}</td>
                  {view === 'models' && <td>{'makeId' in record ? makeNames.get(record.makeId) ?? '—' : '—'}</td>}
                  <td>{record.status}</td><td>{record.version}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {filtered.length === 0 ? <p>No matching synchronized records.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
