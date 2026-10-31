'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ProductTypePage,
  ProductTypeRecord,
  ProductTypeSchemaVersionRecord,
} from '@/lib/catalog-contracts';
import type {
  CatalogArticleImportJobRecord,
  ProfessionalCatalogArticleImportCommit,
  ProfessionalCatalogArticleImportInspect,
  ProfessionalCatalogArticleImportPreview,
  ProfessionalCatalogArticleImportRequest,
} from '@/lib/product-contracts';
import { ClientApiError, postJson } from '@/lib/client-api';
import { AdminPageHeader } from './admin-page-header';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { useAdminPrincipal } from './admin-session';

type ImportFormat = 'CSV' | 'XLSX';

type FieldMapping = {
  rowKey: string;
  productType: string;
  schemaVersion: string;
  brand: string;
  manufacturerPartNumber: string;
  unitOfMeasure: string;
  packQuantity: string;
  name: string;
  description: string;
  sourceReference: string;
};

const EMPTY_MAPPING: FieldMapping = {
  rowKey: '',
  productType: '',
  schemaVersion: '',
  brand: '',
  manufacturerPartNumber: '',
  unitOfMeasure: '',
  packQuantity: '',
  name: '',
  description: '',
  sourceReference: '',
};

export function ProfessionalArticleImport() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [datasetReference, setDatasetReference] = useState('');
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<ImportFormat>('CSV');
  const [fileBase64, setFileBase64] = useState('');
  const [inspect, setInspect] =
    useState<ProfessionalCatalogArticleImportInspect | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>(EMPTY_MAPPING);
  const [fixedProductTypeId, setFixedProductTypeId] = useState('');
  const [fixedSchemaVersion, setFixedSchemaVersion] = useState('');
  const [attributeColumns, setAttributeColumns] = useState<
    Record<string, string>
  >({});
  const [advancedAttributeMappings, setAdvancedAttributeMappings] =
    useState('');
  const [productTypeReferences, setProductTypeReferences] = useState('');
  const [brandReferences, setBrandReferences] = useState('');
  const [unitReferences, setUnitReferences] = useState('');
  const [excludedRows, setExcludedRows] = useState<number[]>([]);
  const [corrections, setCorrections] = useState<
    Record<number, Record<string, string>>
  >({});
  const [preview, setPreview] =
    useState<ProfessionalCatalogArticleImportPreview | null>(null);
  const [jobs, setJobs] = useState<CatalogArticleImportJobRecord[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeRecord[]>([]);
  const [schemas, setSchemas] = useState<ProductTypeSchemaVersionRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [dirtyAfterPreview, setDirtyAfterPreview] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedSchema = useMemo(() => {
    const version = Number(fixedSchemaVersion);
    return schemas.find((schema) => schema.schemaVersion === version) ?? null;
  }, [fixedSchemaVersion, schemas]);

  const schemaAttributes = useMemo(
    () =>
      (selectedSchema?.snapshot.attributes ?? [])
        .map((attribute) => ({
          code: attribute.code?.trim() ?? '',
          name: attribute.name?.trim() || attribute.code?.trim() || '',
          requirement: attribute.requirement ?? 'OPTIONAL',
        }))
        .filter((attribute) => attribute.code)
        .sort(
          (a, b) =>
            (a.requirement === 'MANDATORY' ? -1 : 1) -
              (b.requirement === 'MANDATORY' ? -1 : 1) ||
            a.name.localeCompare(b.name),
        ),
    [selectedSchema],
  );

  const displayedRows = useMemo(() => {
    if (!preview) return [];
    const priority = [...preview.rows].sort(
      (a, b) =>
        Number(a.excluded) - Number(b.excluded) ||
        Number(a.errors.length === 0) - Number(b.errors.length === 0) ||
        Number(a.warnings.length === 0) - Number(b.warnings.length === 0) ||
        a.sourceRowNumber - b.sourceRowNumber,
    );
    return priority.slice(0, 100);
  }, [preview]);

  useEffect(() => {
    if (!canManage) {
      setLoadingMaster(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const [typesResponse, jobsResponse] = await Promise.all([
          fetch(
            '/api/admin/catalog/product-types/page?status=ACTIVE&page=1&pageSize=100&sortBy=NAME&sortDirection=ASC',
            { credentials: 'same-origin', cache: 'no-store' },
          ),
          fetch('/api/admin/products/import/jobs', {
            credentials: 'same-origin',
            cache: 'no-store',
          }),
        ]);
        if (!typesResponse.ok) throw new Error('Could not load Product Types');
        const types = (await typesResponse.json()) as ProductTypePage;
        const history = jobsResponse.ok
          ? ((await jobsResponse.json()) as CatalogArticleImportJobRecord[])
          : [];
        if (active) {
          setProductTypes(types.items);
          setJobs(history);
        }
      } catch {
        if (active) {
          setError(
            'The Article import workspace could not load its catalog reference data.',
          );
        }
      } finally {
        if (active) setLoadingMaster(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [canManage]);

  useEffect(() => {
    if (!fixedProductTypeId) {
      setSchemas([]);
      setFixedSchemaVersion('');
      setAttributeColumns({});
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/catalog/product-types/${fixedProductTypeId}/schemas`,
          { credentials: 'same-origin', cache: 'no-store' },
        );
        if (!response.ok) throw new Error('Could not load Product Type schemas');
        const result = (await response.json()) as ProductTypeSchemaVersionRecord[];
        if (!active) return;
        const ordered = [...result].sort(
          (a, b) => b.schemaVersion - a.schemaVersion,
        );
        setSchemas(ordered);
        setFixedSchemaVersion(
          ordered[0] ? String(ordered[0].schemaVersion) : '',
        );
        setAttributeColumns({});
        setPreview(null);
      } catch {
        if (active) {
          setError('Published Product Type schemas could not be loaded.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [fixedProductTypeId]);

  if (!canManage) {
    return (
      <section className="catalog-page">
        <h1>Professional Article Import</h1>
        <p>Your administrator account does not have catalog.manage permission.</p>
      </section>
    );
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setSuccess('');
    setPreview(null);
    setInspect(null);
    setExcludedRows([]);
    setCorrections({});
    setDirtyAfterPreview(false);

    if (file.size > 6_000_000) {
      setError('Choose a CSV or XLSX file no larger than 6 MB.');
      return;
    }

    const nextFormat = inferFormat(file.name);
    if (!nextFormat) {
      setError('Choose a .csv or .xlsx Article data file.');
      return;
    }

    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await postJson<ProfessionalCatalogArticleImportInspect>(
        '/api/admin/products/import/file/inspect',
        {
          fileName: file.name,
          format: nextFormat,
          fileBase64: base64,
        },
      );
      setFileName(file.name);
      setFormat(nextFormat);
      setFileBase64(base64);
      setInspect(result);
      setDatasetReference((current) => current || file.name);
      setMapping((current) => ({
        ...current,
        name: bestHeader(result.headers, ['name', 'article name', 'description']),
        manufacturerPartNumber: bestHeader(result.headers, [
          'mpn',
          'manufacturer part number',
          'part number',
        ]),
        brand: bestHeader(result.headers, ['brand', 'manufacturer']),
        productType: bestHeader(result.headers, [
          'product type',
          'product_type',
          'generic article',
        ]),
        schemaVersion: bestHeader(result.headers, [
          'schema version',
          'schema_version',
        ]),
        description: bestHeader(result.headers, ['description', 'long description']),
        sourceReference: bestHeader(result.headers, [
          'source reference',
          'source_reference',
          'source id',
        ]),
      }));
    } catch (requestError) {
      setError(errorMessage(requestError, 'The import file could not be inspected.'));
    } finally {
      setBusy(false);
    }
  }

  async function previewImport() {
    setError('');
    setSuccess('');
    try {
      const request = buildRequest();
      setBusy(true);
      const result = await postJson<ProfessionalCatalogArticleImportPreview>(
        '/api/admin/products/import/file/preview',
        request,
      );
      setPreview(result);
      setDirtyAfterPreview(false);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The Article import preview failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!preview || dirtyAfterPreview || !preview.canCommit) return;

    setError('');
    setSuccess('');
    try {
      const request = buildRequest();
      setBusy(true);
      const result = await postJson<ProfessionalCatalogArticleImportCommit>(
        '/api/admin/products/import/file/commit',
        {
          ...request,
          expectedPreviewFingerprint: preview.previewFingerprint,
        },
      );
      setSuccess(
        `${result.createdCount} Manufacturer ${result.createdCount === 1 ? 'Article' : 'Articles'} imported in job ${result.jobId}.`,
      );
      setJobs((current) => [
        {
          id: result.jobId,
          datasetReference: result.datasetReference,
          fileName,
          fileFormat: format,
          previewFingerprint: result.previewFingerprint,
          totalRows: preview.totalRows,
          includedRows: preview.includedRows,
          excludedRows: result.excludedRows,
          warningRows: result.warningRows,
          createdCount: result.createdCount,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setPreview(null);
      setDirtyAfterPreview(false);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The Article import could not be committed.'));
    } finally {
      setBusy(false);
    }
  }

  function buildRequest(): ProfessionalCatalogArticleImportRequest {
    if (!inspect || !fileBase64) {
      throw new Error('Choose and inspect an Article import file first.');
    }
    if (!datasetReference.trim()) {
      throw new Error('Dataset reference is required for audit traceability.');
    }
    if (!mapping.name) {
      throw new Error('Map the Article Name source column before previewing.');
    }
    if (!fixedProductTypeId && !mapping.productType) {
      throw new Error(
        'Choose one fixed Product Type or map a Product Type source column.',
      );
    }
    if (!fixedSchemaVersion && !mapping.schemaVersion) {
      throw new Error(
        'Choose a published schema version or map a schema-version source column.',
      );
    }

    const manualAttributes = parseAttributeMappings(advancedAttributeMappings);
    const references = {
      productTypes: parseReferenceMap(productTypeReferences, 'Product Type'),
      brands: parseReferenceMap(brandReferences, 'Brand'),
      unitsOfMeasure: parseReferenceMap(unitReferences, 'Unit'),
    };

    return {
      datasetReference: datasetReference.trim(),
      fileName,
      format,
      fileBase64,
      mapping: {
        ...(mapping.rowKey ? { rowKey: mapping.rowKey } : {}),
        ...(!fixedProductTypeId && mapping.productType
          ? { productType: mapping.productType }
          : {}),
        ...(!fixedSchemaVersion && mapping.schemaVersion
          ? { schemaVersion: mapping.schemaVersion }
          : {}),
        ...(mapping.brand ? { brand: mapping.brand } : {}),
        ...(mapping.manufacturerPartNumber
          ? { manufacturerPartNumber: mapping.manufacturerPartNumber }
          : {}),
        ...(mapping.unitOfMeasure
          ? { unitOfMeasure: mapping.unitOfMeasure }
          : {}),
        ...(mapping.packQuantity
          ? { packQuantity: mapping.packQuantity }
          : {}),
        name: mapping.name,
        ...(mapping.description ? { description: mapping.description } : {}),
        ...(mapping.sourceReference
          ? { sourceReference: mapping.sourceReference }
          : {}),
        attributeColumns: {
          ...manualAttributes,
          ...Object.fromEntries(
            Object.entries(attributeColumns).filter(
              ([, header]) => Boolean(header),
            ),
          ),
        },
      },
      ...(Object.values(references).some(
        (map) => Object.keys(map).length > 0,
      )
        ? { references }
        : {}),
      defaults: {
        ...(fixedProductTypeId ? { productTypeId: fixedProductTypeId } : {}),
        ...(fixedSchemaVersion
          ? { schemaVersion: Number(fixedSchemaVersion) }
          : {}),
      },
      excludedRowNumbers: excludedRows,
      corrections: Object.entries(corrections).map(([rowNumber, cells]) => ({
        rowNumber: Number(rowNumber),
        cells,
      })),
    };
  }

  function toggleExcluded(rowNumber: number) {
    setExcludedRows((current) =>
      current.includes(rowNumber)
        ? current.filter((value) => value !== rowNumber)
        : [...current, rowNumber].sort((a, b) => a - b),
    );
    setDirtyAfterPreview(true);
  }

  function changeCorrection(
    rowNumber: number,
    header: string,
    value: string,
    _original: string,
  ) {
    setCorrections((current) => ({
      ...current,
      [rowNumber]: {
        ...(current[rowNumber] ?? {}),
        [header]: value,
      },
    }));
    setDirtyAfterPreview(true);
  }

  const canPreview =
    Boolean(inspect) &&
    Boolean(datasetReference.trim()) &&
    Boolean(mapping.name) &&
    Boolean(
      (fixedProductTypeId || mapping.productType) &&
        (fixedSchemaVersion || mapping.schemaVersion),
    );

  return (
    <section className="catalog-page article-import-v2">
      <AdminPageHeader
        eyebrow="Approved catalog ingestion"
        title="Professional Article Import"
        description="Inspect, map, validate and atomically import approved Manufacturer Article datasets. Commercial seller offers remain outside this workflow."
      />

      <CatalogPrimaryNav active="imports" />

      {error ? (
        <div className="alert alert--error" role="alert">{error}</div>
      ) : null}
      {success ? (
        <div className="alert alert--success" role="status">{success}</div>
      ) : null}

      <div className="article-import-steps" aria-label="Import workflow">
        <span className={inspect ? 'is-done' : 'is-current'}>1. Inspect file</span>
        <span className={preview ? 'is-done' : inspect ? 'is-current' : ''}>
          2. Map &amp; preview
        </span>
        <span className={preview?.canCommit ? 'is-current' : ''}>3. Commit</span>
      </div>

      <section className="article-import-card">
        <div className="article-import-card__heading">
          <div>
            <strong>Source file</strong>
            <small>CSV or XLSX · up to 6 MB · 500 data rows per job</small>
          </div>
          {inspect ? (
            <span className="article-import-badge">
              {inspect.totalRows} rows · {inspect.headers.length} columns
            </span>
          ) : null}
        </div>

        <div className="article-import-file-grid">
          <label className="catalog-filter">
            <span>Dataset reference</span>
            <input
              value={datasetReference}
              maxLength={200}
              placeholder="Supplier release, catalog batch or file reference"
              onChange={(event) => {
                setDatasetReference(event.target.value);
                if (preview) setDirtyAfterPreview(true);
              }}
            />
          </label>
          <label className="catalog-filter">
            <span>Article data file</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </label>
          <div className="article-import-file-meta">
            <span>{fileName || 'No file inspected'}</span>
            <small>
              {inspect?.sheetName ? `Worksheet: ${inspect.sheetName}` : format}
            </small>
          </div>
        </div>
      </section>

      {inspect ? (
        <section className="article-import-card">
          <div className="article-import-card__heading">
            <div>
              <strong>Business mapping</strong>
              <small>
                Fix one Product Type for the whole job when possible. Use source-column mapping only for mixed datasets.
              </small>
            </div>
          </div>

          <div className="article-import-mapping-grid">
            <label>
              <span>Fixed Product Type</span>
              <select
                value={fixedProductTypeId}
                disabled={loadingMaster}
                onChange={(event) => {
                  setFixedProductTypeId(event.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Mixed file — map source column</option>
                {productTypes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.code}
                  </option>
                ))}
              </select>
            </label>

            {fixedProductTypeId ? (
              <label>
                <span>Published schema</span>
                <select
                  value={fixedSchemaVersion}
                  onChange={(event) => {
                    setFixedSchemaVersion(event.target.value);
                    setPreview(null);
                  }}
                >
                  {schemas.map((schema) => (
                    <option value={schema.schemaVersion} key={schema.id}>
                      Version {schema.schemaVersion}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <ColumnSelect
                  label="Product Type column"
                  value={mapping.productType}
                  headers={inspect.headers}
                  onChange={(value) =>
                    setMapping((current) => ({ ...current, productType: value }))
                  }
                />
                <ColumnSelect
                  label="Schema version column"
                  value={mapping.schemaVersion}
                  headers={inspect.headers}
                  onChange={(value) =>
                    setMapping((current) => ({ ...current, schemaVersion: value }))
                  }
                />
              </>
            )}

            <ColumnSelect
              label="Article name"
              required
              value={mapping.name}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, name: value }))
              }
            />
            <ColumnSelect
              label="Manufacturer part number"
              value={mapping.manufacturerPartNumber}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({
                  ...current,
                  manufacturerPartNumber: value,
                }))
              }
            />
            <ColumnSelect
              label="Brand"
              value={mapping.brand}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, brand: value }))
              }
            />
            <ColumnSelect
              label="Description"
              value={mapping.description}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, description: value }))
              }
            />
            <ColumnSelect
              label="Row key"
              value={mapping.rowKey}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, rowKey: value }))
              }
            />
            <ColumnSelect
              label="Source reference"
              value={mapping.sourceReference}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, sourceReference: value }))
              }
            />
            <ColumnSelect
              label="Unit of measure"
              value={mapping.unitOfMeasure}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, unitOfMeasure: value }))
              }
            />
            <ColumnSelect
              label="Pack quantity"
              value={mapping.packQuantity}
              headers={inspect.headers}
              onChange={(value) =>
                setMapping((current) => ({ ...current, packQuantity: value }))
              }
            />
          </div>

          {schemaAttributes.length > 0 ? (
            <div className="article-import-attribute-map">
              <div>
                <strong>Technical criteria</strong>
                <small>
                  Map source columns to the selected Product Type schema. Required criteria are marked.
                </small>
              </div>
              <div className="article-import-attribute-grid">
                {schemaAttributes.map((attribute) => (
                  <ColumnSelect
                    key={attribute.code}
                    label={
                      attribute.name +
                      (attribute.requirement === 'MANDATORY' ? ' · Required' : '')
                    }
                    value={attributeColumns[attribute.code] ?? ''}
                    headers={inspect.headers}
                    onChange={(value) => {
                      setAttributeColumns((current) => ({
                        ...current,
                        [attribute.code]: value,
                      }));
                      setPreview(null);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <details className="article-import-advanced">
            <summary>Advanced mappings for mixed/provider-coded files</summary>
            <div className="article-import-advanced-grid">
              <label>
                <span>Product Type reference map</span>
                <textarea
                  value={productTypeReferences}
                  placeholder={'{"provider-code":"canonical-product-type-uuid"}'}
                  onChange={(event) => setProductTypeReferences(event.target.value)}
                />
              </label>
              <label>
                <span>Brand reference map</span>
                <textarea
                  value={brandReferences}
                  placeholder={'{"BOSCH":"canonical-brand-uuid"}'}
                  onChange={(event) => setBrandReferences(event.target.value)}
                />
              </label>
              <label>
                <span>Unit reference map</span>
                <textarea
                  value={unitReferences}
                  placeholder={'{"PCS":"canonical-unit-uuid"}'}
                  onChange={(event) => setUnitReferences(event.target.value)}
                />
              </label>
              <label>
                <span>Additional Attribute mappings</span>
                <textarea
                  value={advancedAttributeMappings}
                  placeholder={'ATTRIBUTE_CODE=Source Header\nSECOND_ATTRIBUTE=Other Header'}
                  onChange={(event) =>
                    setAdvancedAttributeMappings(event.target.value)
                  }
                />
              </label>
            </div>
          </details>

          <div className="article-import-actions">
            <span>
              Preview performs no writes and reuses the same Article validation used by normal creation.
            </span>
            <button
              className="button button--primary"
              type="button"
              disabled={busy || !canPreview}
              onClick={() => void previewImport()}
            >
              {busy ? 'Validating…' : preview ? 'Re-preview import' : 'Preview import'}
            </button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="article-import-card">
          <div className="article-import-card__heading">
            <div>
              <strong>Normalized preview</strong>
              <small>
                Correct cells or exclude rows, then re-preview before commit.
              </small>
            </div>
            <div className="article-import-preview-summary">
              <span>{preview.totalRows} source</span>
              <span>{preview.validRows} valid</span>
              <span className={preview.invalidRows ? 'is-invalid' : ''}>
                {preview.invalidRows} invalid
              </span>
              <span className={preview.warningRows ? 'is-warning' : ''}>
                {preview.warningRows} warning
              </span>
              <span>{preview.excludedRows} excluded</span>
            </div>
          </div>

          {dirtyAfterPreview ? (
            <div className="alert alert--warning">
              Rows changed after preview. Re-preview to generate a new reviewed fingerprint.
            </div>
          ) : null}

          <div className="article-import-table-wrap">
            <table className="article-import-table">
              <thead>
                <tr>
                  <th>Use</th>
                  <th>Row</th>
                  <th>Identity</th>
                  <th>Source values</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr
                    key={row.sourceRowNumber}
                    className={
                      row.errors.length > 0
                        ? 'is-invalid'
                        : row.warnings.length > 0
                          ? 'is-warning'
                          : undefined
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={!excludedRows.includes(row.sourceRowNumber)}
                        aria-label={`Include source row ${row.sourceRowNumber}`}
                        onChange={() => toggleExcluded(row.sourceRowNumber)}
                      />
                    </td>
                    <td>
                      <strong>#{row.sourceRowNumber}</strong>
                      <small>{row.rowKey}</small>
                    </td>
                    <td>
                      <span>{row.normalizedManufacturerPartNumber || 'No MPN'}</span>
                      <small>{row.duplicateAssessment}</small>
                    </td>
                    <td>
                      <div className="article-import-cell-grid">
                        {Object.entries(row.sourceCells).map(([header, value]) => (
                          <label key={header}>
                            <span>{header}</span>
                            <input
                              value={
                                corrections[row.sourceRowNumber]?.[header] ?? value
                              }
                              disabled={excludedRows.includes(row.sourceRowNumber)}
                              onChange={(event) =>
                                changeCorrection(
                                  row.sourceRowNumber,
                                  header,
                                  event.target.value,
                                  value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      {row.errors.length === 0 && row.warnings.length === 0 ? (
                        <span className="article-import-ok">Ready</span>
                      ) : null}
                      {row.errors.map((item) => (
                        <small className="article-import-error" key={item}>
                          {item}
                        </small>
                      ))}
                      {row.warnings.map((item) => (
                        <small className="article-import-warning" key={item}>
                          {item}
                        </small>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="article-import-actions">
            <span>
              Fingerprint {preview.previewFingerprint.slice(0, 12)}… protects the reviewed batch from commit drift.
            </span>
            <div>
              {dirtyAfterPreview ? (
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => void previewImport()}
                >
                  Re-preview changes
                </button>
              ) : null}
              <button
                className="button button--primary"
                type="button"
                disabled={
                  busy ||
                  dirtyAfterPreview ||
                  !preview.canCommit ||
                  preview.invalidRows > 0
                }
                onClick={() => void commitImport()}
              >
                {busy ? 'Committing…' : `Commit ${preview.includedRows} Articles`}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="article-import-card">
        <div className="article-import-card__heading">
          <div>
            <strong>Recent import jobs</strong>
            <small>Committed jobs are immutable audit records.</small>
          </div>
        </div>
        {jobs.length === 0 ? (
          <div className="catalog-empty">
            <p>No professional Article import jobs have been committed yet.</p>
          </div>
        ) : (
          <div className="article-import-job-list">
            {jobs.slice(0, 12).map((job) => (
              <div key={job.id}>
                <span>
                  <strong>{job.datasetReference}</strong>
                  <small>{job.fileName} · {job.fileFormat}</small>
                </span>
                <span>
                  <strong>{job.createdCount}</strong>
                  <small>created</small>
                </span>
                <span>
                  <strong>{job.excludedRows}</strong>
                  <small>excluded</small>
                </span>
                <span>
                  <strong>{job.warningRows}</strong>
                  <small>warnings</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}{required ? ' *' : ''}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not mapped</option>
        {headers.map((header) => (
          <option value={header} key={header}>{header}</option>
        ))}
      </select>
    </label>
  );
}

function inferFormat(fileName: string): ImportFormat | null {
  const normalized = fileName.toLocaleLowerCase('en-US');
  if (normalized.endsWith('.csv')) return 'CSV';
  if (normalized.endsWith('.xlsx')) return 'XLSX';
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function bestHeader(headers: string[], candidates: string[]): string {
  const normalizedCandidates = candidates.map((value) =>
    value.toLocaleLowerCase('en-US'),
  );
  return (
    headers.find((header) =>
      normalizedCandidates.includes(
        header.trim().toLocaleLowerCase('en-US'),
      ),
    ) ?? ''
  );
}

function parseReferenceMap(
  value: string,
  label: string,
): Record<string, string> {
  if (!value.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} reference map must be valid JSON.`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.values(parsed as Record<string, unknown>).some(
      (item) => typeof item !== 'string',
    )
  ) {
    throw new Error(`${label} reference map must be a JSON object of string values.`);
  }
  return parsed as Record<string, string>;
}

function parseAttributeMappings(value: string): Record<string, string> {
  if (!value.trim()) return {};
  const result: Record<string, string> = {};
  for (const [index, line] of value.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    const separator = line.indexOf('=');
    if (separator <= 0 || separator === line.length - 1) {
      throw new Error(
        `Attribute mapping line ${index + 1} must use ATTRIBUTE_CODE=Source Header.`,
      );
    }
    const code = line.slice(0, separator).trim();
    const header = line.slice(separator + 1).trim();
    if (!code || !header) {
      throw new Error(
        `Attribute mapping line ${index + 1} requires both an Attribute code and source header.`,
      );
    }
    result[code] = header;
  }
  return result;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
