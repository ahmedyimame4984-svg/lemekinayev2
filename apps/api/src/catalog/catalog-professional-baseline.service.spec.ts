import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { MasterReferenceService } from '../reference-data/master-reference.service.js';
import type { CatalogCanonicalCriteriaLibraryService } from './catalog-canonical-criteria-library.service.js';
import type { CatalogCanonicalProductLibraryService } from './catalog-canonical-product-library.service.js';
import { CatalogProfessionalBaselineService } from './catalog-professional-baseline.service.js';

const attributeCounts = {
  attributeGroups: 25,
  unitDimensions: 27,
  attributeUnits: 55,
  optionSets: 40,
  optionValues: 200,
  attributes: 1243,
  attributeAliases: 20,
  allowedValues: 30,
};

const attributeStatus = {
  valid: true,
  validationErrors: [],
  ready: true,
  expected: attributeCounts,
};

const catalogStatus = {
  valid: true,
  validationErrors: [],
  categories: { expected: 22, installed: 22 },
  partGroups: { expected: 78, installed: 78 },
  productTypes: { expected: 432, installed: 432 },
};

const criteriaStatus = {
  valid: true,
  validationErrors: [],
  templates: { expected: 392, installed: 392 },
  attributes: { expected: 1243, resolved: 1243 },
  productTypeTargets: {
    expectedCodes: 432,
    resolvedCodes: 432,
    unmatchedCodes: [],
  },
  assignments: { expected: 2200, installed: 2200 },
};

describe('CatalogProfessionalBaselineService', () => {
  function build(overrides?: {
    attributes?: Partial<typeof attributeStatus>;
    catalog?: Partial<typeof catalogStatus>;
    criteria?: Partial<typeof criteriaStatus>;
  }) {
    const calls: string[] = [];

    const referenceData = {
      canonicalAttributeStatus: vi.fn().mockResolvedValue({
        ...attributeStatus,
        ...overrides?.attributes,
      }),
      reconcileAttributes: vi.fn().mockImplementation(async () => {
        calls.push('attributes');
        return attributeCounts;
      }),
    } as unknown as MasterReferenceService;

    const canonicalProducts = {
      status: vi.fn().mockResolvedValue({
        ...catalogStatus,
        ...overrides?.catalog,
      }),
      install: vi.fn().mockImplementation(async () => {
        calls.push('catalog');
        return {
          ...catalogStatus,
          createdCategories: 0,
          updatedCategories: 0,
          createdPartGroups: 0,
          updatedPartGroups: 0,
          createdProductTypes: 0,
          updatedProductTypes: 0,
        };
      }),
    } as unknown as CatalogCanonicalProductLibraryService;

    const canonicalCriteria = {
      status: vi.fn().mockResolvedValue({
        ...criteriaStatus,
        ...overrides?.criteria,
      }),
      install: vi.fn().mockImplementation(async () => {
        calls.push('criteria');
        return {
          ...criteriaStatus,
          createdTemplates: 0,
          updatedTemplates: 0,
          createdItems: 0,
          updatedItems: 0,
          removedItems: 0,
          createdTargets: 0,
          removedTargets: 0,
          createdAssignments: 0,
          updatedAssignments: 0,
          removedAssignments: 0,
        };
      }),
    } as unknown as CatalogCanonicalCriteriaLibraryService;

    const database = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    } as unknown as DatabaseService;

    return {
      calls,
      database,
      referenceData,
      canonicalProducts,
      canonicalCriteria,
      service: new CatalogProfessionalBaselineService(
        database,
        referenceData,
        canonicalProducts,
        canonicalCriteria,
      ),
    };
  }

  it('reports ready only when all canonical baseline stages are complete', async () => {
    const { service } = build();

    await expect(service.status()).resolves.toMatchObject({
      ready: true,
      reconciliationInProgress: false,
      attributes: { ready: true },
      catalog: {
        categories: { expected: 22, installed: 22 },
        partGroups: { expected: 78, installed: 78 },
        productTypes: { expected: 432, installed: 432 },
      },
      criteria: {
        templates: { expected: 392, installed: 392 },
        productTypeTargets: { expectedCodes: 432, resolvedCodes: 432 },
      },
    });
  });

  it('reports not ready when any required stage is incomplete', async () => {
    const { service } = build({
      criteria: {
        ...criteriaStatus,
        assignments: { expected: 2200, installed: 2199 },
      },
    });

    await expect(service.status()).resolves.toMatchObject({
      ready: false,
    });
  });

  it('rejects a second reconciliation while one is already running', async () => {
    const { referenceData, service } = build();
    let releaseAttributes!: () => void;
    const blockedAttributes = new Promise<typeof attributeCounts>((resolve) => {
      releaseAttributes = () => resolve(attributeCounts);
    });

    vi.mocked(referenceData.reconcileAttributes).mockReturnValueOnce(
      blockedAttributes,
    );

    const firstReconciliation = service.reconcile(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );

    await expect(
      service.reconcile('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    ).rejects.toMatchObject({
      response: {
        code: 'PROFESSIONAL_CATALOG_RECONCILIATION_IN_PROGRESS',
      },
    });

    await expect(service.status()).resolves.toMatchObject({
      reconciliationInProgress: true,
    });

    releaseAttributes();
    await expect(firstReconciliation).resolves.toMatchObject({
      ready: true,
    });
  });

  it('reconciles Attributes, taxonomy and Criteria in dependency order and audits the result', async () => {
    const {
      calls,
      database,
      service,
    } = build();

    const result = await service.reconcile(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );

    expect(calls).toEqual(['attributes', 'catalog', 'criteria']);
    expect(result.ready).toBe(true);
    expect(result.reconciled).toMatchObject({
      attributes: attributeCounts,
      catalog: { productTypes: { expected: 432, installed: 432 } },
      criteria: { templates: { expected: 392, installed: 392 } },
    });
    expect(database.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PROFESSIONAL_AUTOMOTIVE_CATALOG_BASELINE_RECONCILED',
          metadata: expect.objectContaining({
            nonDestructive: true,
            retrySafe: true,
            hierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
            ready: true,
          }),
        }),
      }),
    );
  });
});
