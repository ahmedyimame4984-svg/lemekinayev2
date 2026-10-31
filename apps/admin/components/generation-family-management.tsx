'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { postJson, patchJson } from '@/lib/client-api';
import type {
  GenerationFamilyDetail, GenerationFamilyEvidence,
  GenerationFamilyPage, GenerationFamilyRecord,
} from '@/lib/generation-family-contracts';
import { familyProductionError } from '@/lib/generation-family-contracts';
import type { VehicleGenerationRecord, VehicleMakeRecord, VehicleModelRecord, VehicleModelDerivativeRecord, VehicleProductionEndStatus } from '@/lib/vehicle-contracts';
import { hasVehicleManagePermission } from '@/lib/vehicle-management';
import { AdminPageHeader } from './admin-page-header';
import { AdminRecordActionMenu } from './admin-record-action-menu';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { AdminStatusBadge } from './admin-status-badge';
import { useAdminPrincipal } from './admin-session';
import { VehicleAdminNav } from './vehicle-admin-nav';
import { useAdminOverlayKeyboard } from '@/lib/use-admin-overlay-keyboard';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import './generation-family-management.css';

type Editor = { kind: 'create'; modelId: string } | { kind: 'edit'; record: GenerationFamilyRecord };
type Form = { name: string; startYear: string; endYear: string; endStatus: VehicleProductionEndStatus };

const DEFAULT_FORM: Form = { name: '', startYear: '', endYear: '', endStatus: 'UNKNOWN' };
const ROOT = '/api/admin/vehicles/generation-families';

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? 'The Vehicle service could not be reached.');
  }
  return response.json() as Promise<T>;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

