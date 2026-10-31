/** Import boundary for Ethiopia LHD v1. Deliberately independent of Prisma/UI. */
export const VEHICLE_DATA_STANDARD = 'ETHIOPIA_LHD_V1' as const;

type Row = Record<string, unknown>;
export type VehicleManifestCollection =
  | 'sources'
  | 'markets'
  | 'makes'
  | 'models'
  | 'derivatives'
  | 'generations'
  | 'trims'
  | 'engines'
  | 'transmissions'
  | 'bodyTypes'
  | 'configurations';
export interface VehicleManifestIssue {
  path: string;
  code: string;
  message: string;
}
export interface VehicleManifestValidation {
  valid: boolean;
  standard: typeof VEHICLE_DATA_STANDARD;
  issues: VehicleManifestIssue[];
  counts: Record<VehicleManifestCollection, number>;
}

const fields: Record<VehicleManifestCollection, readonly string[]> = {
  sources: [
    'key',
    'sourceName',
    'sourceReference',
    'sourceUrl',
    'observedAt',
    'publishedAt',
    'kind',
    'verificationState',
    'verificationReference',
    'notes',
  ],
  markets: [
    'key',
    'code',
    'name',
    'kind',
    'countryCode',
    'regionCode',
    'specificationReference',
    'status',
    'sourceKeys',
  ],
  makes: ['key', 'code', 'name', 'status', 'sourceKeys'],
  models: ['key', 'code', 'name', 'makeKey', 'status', 'sourceKeys'],
  derivatives: ['key', 'code', 'name', 'modelKey', 'status', 'sourceKeys'],
  generations: [
    'key',
    'code',
    'name',
    'modelKey',
    'derivativeKey',
    'startYear',
    'endYear',
    'endStatus',
    'status',
    'sourceKeys',
  ],
  trims: [
    'key',
    'code',
    'name',
    'generationKey',
    'startYear',
    'endYear',
    'status',
    'sourceKeys',
  ],
  engines: [
    'key',
    'code',
    'name',
    'family',
    'displacementCc',
    'fuelType',
    'cylinderCount',
    'aspiration',
    'powerKw',
    'torqueNm',
    'startYear',
    'endYear',
    'status',
    'sourceKeys',
  ],
  transmissions: [
    'key',
    'code',
    'name',
    'transmissionType',
    'gearCount',
    'startYear',
    'endYear',
    'status',
    'sourceKeys',
  ],
  bodyTypes: ['key', 'code', 'name', 'status', 'sourceKeys'],
  configurations: [
    'key',
    'code',
    'makeKey',
    'modelKey',
    'generationKey',
    'trimKey',
    'engineKey',
    'transmissionKey',
    'bodyTypeKey',
    'powertrainType',
    'driveType',
    'materialMarketVariant',
    'marketApplicability',
    'ethiopiaRelevance',
    'productionStartYear',
    'productionStartMonth',
    'productionEndYear',
    'productionEndMonth',
    'productionEndStatus',
    'modelYear',
    'steeringSide',
    'status',
    'sourceKeys',
  ],
};
export const VEHICLE_MANIFEST_COLLECTIONS = Object.keys(
  fields,
) as VehicleManifestCollection[];
const record = (value: unknown): Row | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : null;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const year = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1886 && Number(value) <= 2100;
const open = (value: unknown): boolean => value === null || value === undefined;

