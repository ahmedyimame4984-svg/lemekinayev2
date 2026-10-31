'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import type {
  VehicleIdentificationMethod,
  VehicleIdentifierCandidate,
  VehicleIdentifierResolution,
} from '@/lib/vehicle-identification-contracts';
import { AdminPageHeader } from './admin-page-header';
import { VehicleAdminNav } from './vehicle-admin-nav';
import { VinDecoderResult } from './vin-decoder-result';
import { useAdminPrincipal } from './admin-session';

type TypeSelection = 'AUTO' | VehicleIdentificationMethod;

export function VehicleIdentificationLookup({
  initialIdentifier = '',
  initialType = 'AUTO',
}: {
  initialIdentifier?: string;
  initialType?: TypeSelection;
}) {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('vehicle.manage');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [identifierType, setIdentifierType] =
    useState<TypeSelection>(initialType);
  const [modelYear, setModelYear] = useState('');
  const [result, setResult] = useState<VehicleIdentifierResolution | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizedPreview = useMemo(
    () => identifier.trim().toUpperCase(),
    [identifier],
  );

  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = identifier.trim();
    if (!value) {
      setError(
        'Enter a VIN, chassis number, frame number, or other vehicle identifier.',
      );
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body: {
        identifier: string;
        identifierType?: VehicleIdentificationMethod;
        modelYear?: number;
      } = { identifier: value };

      if (identifierType !== 'AUTO') {
        body.identifierType = identifierType;
      }

      if (modelYear.trim()) {
        const year = Number(modelYear);
        if (!Number.isInteger(year) || year < 1886 || year > 2200) {
          throw new Error(
            'Model year must be a valid four-digit vehicle year.',
          );
        }
        body.modelYear = year;
      }

      const response = await fetch(
        '/api/admin/vehicles/identification/resolve',
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        VehicleIdentifierResolution | { error?: { message?: string } } | null;

      if (!response.ok) {
        throw new Error(
          payload && 'error' in payload && payload.error?.message
            ? payload.error.message
            : 'Vehicle identification lookup failed.',
        );
      }

      if (
        !payload ||
        !('status' in payload) ||
        !Array.isArray(payload.candidates)
      ) {
        throw new Error(
          'Vehicle identification returned an incomplete response. Try the lookup again.',
        );
      }
      setResult(payload);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Vehicle identification lookup failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setIdentifier('');
    setIdentifierType('AUTO');
    setModelYear('');
    setResult(null);
    setError('');
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Vehicle identification"
          title="VIN / Chassis Lookup"
          description="Vehicle identifier resolution requires vehicle.manage because resolved identifiers lead directly to canonical configured-vehicle records."
        />
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have vehicle.manage.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page vehicle-identification-page">
      <AdminPageHeader
        eyebrow="Vehicle identification"
        title="VIN / Chassis Lookup"
        description="Decode a standard VIN and review its vehicle details and configured-vehicle matches. Chassis and frame lookups use verified identifier mappings."
      />

      <VehicleAdminNav active="identification" />

      <section className="vehicle-identification-lookup">
        <form onSubmit={resolve}>
          <div className="vehicle-identification-input">
            <label htmlFor="vehicle-identifier">Vehicle identifier</label>
            <input
              id="vehicle-identifier"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={128}
              disabled={loading}
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setResult(null);
                setError('');
              }}
              placeholder="JTDBU4EE9B9123456 or NZE121-0123456"
            />
            <small>
              {normalizedPreview
                ? `Normalized preview: ${normalizedPreview}`
                : 'Standard 17-character VINs can be detected automatically.'}
            </small>
          </div>

          <label>
            <span>Identifier type</span>
            <select
              disabled={loading}
              value={identifierType}
              onChange={(event) => {
                setIdentifierType(event.target.value as TypeSelection);
                setResult(null);
                setError('');
              }}
            >
              <option value="AUTO">Auto-detect standard VIN</option>
              <option value="VIN">VIN</option>
              <option value="CHASSIS">Chassis number</option>
              <option value="FRAME">Frame number</option>
              <option value="OTHER">Other approved identifier</option>
            </select>
          </label>

          <label>
            <span>Model year hint</span>
            <input
              type="number"
              min={1886}
              max={2200}
              inputMode="numeric"
              value={modelYear}
              onChange={(event) => {
                setModelYear(event.target.value);
                setResult(null);
                setError('');
              }}
              placeholder="Optional"
              disabled={loading}
            />
          </label>

          <div className="vehicle-identification-actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Looking up…'
                : identifierType === 'AUTO' || identifierType === 'VIN'
                  ? 'Decode & resolve VIN'
                  : 'Look up identifier'}
            </button>
            <button
              className="button button--quiet"
              type="button"
              disabled={loading || (!identifier && !result)}
              onClick={reset}
            >
              Clear
            </button>
          </div>
        </form>

        <div className="vehicle-identification-policy">
          <strong>Resolution order</strong>
          <span>1. Verified canonical mapping</span>
          <span>2. VIN decoder provider</span>
          <span>3. Canonical configured-vehicle match</span>
          <small>
            No automatic guessing is used when identifier type or vehicle
            evidence is insufficient.
          </small>
        </div>
      </section>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Resolving identifier against canonical vehicle identity…</p>
        </div>
      ) : null}

      {result && !loading ? (
        <>
          <ResolutionSummary result={result} />
          <VinDecoderResult result={result} />

          {result.candidates.length > 0 ? (
            <section className="catalog-card vehicle-identification-candidates">
              <div className="catalog-section-heading">
                <div>
                  <span className="eyebrow">Canonical candidates</span>
                  <h2>
                    {result.status === 'EXACT_MATCH'
                      ? 'Matched configured vehicle'
                      : result.candidateCount === 1
                        ? 'Candidate configured vehicle'
                        : 'Candidate configured vehicles'}
                  </h2>
                  <p>
                    Open the canonical vehicle record to inspect or maintain the
                    structured Make → Model → Generation → Trim → Configuration
                    identity.
                  </p>
                </div>
                <span className="catalog-count">{result.candidateCount}</span>
              </div>

              <div className="vehicle-identification-candidate-list">
                {result.candidates.map((candidate) => (
                  <CandidateCard candidate={candidate} key={candidate.id} />
                ))}
              </div>

              {result.candidateCount > result.candidates.length ? (
                <p className="vehicle-identification-more">
                  {result.candidateCount - result.candidates.length} additional
                  candidate
                  {result.candidateCount - result.candidates.length === 1
                    ? ''
                    : 's'}{' '}
                  exist. Refine the identifier evidence before selecting a
                  canonical vehicle.
                </p>
              ) : null}
            </section>
          ) : (
            <ResolutionEmpty result={result} />
          )}
        </>
      ) : null}
    </section>
  );
}