export function GenerationFamilyManagement() {
  const principal = useAdminPrincipal();
  const canManage = hasVehicleManagePermission(principal.permissions);

  const [makes, setMakes] = useState<VehicleMakeRecord[]>([]);
  const [models, setModels] = useState<VehicleModelRecord[]>([]);
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [status, setStatus] = useState<'ALL' | MasterDataStatus>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<GenerationFamilyPage>({ items: [], total: 0, page: 1, pageSize: 50, pageCount: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [detail, setDetail] = useState<GenerationFamilyDetail | null>(null);
  const [candidateGenerations, setCandidateGenerations] = useState<VehicleGenerationRecord[]>([]);
  const [derivatives, setDerivatives] = useState<VehicleModelDerivativeRecord[]>([]);
  const [chosenMembers, setChosenMembers] = useState<string[]>([]);
  const [generationSearch, setGenerationSearch] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({ sourceName: '', sourceReference: '', sourceUrl: '', notes: '' });
  const editorKeyboard = useAdminOverlayKeyboard<HTMLElement>({
    open: Boolean(editor), closeDisabled: saving, onClose: () => setEditor(null),
  });
  const detailRequest = useRef(0);

  const availableModels = useMemo(
    () => models.filter((model) => !makeId || model.makeId === makeId),
    [models, makeId],
  );

  useEffect(() => {
    if (!canManage) { setLoadingRefs(false); return; }
    let mounted = true;
    void Promise.all([
      loadJson<VehicleMakeRecord[]>('/api/admin/vehicles/makes'),
      loadJson<VehicleModelRecord[]>('/api/admin/vehicles/models'),
    ]).then(([nextMakes, nextModels]) => {
      if (mounted) { setMakes(nextMakes); setModels(nextModels); }
    }).catch((cause) => { if (mounted) setError(message(cause)); })
      .finally(() => { if (mounted) setLoadingRefs(false); });
    return () => { mounted = false; };
  }, [canManage, refresh]);

  useEffect(() => {
    if (!canManage) return;
    let mounted = true;
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (modelId) query.set('modelId', modelId);
      if (makeId) query.set('makeId', makeId);
      if (status !== 'ALL') query.set('status', status);
      if (search.trim()) query.set('search', search.trim());
      setLoading(true); setError('');
      void loadJson<GenerationFamilyPage>(`${ROOT}/page?${query.toString()}`)
        .then((next) => { if (mounted) setResult(next); })
        .catch((cause) => { if (mounted) setError(message(cause)); })
        .finally(() => { if (mounted) setLoading(false); });
    }, 220);
    return () => { mounted = false; window.clearTimeout(timeout); };
  }, [canManage, makeId, modelId, page, refresh, search, status]);

  function openCreate() {
    setDetail(null);
    setEditor({ kind: 'create', modelId });
    setForm(DEFAULT_FORM); setFormError('');
  }

  function openEdit(record: GenerationFamilyRecord) {
    setEditor({ kind: 'edit', record });
    setForm({ name: record.name, startYear: record.startYear?.toString() ?? '',
      endYear: record.endYear?.toString() ?? '', endStatus: record.endStatus });
    setFormError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const startYear = form.startYear.trim() ? Number(form.startYear) : null;
    const endYear = form.endYear.trim() ? Number(form.endYear) : null;
    const invalid = familyProductionError(startYear, endYear, form.endStatus);
    if (!form.name.trim() || invalid) {
      setFormError(invalid || 'Family name is required.'); return;
    }
    if (editor.kind === 'create' && !editor.modelId) {
      setFormError('Select a Model first.'); return;
    }
    setSaving(true); setFormError('');
    try {
      const body = {
        name: form.name.trim(), startYear, endYear, endStatus: form.endStatus,
      };
      const record = editor.kind === 'create'
        ? await postJson<GenerationFamilyRecord>(ROOT, {
          ...body, modelId: editor.modelId,
        })
        : await patchJson<GenerationFamilyRecord>(`${ROOT}/${editor.record.id}`, {
          ...body, version: editor.record.version,
        });
      setEditor(null); setNotice(editor.kind === 'create' ? 'Draft Family created.' : 'Family updated.');
      setRefresh((n) => n + 1);
      await showDetail(record.id);
    } catch (cause) {
      setFormError(message(cause));
    } finally { setSaving(false); }
  }

  async function showDetail(id: string) {
    const request = ++detailRequest.current;
    setDetail(null);
    setDetailLoading(true); setDetailError('');
    try {
      const family = await loadJson<GenerationFamilyDetail>(`${ROOT}/${id}`);
      const [generations, bodyLines] = await Promise.all([
        loadJson<VehicleGenerationRecord[]>(
          `/api/admin/vehicles/master/generations?modelId=${encodeURIComponent(family.modelId)}`,
        ),
        loadJson<VehicleModelDerivativeRecord[]>(
          `/api/admin/vehicles/master/derivatives?modelId=${encodeURIComponent(family.modelId)}`,
        ),
      ]);
      if (request !== detailRequest.current) return;
      setDetail(family);
      setCandidateGenerations(generations);
      setDerivatives(bodyLines);
      setChosenMembers(family.generations.map((generation) => generation.id));
      setGenerationSearch('');
    } catch (cause) { if (request === detailRequest.current) setDetailError(message(cause)); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  }

  async function saveMembers() {
    if (!detail || detailSaving) return;
    setDetailSaving(true); setDetailError('');
    try {
      await patchJson(`${ROOT}/${detail.id}/members`, {
        version: detail.version, generationIds: chosenMembers,
      });
      setNotice('Explicit Generation assignments saved.');
      setRefresh((n) => n + 1);
      await showDetail(detail.id);
    } catch (cause) { setDetailError(message(cause)); }
    finally { setDetailSaving(false); }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || detailSaving) return;
    if (!evidenceForm.sourceReference.trim() && !evidenceForm.sourceUrl.trim()) {
      setDetailError('Enter a technical document reference or URL.'); return;
    }
    setDetailSaving(true); setDetailError('');
    try {
      await postJson(`${ROOT}/${detail.id}/evidence`, {
        sourceName: evidenceForm.sourceName.trim(),
        sourceReference: evidenceForm.sourceReference.trim() || undefined,
        sourceUrl: evidenceForm.sourceUrl.trim() || undefined,
        notes: evidenceForm.notes.trim() || undefined,
      });
      setEvidenceForm({ sourceName: '', sourceReference: '', sourceUrl: '', notes: '' });
      setNotice('Evidence added for independent review.');
      await showDetail(detail.id);
    } catch (cause) { setDetailError(message(cause)); }
    finally { setDetailSaving(false); }
  }

  async function reviewEvidence(evidence: GenerationFamilyEvidence, decision: 'VERIFIED' | 'REJECTED') {
    if (!detail || detailSaving) return;
    setDetailSaving(true); setDetailError('');
    try {
      await postJson(`${ROOT}/${detail.id}/evidence/${evidence.id}/review`,
        { version: evidence.version, familyVersion: detail.version, decision });
      setNotice('Evidence review recorded.');
      await showDetail(detail.id);
    } catch (cause) { setDetailError(message(cause)); }
    finally { setDetailSaving(false); }
  }

  async function activate() {
    if (!detail || detailSaving) return;
    if (!window.confirm(`Activate Generation Family "${detail.name}"? The Family and its membership will be locked for editing.`)) return;
    setDetailSaving(true); setDetailError('');
    try {
      await postJson(`${ROOT}/${detail.id}/activate`, { version: detail.version });
      setNotice('Generation Family activated.');
      setRefresh((n) => n + 1);
      await showDetail(detail.id);
    } catch (cause) { setDetailError(message(cause)); }
    finally { setDetailSaving(false); }
  }

  const visibleCandidates = candidateGenerations.filter((item) =>
    [item.name, item.code ?? '',
      derivatives.find((bodyLine) => bodyLine.id === item.derivativeId)?.name ?? '']
      .join(' ').toLowerCase().includes(generationSearch.trim().toLowerCase()),
  );
  const isDraft = detail?.status === 'DRAFT';
  const canActivate = detail && ['DRAFT', 'DEPRECATED', 'INACTIVE'].includes(detail.status);
  const verifiedCount = detail?.evidence.filter((item) => item.verificationState === 'VERIFIED').length ?? 0;
  const activeMembers = detail?.generations.filter((item) => item.status === 'ACTIVE').length ?? 0;

  if (!canManage) {
    return <main><AdminPageHeader eyebrow="Vehicles" title="Generation Families" />
      <p role="alert">Vehicle management permission is required.</p></main>;
  }

  return (
    <main className="generation-family-workspace">
      <AdminPageHeader eyebrow="Vehicles / Reference master" title="Generation Families"
        description="Group documented Generations of the same Model without changing configured-vehicle identities or parts fitment."
        actions={<button type="button" className="button button--primary"
          disabled={loadingRefs || !models.length} onClick={openCreate}>Add Generation Family</button>} />
      <VehicleAdminNav active="generation-families" />
      {notice ? <p role="status" className="admin-notice">{notice}</p> : null}
      {error ? <div role="alert" className="error">{error} <button type="button"
        className="button button--quiet" onClick={() => setRefresh((n) => n + 1)}>Retry</button></div> : null}

      <section className="admin-panel" aria-label="Generation Family library">
        <div className="admin-filter-toolbar">
          <div><label htmlFor="family-make-filter">Make</label>
            <AdminSearchableCombobox id="family-make-filter" value={makeId}
              options={[{ id: '', label: 'All makes' }, ...makes.map((make) => ({ id: make.id, label: make.name }))]}
              placeholder="All makes" onChange={(id) => { setMakeId(id); setModelId(''); setPage(1); }} />
          </div>
          <div><label htmlFor="family-model-filter">Model</label>
            <AdminSearchableCombobox id="family-model-filter" value={modelId}
              options={[{ id: '', label: 'All models' }, ...availableModels.map((model) => ({
                id: model.id, label: model.name, meta: makes.find((make) => make.id === model.makeId)?.name,
              }))]}
              placeholder="All models" onChange={(id) => { setModelId(id); setPage(1); }} />
          </div>
          <div><label htmlFor="family-status-filter">Status</label>
            <select id="family-status-filter" value={status} onChange={(event) => {
              setStatus(event.target.value as typeof status); setPage(1);
            }}>
              {(['ALL', 'DRAFT', 'ACTIVE', 'INACTIVE', 'DEPRECATED', 'SUPERSEDED', 'ARCHIVED'] as const).map((item) =>
                <option key={item} value={item}>{item === 'ALL' ? 'All statuses' : item}</option>)}
            </select>
          </div>
          <div><label htmlFor="family-search">Search</label>
            <input id="family-search" type="search" value={search} placeholder="Family name or code"
              onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <button type="button" className="button button--quiet" onClick={() => {
            setMakeId(''); setModelId(''); setSearch(''); setStatus('ALL'); setPage(1);
          }}>Clear filters</button>
        </div>
        <div aria-live="polite" className="admin-library-count">
          {loading ? 'Loading Families…' : `${result.total} Generation Families`}
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>Make / Model</th><th>Family</th><th>Production</th>
              <th>Status</th><th>Generations</th><th>Actions</th></tr></thead>
            <tbody>
              {result.items.map((family) => (
                <tr key={family.id}>
                  <td>{family.makeName} / {family.modelName}</td>
                  <td><strong>{family.name}</strong><div className="muted">{family.code}</div></td>
                  <td>{family.startYear ?? '—'} – {family.endStatus === 'CURRENT'
                    ? 'Current' : family.endYear ?? 'Unknown'}</td>
                  <td><AdminStatusBadge status={family.status} /></td>
                  <td>{family.linkedCount}</td>
                  <td><AdminRecordActionMenu entityName={family.name}
                    items={[
                      { id: 'open', title: 'Inspect & assign', description: 'View members and source evidence', disabled: detailSaving || detailLoading },
                      { id: 'edit', title: 'Edit draft', description: 'Change Family details', disabled: family.status !== 'DRAFT' || detailSaving || detailLoading },
                    ] as const}
                    onSelect={(action) => { if (action === 'edit') openEdit(family); else void showDetail(family.id); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && result.items.length === 0 ? <p>No Generation Families match these filters.</p> : null}
        </div>
        <div className="admin-pagination">
          <button type="button" className="button button--quiet" disabled={page <= 1 || loading}
            onClick={() => setPage((n) => n - 1)}>Previous</button>
          <span>Page {page} of {result.pageCount || 1}</span>
          <button type="button" className="button button--quiet"
            disabled={page >= result.pageCount || loading} onClick={() => setPage((n) => n + 1)}>Next</button>
        </div>
      </section>

      {editor ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button className="catalog-drawer-scrim" type="button" aria-label="Close Generation Family editor"
            disabled={saving} onClick={editorKeyboard.requestClose} />
          <section ref={editorKeyboard} className="catalog-drawer generation-family-editor" role="dialog"
            aria-modal="true" aria-labelledby="generation-family-editor-title">
          <div className="catalog-drawer__heading">
            <div><span className="eyebrow">Vehicles / Generation Families</span>
              <h2 id="generation-family-editor-title">{editor.kind === 'create' ? 'Create Draft Family' : 'Edit Draft Family'}</h2></div>
            <button className="button button--quiet" type="button" disabled={saving}
              onClick={editorKeyboard.requestClose}>Close</button>
          </div>
          <form className="catalog-drawer__fields" onSubmit={(event) => void save(event)}>
            <fieldset disabled={saving}>
            {editor.kind === 'create' ? (
              <div><label htmlFor="family-editor-model">Model</label>
                <AdminSearchableCombobox id="family-editor-model" value={editor.modelId}
                  options={models.map((model) => ({
                    id: model.id, label: model.name, meta: makes.find((make) => make.id === model.makeId)?.name,
                  }))} placeholder="Select Model" onChange={(id) => setEditor({ kind: 'create', modelId: id })} />
              </div>
            ) : <p>Model: {editor.record.makeName} / {editor.record.modelName} (fixed)</p>}
            <div className="form-grid">
              <div><label htmlFor="family-name">Family name</label>
                <input id="family-name" required maxLength={120} value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div><label htmlFor="family-start-year">Start year</label>
                <input id="family-start-year" type="number" min={1886} max={2200}
                  value={form.startYear} onChange={(event) => setForm({ ...form, startYear: event.target.value })} /></div>
              <div><label htmlFor="family-end-status">Production status</label>
                <select id="family-end-status" value={form.endStatus} onChange={(event) =>
                  setForm({ ...form, endStatus: event.target.value as VehicleProductionEndStatus,
                    endYear: event.target.value === 'ENDED' ? form.endYear : '' })}>
                  <option value="UNKNOWN">Unknown</option><option value="CURRENT">Current</option>
                  <option value="ENDED">Ended</option></select></div>
              <div><label htmlFor="family-end-year">End year</label>
                <input id="family-end-year" type="number" min={1886} max={2200}
                  disabled={form.endStatus !== 'ENDED'} value={form.endYear}
                  onChange={(event) => setForm({ ...form, endYear: event.target.value })} /></div>
            </div>
            <p className="muted">An internal Family code is generated automatically. Records start as Draft.</p>
            </fieldset>
            {formError ? <p role="alert" className="error">{formError}</p> : null}
            <div className="button-row"><button className="button button--primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft Family'}</button>
              <button className="button button--quiet" type="button" disabled={saving}
                onClick={editorKeyboard.requestClose}>Cancel</button></div>
          </form>
        </section>
        </div>
      ) : null}

      {detailLoading ? <p role="status">Loading Generation Family details…</p> : null}
      {detailError ? <p role="alert" className="error">{detailError}</p> : null}
      {detail ? (
        <section className="admin-panel" aria-label="Family detail and review">
          <div className="admin-page-header">
            <div><h2>{detail.name}</h2>
              <p>{detail.makeName} / {detail.modelName} · {detail.code} · <AdminStatusBadge status={detail.status} /></p>
            </div>
            <button className="button button--quiet" type="button" disabled={detailSaving} onClick={() => setDetail(null)}>Close</button>
          </div>
          <h3>Explicit Generation assignments</h3>
          {principal.permissions.includes('admin.audit.read') ? <a
            href={`/admin/audit?entityType=VehicleGenerationFamily&entityId=${encodeURIComponent(detail.id)}`}>View Family audit history</a> : null}
          <p>Only Generations from this Model are selectable. Other Model identities and fitment references are unchanged.</p>
          <label htmlFor="family-generation-search">Find Generation</label>
          <input id="family-generation-search" type="search" value={generationSearch}
            onChange={(event) => setGenerationSearch(event.target.value)}
            placeholder="Search names, codes or Body Line reference" />
          <div className="admin-table-scroll">
            <table className="admin-table"><thead><tr><th>Select</th><th>Generation</th><th>Body Line</th><th>Production</th><th>Status</th><th>Grouping</th></tr></thead>
              <tbody>{visibleCandidates.map((item) => {
                const isTaken = Boolean(item.familyId && item.familyId !== detail.id);
                return <tr key={item.id}>
                  <td><input type="checkbox" aria-label={`Assign ${item.name}`} disabled={!isDraft || detailSaving || isTaken || item.status === 'ARCHIVED' || item.status === 'SUPERSEDED'}
                    checked={chosenMembers.includes(item.id)} onChange={(event) =>
                      setChosenMembers((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} /></td>
                  <td>{item.name} {item.code ? `(${item.code})` : ''}</td>
                  <td>{derivatives.find((bodyLine) => bodyLine.id === item.derivativeId)?.name ?? '—'}</td>
                  <td>{item.startYear ?? '—'} – {item.endStatus === 'CURRENT' ? 'Current' : item.endYear ?? 'Unknown'}</td>
                  <td>{item.status}</td>
                  <td>{isTaken ? 'Assigned to another Family' : item.familyId === detail.id ? 'This Family' : 'Unassigned'}</td>
                </tr>;
              })}</tbody></table>
            {candidateGenerations.length === 0 ? <p>No Generations exist for this Model.</p> : null}
          </div>
          {isDraft ? <button type="button" className="button button--primary" disabled={detailSaving}
            onClick={() => void saveMembers()}>Save Generation assignments ({chosenMembers.length})</button> : null}

          <h3>Technical evidence and review</h3>
          <p className="muted">Changing Family details or assignments requires fresh evidence review. The reviewer must be different from the source author and the last Family editor.</p>
          {detail.evidence.length === 0 ? <p>No evidence submitted. Activation is blocked until independent verification.</p> : null}
          <div className="admin-table-scroll"><table className="admin-table">
            <thead><tr><th>Source</th><th>Reference</th><th>Review</th><th>Action</th></tr></thead>
            <tbody>{detail.evidence.map((evidence) => <tr key={evidence.id}>
              <td>{evidence.sourceName}</td>
              <td>{evidence.sourceUrl ? <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Source link</a> : evidence.sourceReference ?? '—'}
                {evidence.sourceReference && evidence.sourceUrl ? <div>{evidence.sourceReference}</div> : null}</td>
              <td>{evidence.verificationState}</td>
              <td>{isDraft && evidence.createdById !== principal.userId && detail.updatedById !== principal.userId && evidence.verificationState !== 'VERIFIED' ?
                <div className="button-row">
                  <button type="button" className="button button--quiet" disabled={detailSaving}
                    onClick={() => void reviewEvidence(evidence, 'VERIFIED')}>Verify</button>
                  <button type="button" className="button button--quiet" disabled={detailSaving}
                    onClick={() => void reviewEvidence(evidence, 'REJECTED')}>Reject</button>
                </div> : <span>{evidence.verificationState === 'VERIFIED' ? 'Reviewed' : 'Independent review required'}</span>}</td>
            </tr>)}</tbody></table></div>
          {isDraft ? <form onSubmit={(event) => void submitEvidence(event)} aria-label="Submit Family technical evidence">
            <h4>Add documentary evidence</h4>
            <div className="form-grid">
              <div><label htmlFor="family-evidence-name">Source name</label>
                <input id="family-evidence-name" required maxLength={160} value={evidenceForm.sourceName}
                  onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceName: event.target.value })} /></div>
              <div><label htmlFor="family-evidence-ref">Document reference</label>
                <input id="family-evidence-ref" maxLength={255} value={evidenceForm.sourceReference}
                  onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceReference: event.target.value })} /></div>
              <div><label htmlFor="family-evidence-url">Source URL</label>
                <input id="family-evidence-url" type="url" maxLength={1000} value={evidenceForm.sourceUrl}
                  onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceUrl: event.target.value })} /></div>
              <div><label htmlFor="family-evidence-notes">Notes</label>
                <input id="family-evidence-notes" maxLength={2000} value={evidenceForm.notes}
                  onChange={(event) => setEvidenceForm({ ...evidenceForm, notes: event.target.value })} /></div>
            </div>
            <button type="submit" className="button button--quiet" disabled={detailSaving}>Add unverified evidence</button>
          </form> : null}

          {canActivate ? <div className="admin-panel">
            <p>Activation readiness: {activeMembers} active assigned Generations, {verifiedCount} verified sources.
              An ACTIVE parent Model is also required. Production years are optional.</p>
            <button type="button" className="button button--primary"
              disabled={detailSaving || activeMembers < 1 || verifiedCount < 1}
              onClick={() => void activate()}>{isDraft ? 'Activate reviewed Family' : 'Reactivate reviewed Family'}</button>
          </div> : <p role="status">This Family is {detail.status.toLowerCase()}; assignments and evidence are locked.</p>}
          <AdminMasterLifecycleActions domain="VEHICLE" entityType="VEHICLE_GENERATION_FAMILY"
            entityId={detail.id} entityName={detail.name} status={detail.status} version={detail.version}
            disabled={detailSaving} onCompleted={() => { setDetail(null); setRefresh((n) => n + 1); }} />
        </section>
      ) : null}
    </main>
  );
}