export function validateVehicleProductionManifest(
  input: unknown,
): VehicleManifestValidation {
  const issues: VehicleManifestIssue[] = [];
  const issue = (path: string, code: string, message: string) => {
    issues.push({ path, code, message });
  };
  const counts = Object.fromEntries(
    VEHICLE_MANIFEST_COLLECTIONS.map((key) => [key, 0]),
  ) as Record<VehicleManifestCollection, number>;
  const root = record(input);
  if (!root)
    return {
      valid: false,
      standard: VEHICLE_DATA_STANDARD,
      issues: [
        {
          path: '$',
          code: 'INVALID_MANIFEST',
          message: 'Manifest must be an object',
        },
      ],
      counts,
    };
  if (root.standard !== VEHICLE_DATA_STANDARD)
    issue('standard', 'STANDARD_REQUIRED', `Expected ${VEHICLE_DATA_STANDARD}`);
  if (!text(root.datasetId))
    issue(
      'datasetId',
      'DATASET_ID_REQUIRED',
      'A stable dataset revision identifier is required',
    );
  if (root.targetCountry !== 'ET')
    issue('targetCountry', 'TARGET_REQUIRED', 'The target country must be ET');
  const topFields = new Set([
    'standard',
    'datasetId',
    'targetCountry',
    ...VEHICLE_MANIFEST_COLLECTIONS,
  ]);
  for (const key of Object.keys(root))
    if (!topFields.has(key))
      issue(key, 'UNKNOWN_FIELD', 'Unsupported manifest field');

  const indexes = new Map<VehicleManifestCollection, Map<string, Row>>();
  const rows = new Map<
    VehicleManifestCollection,
    Array<{ path: string; row: Row }>
  >();
  for (const collection of VEHICLE_MANIFEST_COLLECTIONS) {
    const values = root[collection];
    const index = new Map<string, Row>();
    const entries: Array<{ path: string; row: Row }> = [];
    indexes.set(collection, index);
    rows.set(collection, entries);
    if (!Array.isArray(values)) {
      issue(
        collection,
        'COLLECTION_REQUIRED',
        'Expected an array, including for empty collections',
      );
      continue;
    }
    counts[collection] = values.length;
    values.forEach((value, position) => {
      const path = `${collection}[${position}]`;
      const row = record(value);
      if (!row) {
        issue(path, 'INVALID_RECORD', 'Expected an object');
        return;
      }
      entries.push({ path, row });
      for (const key of Object.keys(row))
        if (!fields[collection].includes(key))
          issue(
            `${path}.${key}`,
            'UNKNOWN_FIELD',
            'Unsupported data; cosmetic and seller fields are prohibited',
          );
      if (!text(row.key))
        issue(
          `${path}.key`,
          'KEY_REQUIRED',
          'A stable collection-local key is required',
        );
      else if (index.has(row.key))
        issue(`${path}.key`, 'DUPLICATE_KEY', 'Key is repeated');
      else index.set(row.key, row);
      if (collection !== 'sources') {
        const maxLength = collection === 'configurations' ? 80 : 50;
        if (
          !text(row.code) ||
          !/^[A-Z0-9][A-Z0-9_]*$/.test(row.code) ||
          row.code.length > maxLength
        )
          issue(
            `${path}.code`,
            'CANONICAL_CODE_REQUIRED',
            `Use a canonical code of at most ${maxLength} characters`,
          );
        if (
          collection !== 'configurations' &&
          (!text(row.name) || row.name.length > 120)
        )
          issue(
            `${path}.name`,
            'NAME_REQUIRED',
            'Name must contain 1–120 characters',
          );
        if (!['DRAFT', 'ACTIVE'].includes(String(row.status)))
          issue(
            `${path}.status`,
            'INVALID_IMPORT_STATUS',
            'New canonical imports accept DRAFT or ACTIVE only',
          );
      }
    });
  }
  const resolve = (
    collection: VehicleManifestCollection,
    key: unknown,
    path: string,
  ): Row | undefined => {
    const row =
      typeof key === 'string' ? indexes.get(collection)?.get(key) : undefined;
    if (!row) issue(path, 'INVALID_REFERENCE', `Unknown ${collection} key`);
    else if (row.status !== 'ACTIVE')
      issue(
        path,
        'INACTIVE_REFERENCE',
        'Canonical dependencies must be ACTIVE',
      );
    return row;
  };
  const range = (
    row: Row,
    path: string,
    startField = 'startYear',
    endField = 'endYear',
    requiredStart = false,
  ) => {
    const start = row[startField];
    const end = row[endField];
    if ((requiredStart || !open(start)) && !year(start))
      issue(
        `${path}.${startField}`,
        'INVALID_YEAR',
        'Expected a year between 1886 and 2100',
      );
    if (!open(end) && !year(end))
      issue(
        `${path}.${endField}`,
        'INVALID_YEAR',
        'Expected a year between 1886 and 2100',
      );
    if (!open(end) && open(start))
      issue(path, 'MISSING_START', 'An end year requires a start year');
    if (year(start) && year(end) && start > end)
      issue(path, 'REVERSED_RANGE', 'Production start is after production end');
  };
  const contained = (
    start: unknown,
    end: unknown,
    parent: Row | undefined,
    path: string,
  ) => {
    if (!parent) return;
    if (year(parent.startYear) && (!year(start) || start < parent.startYear))
      issue(
        path,
        'OUTSIDE_PARENT_RANGE',
        'Start must fall within the parent range',
      );
    if (year(parent.endYear) && (!year(end) || end > parent.endYear))
      issue(
        path,
        'OUTSIDE_PARENT_RANGE',
        'A closed parent requires a contained, closed child range',
      );
  };
  const endSemantics = (
    row: Row,
    path: string,
    endField: string,
    statusField: string,
  ) => {
    const state = row[statusField];
    const end = row[endField];
    if (!['ENDED', 'CURRENT', 'UNKNOWN'].includes(String(state)))
      issue(
        path,
        'END_STATUS_REQUIRED',
        'An explicit production end status is required',
      );
    if (state === 'ENDED' && !year(end))
      issue(path, 'END_YEAR_REQUIRED', 'ENDED requires an end year');
    if ((state === 'CURRENT' || state === 'UNKNOWN') && !open(end))
      issue(
        path,
        'END_STATUS_CONTRADICTION',
        'CURRENT/UNKNOWN cannot have an end date',
      );
  };
  const naturalKeys = new Map<string, string>();
  for (const collection of VEHICLE_MANIFEST_COLLECTIONS) {
    for (const { row, path } of rows.get(collection) ?? []) {
      if (collection === 'sources') {
        if (!text(row.sourceName) || row.sourceName.length > 160)
          issue(
            path,
            'SOURCE_NAME_REQUIRED',
            'Source name must contain 1–160 characters',
          );
        if (!text(row.sourceReference) && !text(row.sourceUrl))
          issue(
            path,
            'SOURCE_LOCATOR_REQUIRED',
            'A retrievable document reference or URL is required',
          );
        if (
          !open(row.sourceReference) &&
          (!text(row.sourceReference) || row.sourceReference.length > 255)
        )
          issue(
            path,
            'INVALID_SOURCE_REFERENCE',
            'Reference must contain 1–255 characters',
          );
        if (!open(row.sourceUrl)) {
          try {
            const url = new URL(String(row.sourceUrl));
            if (
              !['http:', 'https:'].includes(url.protocol) ||
              String(row.sourceUrl).length > 1000
            )
              throw new Error();
          } catch {
            issue(
              path,
              'INVALID_SOURCE_URL',
              'Expected an HTTP(S) source URL of at most 1000 characters',
            );
          }
        }
        for (const field of ['observedAt', 'publishedAt'])
          if (
            !open(row[field]) &&
            (typeof row[field] !== 'string' ||
              !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(String(row[field])) ||
              !Number.isFinite(Date.parse(String(row[field]))))
          )
            issue(
              `${path}.${field}`,
              'INVALID_SOURCE_DATE',
              'Use an ISO date; omit unknown dates',
            );
        if (
          ![
            'OEM',
            'OFFICIAL_DISTRIBUTOR',
            'HOMOLOGATION',
            'SECONDARY',
          ].includes(String(row.kind))
        )
          issue(
            path,
            'SOURCE_KIND_REQUIRED',
            'Source authority must be explicit',
          );
        if (
          !['UNVERIFIED', 'REVIEWED', 'VERIFIED', 'REJECTED'].includes(
            String(row.verificationState),
          )
        )
          issue(
            path,
            'VERIFICATION_STATE_REQUIRED',
            'Verification state must be explicit',
          );
        if (
          row.verificationState === 'VERIFIED' &&
          (row.kind === 'SECONDARY' || !text(row.verificationReference))
        )
          issue(
            path,
            'UNJUSTIFIED_VERIFICATION',
            'VERIFIED requires primary evidence and a review reference',
          );
        continue;
      }
      const sourceKeys = row.sourceKeys;
      if (
        !Array.isArray(sourceKeys) ||
        sourceKeys.length === 0 ||
        sourceKeys.some((key) => typeof key !== 'string')
      )
        issue(
          `${path}.sourceKeys`,
          'PROVENANCE_REQUIRED',
          'Every canonical master record requires source keys',
        );
      else {
        let verified = false;
        for (const key of sourceKeys) {
          const source = indexes.get('sources')?.get(String(key));
          if (!source || source.verificationState === 'REJECTED')
            issue(
              `${path}.sourceKeys`,
              'INVALID_PROVENANCE',
              'Missing or rejected source',
            );
          if (
            source?.verificationState === 'VERIFIED' &&
            source.kind !== 'SECONDARY' &&
            text(source.verificationReference)
          )
            verified = true;
        }
        if (new Set(sourceKeys).size !== sourceKeys.length)
          issue(
            `${path}.sourceKeys`,
            'DUPLICATE_PROVENANCE',
            'Source assignments must be unique',
          );
        if (row.status === 'ACTIVE' && !verified)
          issue(
            path,
            'VERIFIED_PROVENANCE_REQUIRED',
            'ACTIVE imports require at least one verified authoritative source',
          );
      }
      let scope: unknown[] = [];
      if (collection === 'models') {
        resolve('makes', row.makeKey, `${path}.makeKey`);
        scope = [row.makeKey];
      }
      if (collection === 'derivatives') {
        resolve('models', row.modelKey, `${path}.modelKey`);
        scope = [row.modelKey];
      }
      if (collection === 'generations') {
        resolve('models', row.modelKey, `${path}.modelKey`);
        if (!open(row.derivativeKey)) {
          const derivative = resolve(
            'derivatives',
            row.derivativeKey,
            `${path}.derivativeKey`,
          );
          if (derivative && derivative.modelKey !== row.modelKey)
            issue(
              path,
              'HIERARCHY_MISMATCH',
              'Derivative belongs to another model',
            );
        }
        scope = [row.modelKey, row.derivativeKey ?? null];
        range(row, path, 'startYear', 'endYear', true);
        endSemantics(row, path, 'endYear', 'endStatus');
      }
      if (collection === 'trims') {
        const generation = resolve(
          'generations',
          row.generationKey,
          `${path}.generationKey`,
        );
        scope = [row.generationKey];
        range(row, path, 'startYear', 'endYear', true);
        contained(row.startYear, row.endYear, generation, path);
      }
      if (collection === 'engines' || collection === 'transmissions')
        range(row, path);
      if (collection === 'engines') {
        if (!text(row.fuelType))
          issue(
            path,
            'FUEL_TYPE_REQUIRED',
            'An ICE engine requires a fuel type',
          );
        for (const field of [
          'displacementCc',
          'cylinderCount',
          'powerKw',
          'torqueNm',
        ])
          if (
            !open(row[field]) &&
            (typeof row[field] !== 'number' ||
              !Number.isFinite(row[field]) ||
              row[field] <= 0)
          )
            issue(
              `${path}.${field}`,
              'INVALID_TECHNICAL_VALUE',
              'Known technical values must be positive numbers',
            );
      }
      if (collection === 'transmissions') {
        if (!text(row.transmissionType))
          issue(
            path,
            'TRANSMISSION_TYPE_REQUIRED',
            'Transmission type is required',
          );
        if (
          !open(row.gearCount) &&
          (!Number.isInteger(row.gearCount) || Number(row.gearCount) < 1)
        )
          issue(
            path,
            'INVALID_GEAR_COUNT',
            'Known gear count must be a positive integer',
          );
      }
      if (collection === 'markets') {
        if (!['COUNTRY', 'REGION', 'SPECIFICATION'].includes(String(row.kind)))
          issue(
            path,
            'MARKET_KIND_REQUIRED',
            'Use COUNTRY, REGION, or SPECIFICATION',
          );
        if (
          row.kind === 'COUNTRY' &&
          (typeof row.countryCode !== 'string' ||
            !/^[A-Z]{2}$/.test(row.countryCode))
        )
          issue(
            path,
            'COUNTRY_CODE_REQUIRED',
            'Use an ISO alpha-2 country code',
          );
        if (row.kind === 'REGION' && !text(row.regionCode))
          issue(
            path,
            'REGION_REQUIRED',
            'A structured region code is required',
          );
        if (row.kind === 'SPECIFICATION' && !text(row.specificationReference))
          issue(
            path,
            'SPEC_REFERENCE_REQUIRED',
            'A specification reference is required',
          );
      }
      if (collection !== 'configurations') {
        for (const [dimension, value] of [
          ['code', row.code],
          [
            'name',
            typeof row.name === 'string'
              ? row.name.trim().toLowerCase().replace(/\s+/g, ' ')
              : row.name,
          ],
        ] as const) {
          const key = JSON.stringify([collection, ...scope, dimension, value]);
          if (naturalKeys.has(key))
            issue(
              path,
              'DUPLICATE_MASTER_IDENTITY',
              `Same ${dimension} in the same hierarchy scope as ${naturalKeys.get(key)}`,
            );
          else naturalKeys.set(key, path);
        }
      }
    }
  }

  const overlaps = new Map<
    string,
    Array<{ start: number; end: number; path: string }>
  >();
  const configurationCodes = new Set<string>();
  for (const { row, path } of rows.get('configurations') ?? []) {
    if (configurationCodes.has(String(row.code)))
      issue(
        path,
        'DUPLICATE_CONFIGURATION_CODE',
        'Configuration codes must be globally unique',
      );
    configurationCodes.add(String(row.code));
    const make = resolve('makes', row.makeKey, `${path}.makeKey`);
    const model = resolve('models', row.modelKey, `${path}.modelKey`);
    const generation = resolve(
      'generations',
      row.generationKey,
      `${path}.generationKey`,
    );
    const trim = resolve('trims', row.trimKey, `${path}.trimKey`);
    const engine = resolve('engines', row.engineKey, `${path}.engineKey`);
    const transmission = resolve(
      'transmissions',
      row.transmissionKey,
      `${path}.transmissionKey`,
    );
    resolve('bodyTypes', row.bodyTypeKey, `${path}.bodyTypeKey`);
    if (make && model && model.makeKey !== row.makeKey)
      issue(path, 'HIERARCHY_MISMATCH', 'Model does not belong to Make');
    if (generation && generation.modelKey !== row.modelKey)
      issue(path, 'HIERARCHY_MISMATCH', 'Generation does not belong to Model');
    if (trim && trim.generationKey !== row.generationKey)
      issue(path, 'HIERARCHY_MISMATCH', 'Trim does not belong to Generation');
    if (row.steeringSide !== 'LHD')
      issue(
        path,
        'LHD_REQUIRED',
        'Ethiopia canonical reconstruction accepts LHD only',
      );
    if (row.powertrainType !== 'ICE')
      issue(
        path,
        'POWERTRAIN_EXTENSION_DEFERRED',
        'Core v1 imports ICE only; do not fake engines for EVs. EV/hybrid masters must be implemented before their import',
      );
    if (!['FWD', 'RWD', 'AWD', '4WD'].includes(String(row.driveType)))
      issue(
        path,
        'DRIVE_TYPE_REQUIRED',
        'An explicit FWD/RWD/AWD/4WD drive type is required',
      );
    if (!text(row.ethiopiaRelevance))
      issue(
        path,
        'RELEVANCE_REQUIRED',
        'Document Ethiopia relevance; source market alone is not evidence of relevance',
      );
    range(row, path, 'productionStartYear', 'productionEndYear', true);
    endSemantics(row, path, 'productionEndYear', 'productionEndStatus');
    for (const parent of [generation, trim, engine, transmission])
      contained(row.productionStartYear, row.productionEndYear, parent, path);
    if (
      row.productionEndStatus === 'CURRENT' &&
      (generation?.endStatus !== 'CURRENT' ||
        !open(trim?.endYear) ||
        !open(engine?.endYear) ||
        !open(transmission?.endYear))
    )
      issue(
        path,
        'CURRENT_PARENT_CONTRADICTION',
        'CURRENT must be compatible with all parent applicability',
      );
    for (const [monthField, yearField] of [
      ['productionStartMonth', 'productionStartYear'],
      ['productionEndMonth', 'productionEndYear'],
    ]) {
      const month = row[monthField];
      if (
        !open(month) &&
        (!Number.isInteger(month) ||
          Number(month) < 1 ||
          Number(month) > 12 ||
          !year(row[yearField]))
      )
        issue(
          `${path}.${monthField}`,
          'INVALID_MONTH',
          'Month requires its year and must be 1–12',
        );
    }
    if (!open(row.modelYear)) {
      if (!year(row.modelYear))
        issue(path, 'INVALID_MODEL_YEAR', 'Expected a valid model year');
      else
        for (const parent of [
          generation,
          trim,
          {
            startYear: row.productionStartYear,
            endYear: row.productionEndYear,
          },
          engine,
          transmission,
        ])
          if (
            parent &&
            ((year(parent.startYear) && row.modelYear < parent.startYear) ||
              (year(parent.endYear) && row.modelYear > parent.endYear))
          )
            issue(
              path,
              'MODEL_YEAR_OUTSIDE_RANGE',
              'Model year must be contained in every applicability range',
            );
    }
    const assignments = row.marketApplicability;
    let target = false;
    let source = false;
    const seenAssignments = new Set<string>();
    if (!Array.isArray(assignments) || assignments.length === 0)
      issue(
        path,
        'MARKET_APPLICABILITY_REQUIRED',
        'Target and source-market assignments are required',
      );
    else
      for (const value of assignments) {
        const assignment = record(value);
        if (
          !assignment ||
          Object.keys(assignment).some(
            (key) => !['marketKey', 'role'].includes(key),
          )
        ) {
          issue(
            path,
            'INVALID_MARKET_ASSIGNMENT',
            'Expected marketKey and role',
          );
          continue;
        }
        const market = resolve(
          'markets',
          assignment.marketKey,
          `${path}.marketApplicability`,
        );
        const key = JSON.stringify([assignment.marketKey, assignment.role]);
        if (seenAssignments.has(key))
          issue(
            path,
            'DUPLICATE_MARKET_ASSIGNMENT',
            'Market/role assignments must be unique',
          );
        seenAssignments.add(key);
        if (assignment.role === 'TARGET') {
          if (market?.kind !== 'COUNTRY' || market.countryCode !== 'ET')
            issue(path, 'INVALID_TARGET_MARKET', 'TARGET must be Ethiopia');
          else target = true;
        } else if (assignment.role === 'SOURCE') {
          if (market?.countryCode === 'ET')
            issue(
              path,
              'SOURCE_TARGET_CONFUSION',
              'Ethiopia applicability is TARGET, not an import source',
            );
          else source = Boolean(market) || source;
        } else issue(path, 'INVALID_MARKET_ROLE', 'Use TARGET or SOURCE');
      }
    if (!target || !source)
      issue(
        path,
        'SOURCE_TARGET_REQUIRED',
        'Require an Ethiopia TARGET and at least one justified SOURCE assignment',
      );
    if (!open(row.materialMarketVariant) && !text(row.materialMarketVariant))
      issue(
        path,
        'INVALID_MARKET_VARIANT',
        'Omit identical variants; use a sourced mechanical variant code where fitment differs',
      );
    if (year(row.productionStartYear)) {
      const start =
        row.productionStartYear * 12 +
        Number(row.productionStartMonth ?? 1) -
        1;
      const end = year(row.productionEndYear)
        ? row.productionEndYear * 12 + Number(row.productionEndMonth ?? 12) - 1
        : Infinity;
      if (start > end)
        issue(
          path,
          'REVERSED_RANGE',
          'Production start month is after production end month',
        );
      // Market memberships and marketing labels do not create mechanical identities.
      const key = JSON.stringify([
        row.makeKey,
        row.modelKey,
        row.generationKey,
        row.trimKey,
        row.engineKey,
        row.transmissionKey,
        row.bodyTypeKey,
        row.driveType,
        row.materialMarketVariant ?? null,
        row.steeringSide,
      ]);
      const group = overlaps.get(key) ?? [];
      group.push({ start, end, path });
      overlaps.set(key, group);
    }
  }
  // Sorting each identity group avoids quadratic comparisons for large datasets.
  for (const group of overlaps.values()) {
    group.sort((a, b) => a.start - b.start);
    let previous: (typeof group)[number] | undefined;
    for (const entry of group) {
      if (previous && entry.start <= previous.end)
        issue(
          entry.path,
          'OVERLAPPING_CONFIGURATION_IDENTITY',
          `Mechanical applicability overlaps ${previous.path}; combine market memberships or document a material variant`,
        );
      if (!previous || entry.end > previous.end) previous = entry;
    }
  }
  if (counts.configurations === 0)
    issue(
      'configurations',
      'EMPTY_PRODUCTION_DATASET',
      'A population manifest must contain actual researched configurations',
    );
  return {
    valid: issues.length === 0,
    standard: VEHICLE_DATA_STANDARD,
    issues,
    counts,
  };
}