function ResolutionSummary({
  result,
}: {
  result: VehicleIdentifierResolution;
}) {
  const sourceLabel =
    result.resolutionSource === 'VERIFIED_MAPPING'
      ? 'Verified mapping'
      : result.resolutionSource === 'VIN_PROVIDER'
        ? 'VIN provider'
        : 'No resolution source';

  return (
    <section className="vehicle-identification-summary">
      <article
        className={`vehicle-identification-status vehicle-identification-status--${result.status.toLowerCase()}`}
      >
        <span>Status</span>
        <strong>{formatAdminEnumLabel(result.status)}</strong>
        <small>{statusExplanation(result.status)}</small>
      </article>

      <article>
        <span>Identifier</span>
        <strong>{result.normalizedIdentifier || '—'}</strong>
        <small>
          {result.identifierType
            ? formatAdminEnumLabel(result.identifierType)
            : 'Type not resolved'}
        </small>
      </article>

      <article>
        <span>Resolution source</span>
        <strong>{sourceLabel}</strong>
        <small>{result.provider ?? 'No external provider used'}</small>
      </article>

      <article>
        <span>Canonical candidates</span>
        <strong>{result.candidateCount}</strong>
        <small>
          {result.candidateCount === 1
            ? 'One configuration candidate'
            : 'Configured-vehicle matches'}
        </small>
      </article>

      <article className="vehicle-identification-evidence">
        <span>Available lookup evidence</span>
        <strong>
          {result.matchedFields.length > 0
            ? result.matchedFields.map(formatEvidence).join(' · ')
            : 'No vehicle evidence returned'}
        </strong>
        <small>
          {result.resolutionSource === 'NONE'
            ? 'No decoder or verified mapping supplied vehicle evidence.'
            : result.warnings?.length
              ? 'Provider warnings require verification before confirming an exact match.'
              : result.missingForExactMatch.length > 0
                ? `Missing for exact VIN match: ${result.missingForExactMatch
                    .map(formatEvidence)
                    .join(', ')}`
                : result.resolutionSource === 'VERIFIED_MAPPING'
                  ? 'Exact identity confirmed by a verified mapping.'
                  : 'Required decoder fields are present; canonical match status is shown above.'}
        </small>
      </article>
    </section>
  );
}

