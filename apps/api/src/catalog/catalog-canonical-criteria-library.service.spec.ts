import {
  MasterDataStatus,
  ProductTypeAttributeAssignmentOrigin,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import {
  CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES,
  validateCanonicalCriteriaTemplateLibrary,
} from '../scripts/canonical-criteria-template-library.js';
import { CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG } from '../scripts/canonical-product-catalog-library.js';
import { MASTER_ATTRIBUTE_LIBRARY } from '../scripts/master-attribute-library.js';
import { CatalogCanonicalCriteriaLibraryService } from './catalog-canonical-criteria-library.service.js';

describe('canonical automotive Criteria Template library', () => {
  it('references only canonical Master Attributes and has no duplicate structural definitions', () => {
    expect(validateCanonicalCriteriaTemplateLibrary()).toEqual([]);
    expect(CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.length).toBeGreaterThanOrEqual(
      18,
    );
  });

  it('targets every canonical Product Type exactly once', () => {
    const productTypeCodes =
      CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap((category) =>
        category.partGroups.flatMap((group) =>
          group.productTypes.map((productType) => productType.code),
        ),
      ).sort();
    const targetCodes = CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.flatMap(
      (template) => template.targetProductTypeCodes,
    ).sort();

    expect(targetCodes).toHaveLength(productTypeCodes.length);
    expect(new Set(targetCodes).size).toBe(targetCodes.length);
    expect(targetCodes).toEqual(productTypeCodes);
  });
});

describe('CatalogCanonicalCriteriaLibraryService', () => {
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  function attributeRows() {
    const needed = new Set(
      CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.flatMap((template) =>
        template.items.map((item) => item.attributeCode),
      ),
    );
    return MASTER_ATTRIBUTE_LIBRARY.attributes
      .filter((attribute) => needed.has(attribute.code))
      .map((attribute, index) => ({
        id: `attribute-${index}`,
        code: attribute.code,
        status: MasterDataStatus.ACTIVE,
        defaultUnitId: null,
      }));
  }

  it('reports unresolved Product Type codes without fabricating catalog records', async () => {
    const rows = attributeRows();
    const db = {
      productTypeCriteriaTemplate: {
        count: vi.fn().mockResolvedValue(0),
      },
      attributeDefinition: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
      productType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'product-type-brake-disc', code: 'BRAKE_DISC' },
          { id: 'product-type-oil-filter', code: 'OIL_FILTER' },
        ]),
      },
      productTypeAttributeAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as DatabaseService;

    const service = new CatalogCanonicalCriteriaLibraryService(db);
    const status = await service.status();

    expect(status.valid).toBe(true);
    expect(status.attributes).toEqual({
      expected: rows.length,
      resolved: rows.length,
    });
    expect(status.productTypeTargets.resolvedCodes).toBe(2);
    expect(status.productTypeTargets.unmatchedCodes).toContain('BRAKE_PAD');
    expect(status.templates.installed).toBe(0);
    expect(status.assignments.expected).toBeGreaterThan(0);
    expect(status.assignments.installed).toBe(0);
  });

  it('installs all canonical Templates and keeps unmatched targets Draft', async () => {
    const rows = attributeRows();
    const productTypes = [
      {
        id: 'product-type-brake-disc',
        code: 'BRAKE_DISC',
        status: MasterDataStatus.ACTIVE,
      },
      {
        id: 'product-type-oil-filter',
        code: 'OIL_FILTER',
        status: MasterDataStatus.ACTIVE,
      },
    ];
    let templateSequence = 0;

    const tx = {
      attributeDefinition: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
      productType: {
        findMany: vi.fn().mockResolvedValue(productTypes),
      },
      productTypeCriteriaTemplate: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: `template-${++templateSequence}`,
            productFamilyId: null,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: vi.fn(),
      },
      productTypeCriteriaTemplateTarget: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      productTypeCriteriaTemplateItem: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      productTypeAttributeAssignment: {
        findMany: vi.fn().mockImplementation(
          async ({ where }: { where?: Record<string, unknown> }) =>
            where && 'origin' in where
              ? [
                  {
                    id: 'stale-canonical-assignment',
                    productTypeId: 'product-type-brake-disc',
                    attributeId: 'obsolete-attribute',
                    origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
                  },
                ]
              : [],
        ),
        create: vi.fn().mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: `assignment-${String(data.productTypeId)}-${String(data.attributeId)}`,
            version: 1,
            ...data,
          }),
        ),
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const db = {
      ...tx,
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as DatabaseService;

    const service = new CatalogCanonicalCriteriaLibraryService(db);
    const result = await service.install(actorId);

    const totalItems = CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.reduce(
      (total, template) => total + template.items.length,
      0,
    );
    const expectedAssignments = CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES
      .filter((template) =>
        template.targetProductTypeCodes.some((code) =>
          ['BRAKE_DISC', 'OIL_FILTER'].includes(code),
        ),
      )
      .reduce((total, template) => total + template.items.length, 0);

    expect(result.createdTemplates).toBe(
      CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.length,
    );
    expect(result.createdItems).toBe(totalItems);
    expect(result.createdTargets).toBe(2);
    expect(result.createdAssignments).toBe(expectedAssignments);
    expect(result.removedAssignments).toBe(1);
    expect(tx.productTypeAttributeAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
        }),
      }),
    );
    expect(tx.productTypeAttributeAssignment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale-canonical-assignment'] } },
    });
    expect(result.assignments).toEqual({
      expected: expectedAssignments,
      installed: expectedAssignments,
    });
    expect(result.productTypeTargets.unmatchedCodes).toContain('BRAKE_PAD');

    expect(tx.productTypeCriteriaTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'CANON_BRAKE_DISC_V1',
          status: MasterDataStatus.ACTIVE,
        }),
      }),
    );
    expect(tx.productTypeCriteriaTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'CANON_BRAKE_PAD_V1',
          status: MasterDataStatus.DRAFT,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CANONICAL_AUTOMOTIVE_CRITERIA_LIBRARY_INSTALLED',
          metadata: expect.objectContaining({
            createdTemplates:
              CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.length,
            createdTargets: 2,
            createdAssignments: expectedAssignments,
            canonicalAssignmentCount: expectedAssignments,
          }),
        }),
      }),
    );
    expect(
      (db as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction,
    ).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxWait: 10_000,
        timeout: 300_000,
      }),
    );
  });

  it('refuses installation when the Master Attribute Library is incomplete', async () => {
    const rows = attributeRows().slice(1);
    const tx = {
      attributeDefinition: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
      productType: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const db = {
      ...tx,
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as DatabaseService;

    const service = new CatalogCanonicalCriteriaLibraryService(db);

    await expect(service.install(actorId)).rejects.toMatchObject({
      response: {
        code: 'CANONICAL_CRITERIA_LIBRARY_ATTRIBUTE_MISMATCH',
      },
    });
  });
});
