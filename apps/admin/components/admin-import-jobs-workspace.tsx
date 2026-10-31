'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AdminImportJobPage,
  AdminImportWorkflow,
} from '@/lib/admin-import-contracts';
import { AdminPageHeader } from './admin-page-header';
import {
  AdminLibraryPagination,
  type AdminPageSize,
} from './admin-library-shell';
import { useAdminPrincipal } from './admin-session';

const EMPTY_PAGE: AdminImportJobPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 0,
};

const labels: Record<AdminImportWorkflow, string> = {
  ATTRIBUTE_LIBRARY: 'Attribute Library',
  PRODUCT_TYPE_LIBRARY: 'Product Types',
  CONFIGURED_VEHICLE_LIBRARY: 'Configured Vehicles',
  MANUFACTURER_ARTICLE: 'Manufacturer Articles',
};

export function AdminImportJobsWorkspace() {
  const principal = useAdminPrincipal();
  const canCatalog = principal.permissions.includes('catalog.manage');
  const canVehicle = principal.permissions.includes('vehicle.manage');
  const canAudit = principal.permissions.includes('admin.audit.read');
  const canUse = canCatalog || canVehicle;

  const [workflow, setWorkflow] = useState<'ALL' | AdminImportWorkflow>('ALL');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(25);
  const [data, setData] = useState<AdminImportJobPage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(canUse);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const allowedWorkflows = useMemo(() => {
    const values: AdminImportWorkflow[] = [];
    if (canCatalog) {
      values.push(
        'ATTRIBUTE_LIBRARY',
        'PRODUCT_TYPE_LIBRARY',
        'MANUFACTURER_ARTICLE',
      );
    }
    if (canVehicle) values.push('CONFIGURED_VEHICLE_LIBRARY');
    return values;
  }, [canCatalog, canVehicle]);

  useEffect(() => {
    if (!canUse) {
      setLoading(false);
      setData(EMPTY_PAGE);
      return;
    }

    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError('');
        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
        });
        if (workflow !== 'ALL') query.set('workflow', workflow);
        const response = await fetch(
          `/api/admin/imports/jobs?${query.toString()}`,
          { credentials: 'same-origin', cache: 'no-store' },
        );
        if (!response.ok) throw new Error('Could not load import jobs');
        const page = (await response.json()) as AdminImportJobPage;
        if (active) setData(page);
      } catch {
        if (active) {
          setError(
            'Import job history could not be loaded. The individual import workflows are still available.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [canUse, pageNumber, pageSize, reloadKey, workflow]);

  if (!canUse) {
    return (
      <section className="catalog-page">
        <h1>Imports &amp; Jobs</h1>
        <p>
          Your administrator account does not have Catalog or Vehicle master-data
          permissions.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page import-jobs-workspace">
      <AdminPageHeader
        eyebrow="Scale tooling"
        title="Imports & Jobs"
        description="One operational view for approved bulk ingestion. Each workflow keeps its own domain validation, preview rules and ownership boundaries."
        actions={
          <>
            {canAudit ? (
              <a className="button button--quiet" href="/admin/audit">
                Audit History
              </a>
            ) : null}
            <button
              className="button button--quiet"
              type="button"
              disabled={loading}
              onClick={() => setReloadKey((current) => current + 1)}
            >
              {loading ? 'Refreshing…' : 'Refresh jobs'}
            </button>
          </>
        }
      />

      <div className="import-jobs-workflows" aria-label="Import workflows">
        {canCatalog ? (
          <>
            <WorkflowCard
              title="Attribute Library"
              format="CSV"
              href="/admin/catalog/attributes"
              text="Create canonical technical Attributes after row-level preview validation."
            />
            <WorkflowCard
              title="Product Types"
              format="CSV"
              href="/admin/catalog/product-types"
              text="Import canonical Product Types against existing Category and Part Group masters."
            />
            <WorkflowCard
              title="Manufacturer Articles"
              format="CSV / XLSX"
              href="/admin/catalog/article-import"
              text="Approved catalog ingestion with file inspection, mapping, corrections, preview fingerprinting and job audit."
            />
          </>
        ) : null}
      </div>

      <section className="import-jobs-history">
        <div className="import-jobs-history__heading">
          <div>
            <span className="eyebrow">Committed batches</span>
            <h2>Recent import jobs</h2>
            <p>
              Only successfully committed batches appear here. Preview errors never
              create a job record.
            </p>
          </div>
          <label className="catalog-filter">
            <span>Workflow</span>
            <select
              value={workflow}
              onChange={(event) => {
                setWorkflow(event.target.value as 'ALL' | AdminImportWorkflow);
                setPageNumber(1);
              }}
            >
              <option value="ALL">All permitted workflows</option>
              {allowedWorkflows.map((value) => (
                <option value={value} key={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="catalog-state" aria-live="polite">
            <span className="spinner spinner--dark" aria-hidden="true" />
            <p>Loading import jobs…</p>
          </div>
        ) : null}

        {!loading && !error && data.items.length === 0 ? (
          <div className="catalog-state">
            <p>No committed import jobs match this view yet.</p>
          </div>
        ) : null}

        {!loading && data.items.length > 0 ? (
          <div className="import-jobs-table-wrap">
            <table className="import-jobs-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Source</th>
                  <th>Rows</th>
                  <th>Created</th>
                  <th>Outcome</th>
                  <th>Committed</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{labels[job.workflow]}</strong>
                      <small>{job.fileFormat}</small>
                    </td>
                    <td>
                      <strong>
                        {job.fileName || job.datasetReference || 'Batch import'}
                      </strong>
                      {job.fileName && job.datasetReference ? (
                        <small>{job.datasetReference}</small>
                      ) : null}
                    </td>
                    <td>
                      <strong>{job.includedRows}</strong>
                      <small>
                        {job.totalRows} source
                        {job.excludedRows > 0
                          ? ` · ${job.excludedRows} excluded`
                          : ''}
                        {job.warningRows > 0
                          ? ` · ${job.warningRows} warnings`
                          : ''}
                      </small>
                    </td>
                    <td>
                      <strong>{job.createdCount}</strong>
                      <small>records</small>
                    </td>
                    <td>
                      <span className="import-job-status">
                        {job.status === 'COMPLETED' ? 'Completed' : job.status}
                      </span>
                    </td>
                    <td>
                      <strong>{formatDate(job.createdAt)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !error && data.total > 0 ? (
          <AdminLibraryPagination
            page={pageNumber}
            pageCount={data.pageCount}
            pageSize={pageSize}
            total={data.total}
            disabled={loading}
            onPageChange={setPageNumber}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPageNumber(1);
            }}
          />
        ) : null}
      </section>
    </section>
  );
}

function WorkflowCard({
  title,
  format,
  href,
  text,
}: {
  title: string;
  format: string;
  href: string;
  text: string;
}) {
  return (
    <a className="import-jobs-workflow-card" href={href}>
      <div>
        <span>{format}</span>
        <h2>{title}</h2>
      </div>
      <p>{text}</p>
      <strong>Open workflow →</strong>
    </a>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