function CandidateCard({
  candidate,
}: {
  candidate: VehicleIdentifierCandidate;
}) {
  const hierarchy = [
    candidate.make.name,
    candidate.model.name,
    candidate.modelYear ? String(candidate.modelYear) : null,
    candidate.derivative?.name,
    candidate.generation.name,
    candidate.trim.name,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' › ');
  const powertrain = [
    candidate.engine.code ?? candidate.engine.name,
    candidate.transmission.code ?? candidate.transmission.transmissionType,
    candidate.bodyType?.name,
    candidate.market?.name,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' · ');

  return (
    <article>
      <div className="vehicle-identification-candidate__identity">
        <span className="eyebrow">Configured Vehicle</span>
        <strong>{hierarchy}</strong>
        <small>{powertrain}</small>
      </div>
      <div className="vehicle-identification-candidate__meta">
        <span>{formatAdminEnumLabel(candidate.status)}</span>
        <span>{candidate.steeringSide ?? 'Steering not specified'}</span>
        <span>{candidate.code ?? candidate.id}</span>
      </div>
      <a
        className="button button--secondary"
        href={`/admin/vehicles/configurations?${new URLSearchParams({
          configurationId: candidate.id,
        }).toString()}`}
      >
        Open configured vehicle
      </a>
    </article>
  );
}

function ResolutionEmpty({ result }: { result: VehicleIdentifierResolution }) {
  return (
    <div className="catalog-empty">
      <h3>{emptyTitle(result.status)}</h3>
      <p>{statusExplanation(result.status)}</p>
      {result.status === 'TYPE_REQUIRED' ? (
        <p>Select Chassis, Frame, or Other for a non-standard identifier.</p>
      ) : null}
      {result.status === 'PARTIAL_MATCH' &&
      result.missingForExactMatch.length > 0 ? (
        <p>
          Missing evidence:{' '}
          {result.missingForExactMatch.map(formatEvidence).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}

function formatEvidence(value: string): string {
  if (value === 'verifiedIdentifierMapping')
    return 'Verified identifier mapping';
  const aliases: Record<string, string> = {
    make: 'Make',
    model: 'Model',
    modelYear: 'Model year',
    derivative: 'Derivative',
    generation: 'Generation',
    trim: 'Trim',
    engine: 'Engine',
    transmission: 'Transmission',
    bodyType: 'Body type',
    market: 'Market',
    steeringSide: 'Steering side',
  };
  return aliases[value] ?? formatAdminEnumLabel(value);
}

function emptyTitle(status: VehicleIdentifierResolution['status']): string {
  switch (status) {
    case 'INVALID_IDENTIFIER':
      return 'Identifier is invalid';
    case 'TYPE_REQUIRED':
      return 'Identifier type is required';
    case 'DECODE_FAILED':
      return 'VIN decoding failed';
    case 'NO_MATCH':
      return 'No canonical vehicle match';
    case 'PARTIAL_MATCH':
      return 'More vehicle evidence is needed';
    default:
      return 'No candidate vehicle available';
  }
}

function statusExplanation(
  status: VehicleIdentifierResolution['status'],
): string {
  switch (status) {
    case 'EXACT_MATCH':
      return 'The identifier resolved to one canonical configured vehicle with sufficient exact-match evidence.';
    case 'PARTIAL_MATCH':
      return 'The identifier was valid, but the available evidence is not sufficient for an exact canonical match.';
    case 'MULTIPLE_MATCHES':
      return 'More than one canonical configured vehicle matches the available identifier evidence.';
    case 'NO_MATCH':
      return 'The identifier is valid, but no active canonical configured vehicle currently matches it.';
    case 'DECODE_FAILED':
      return 'The standard VIN was valid, but the configured decoder provider did not return usable vehicle evidence.';
    case 'INVALID_IDENTIFIER':
      return 'The supplied identifier does not satisfy the validation rules for the selected identifier type.';
    case 'TYPE_REQUIRED':
      return 'The value is not a standard VIN. Select the correct non-VIN identifier type before resolving it.';
  }
}
