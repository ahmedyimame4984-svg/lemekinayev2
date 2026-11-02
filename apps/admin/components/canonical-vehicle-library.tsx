'use client';

import { useEffect, useState } from 'react';
import type { VehicleConfigurationLibraryPage } from '@/lib/vehicle-contracts';

/** Synced canonical vehicle library: no creation, edits or lifecycle mutations. */
export function CanonicalVehicleLibrary({ initialSearch = '' }: { initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VehicleConfigurationLibraryPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (submittedSearch) params.set('search', submittedSearch);
    fetch(`/api/admin/vehicles/configuration-library?${params}`, {
      signal: controller.signal, cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load synchronized vehicles (HTTP ${response.status})`);
      return (await response.json()) as VehicleConfigurationLibraryPage;
    }).then((result) => {
      setData(result);
      setError('');
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Vehicle library unavailable');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [submittedSearch, page]);

  return (
    <section className="catalog-page">
      <div className="catalog-page__heading">
        <span className="eyebrow">Autotechdoc synchronized reference data</span>
        <h1>Configured Vehicles Library</h1>
        <p>Vehicle makes, models, generations and configurations are managed in Autotechdoc. Browse the local synchronized copy here; creation and editing are disabled.</p>
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        setPage(1);
        setLoading(true);
        setSubmittedSearch(search.trim());
      }} style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
        <input aria-label="Search synchronized vehicles" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search make, model, engine or configuration…" style={{ flex: 1 }} />
        <button className="button button--primary" type="submit">Search</button>
      </form>
      {loading ? <p role="status">Loading synchronized vehicles…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && data ? (
        <>
          <p>{data.total} synchronized configurations</p>
          {data.items.length === 0 ? (
            <div className="catalog-empty"><strong>No matching configurations</strong><p>Publish the vehicle records in Autotechdoc and run reference synchronization.</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th>Make</th><th>Model</th><th>Generation</th><th>Trim</th><th>Engine</th><th>Year</th><th>Status</th></tr></thead>
                <tbody>{data.items.map((v) => (
                  <tr key={v.id}>
                    <td>{v.make.name}</td>
                    <td>{v.model.name}</td>
                    <td>{v.generation?.name ?? '—'}</td>
                    <td>{v.trim?.name ?? '—'}</td>
                    <td>{v.engine?.name ?? '—'}</td>
                    <td>{v.modelYear ?? '—'}</td>
                    <td>{v.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((n) => n - 1); }}>Previous</button>
            <span>Page {data.page} of {data.pageCount || 1}</span>
            <button type="button" disabled={page >= data.pageCount} onClick={() => { setLoading(true); setPage((n) => n + 1); }}>Next</button>
          </div>
        </>
      ) : null}
    </section>
  );
}
