import { MasterDataStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import {
  CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES,
} from '../scripts/canonical-criteria-template-library.js';
import {
  CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG,
  canonicalCatalogStats,
  canonicalSlug,
  validateCanonicalProductCatalog,
} from '../scripts/canonical-product-catalog-library.js';
import { CatalogCanonicalProductLibraryService } from './catalog-canonical-product-library.service.js';

describe('canonical automotive Product Catalog library', () => {
  it('has a valid Category → Part Group → Product Type structure', () => {
    expect(validateCanonicalProductCatalog()).toEqual([]);
    expect(canonicalCatalogStats()).toEqual({
      categories: 22,
      partGroups: 78,
      productTypes: 432,
    });
  });

  it('contains every Product Type targeted by canonical Criteria Templates', () => {
    const productTypeCodes = new Set(
      CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap((category) =>
        category.partGroups.flatMap((group) =>
          group.productTypes.map((productType) => productType.code),
        ),
      ),
    );

    const targetCodes = new Set(
      CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.flatMap(
        (template) => template.targetProductTypeCodes,
      ),
    );

    expect(
      [...targetCodes].filter((code) => !productTypeCodes.has(code)),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Brakes Product Type', () => {
    const brakes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_BRAKES',
    );
    expect(brakes).toBeDefined();

    const brakeProductTypeCodes = new Set(
      brakes!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!brakeProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(brakeProductTypeCodes.size).toBe(27);
    expect(
      [...brakeProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Filters Product Type', () => {
    const filters = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_FILTERS',
    );
    expect(filters).toBeDefined();

    const filterProductTypeCodes = new Set(
      filters!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!filterProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(filterProductTypeCodes.size).toBe(16);
    expect(
      [...filterProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });
  it('provides exactly one canonical Criteria Template for every Suspension & Damping Product Type', () => {
    const suspension = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_SUSPENSION_DAMPING',
    );
    expect(suspension).toBeDefined();

    const suspensionProductTypeCodes = new Set(
      suspension!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!suspensionProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(suspensionProductTypeCodes.size).toBe(22);
    expect(
      [...suspensionProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Engine Cooling Product Type', () => {
    const cooling = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_COOLING',
    );
    expect(cooling).toBeDefined();

    const coolingProductTypeCodes = new Set(
      cooling!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!coolingProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(coolingProductTypeCodes.size).toBe(19);
    expect(
      [...coolingProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Electrical & Electronics Product Type', () => {
    const electrical = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_ELECTRICAL',
    );
    expect(electrical).toBeDefined();

    const electricalProductTypeCodes = new Set(
      electrical!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!electricalProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(electricalProductTypeCodes.size).toBe(28);
    expect(
      [...electricalProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Ignition & Preheating Product Type', () => {
    const ignition = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_IGNITION_PREHEATING',
    );
    expect(ignition).toBeDefined();

    const ignitionProductTypeCodes = new Set(
      ignition!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!ignitionProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(ignitionProductTypeCodes.size).toBe(11);
    expect(
      [...ignitionProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Fuel Supply & Air Intake Product Type', () => {
    const fuelAir = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_FUEL_AIR',
    );
    expect(fuelAir).toBeDefined();

    const fuelAirProductTypeCodes = new Set(
      fuelAir!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!fuelAirProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(fuelAirProductTypeCodes.size).toBe(30);
    expect(
      [...fuelAirProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Drivetrain & Axles Product Type', () => {
    const drivetrain = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_DRIVETRAIN_AXLES',
    );
    expect(drivetrain).toBeDefined();

    const drivetrainProductTypeCodes = new Set(
      drivetrain!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!drivetrainProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(drivetrainProductTypeCodes.size).toBe(20);
    expect(
      [...drivetrainProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });
  it('provides exactly one canonical Criteria Template for every Engine Product Type', () => {
    const engine = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_ENGINE',
    );
    expect(engine).toBeDefined();

    const engineProductTypeCodes = new Set(
      engine!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!engineProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(engineProductTypeCodes.size).toBe(37);
    expect(
      [...engineProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Clutch & Transmission Product Type', () => {
    const transmission = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_CLUTCH_TRANSMISSION',
    );
    expect(transmission).toBeDefined();

    const transmissionProductTypeCodes = new Set(
      transmission!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!transmissionProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(transmissionProductTypeCodes.size).toBe(25);
    expect(
      [...transmissionProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Steering Product Type', () => {
    const steering = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_STEERING',
    );
    expect(steering).toBeDefined();

    const steeringProductTypeCodes = new Set(
      steering!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!steeringProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(steeringProductTypeCodes.size).toBe(17);
    expect(
      [...steeringProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });
  it('provides exactly one canonical Criteria Template for every Body & Exterior Product Type', () => {
    const body = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_BODY_EXTERIOR',
    );
    expect(body).toBeDefined();

    const bodyProductTypeCodes = new Set(
      body!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!bodyProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(bodyProductTypeCodes.size).toBe(26);
    expect(
      [...bodyProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });
  it('provides exactly one canonical Criteria Template for every Lighting Product Type', () => {
    const lighting = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_LIGHTING',
    );
    expect(lighting).toBeDefined();

    const lightingProductTypeCodes = new Set(
      lighting!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!lightingProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(lightingProductTypeCodes.size).toBe(15);
    expect(
      [...lightingProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Exhaust & Emissions Product Type', () => {
    const exhaust = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_EXHAUST_EMISSIONS',
    );
    expect(exhaust).toBeDefined();

    const exhaustProductTypeCodes = new Set(
      exhaust!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!exhaustProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(exhaustProductTypeCodes.size).toBe(20);
    expect(
      [...exhaustProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every HVAC Product Type', () => {
    const hvac = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_HVAC',
    );
    expect(hvac).toBeDefined();

    const hvacProductTypeCodes = new Set(
      hvac!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!hvacProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(hvacProductTypeCodes.size).toBe(16);
    expect(
      [...hvacProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });
  it('provides exactly one canonical Criteria Template for every Wheels & Tires Product Type', () => {
    const wheelsTires = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_WHEELS_TIRES',
    );
    expect(wheelsTires).toBeDefined();

    const productTypeCodes = new Set(
      wheelsTires!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!productTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(productTypeCodes.size).toBe(20);
    expect(
      [...productTypeCodes].filter((code) => targetCounts.get(code) !== 1),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Belts, Chains & Pulleys Product Type', () => {
    const beltsTiming = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_BELTS_TIMING',
    );
    expect(beltsTiming).toBeDefined();

    const productTypeCodes = new Set(
      beltsTiming!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!productTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(productTypeCodes.size).toBe(14);
    expect(
      [...productTypeCodes].filter((code) => targetCounts.get(code) !== 1),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Wiper & Washer Product Type', () => {
    const wiperWasher = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_WIPER_WASHER',
    );
    expect(wiperWasher).toBeDefined();

    const productTypeCodes = new Set(
      wiperWasher!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!productTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(productTypeCodes.size).toBe(10);
    expect(
      [...productTypeCodes].filter((code) => targetCounts.get(code) !== 1),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Gaskets & Seals Product Type', () => {
    const seals = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_GASKETS_SEALS',
    );
    expect(seals).toBeDefined();

    const productTypeCodes = new Set(
      seals!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!productTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(productTypeCodes.size).toBe(16);
    expect(
      [...productTypeCodes].filter((code) => targetCounts.get(code) !== 1),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Safety & Driver Assistance Product Type', () => {
    const safety = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_SAFETY_ADAS',
    );
    expect(safety).toBeDefined();

    const productTypeCodes = new Set(
      safety!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!productTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(productTypeCodes.size).toBe(15);
    expect(
      [...productTypeCodes].filter((code) => targetCounts.get(code) !== 1),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Oils & Fluids Product Type', () => {
    const fluids = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_OILS_FLUIDS',
    );
    expect(fluids).toBeDefined();

    const fluidProductTypeCodes = new Set(
      fluids!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!fluidProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(fluidProductTypeCodes.size).toBe(14);
    expect(
      [...fluidProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

  it('provides exactly one canonical Criteria Template for every Interior & Controls Product Type', () => {
    const interior = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.find(
      (category) => category.code === 'CAT_INTERIOR_CONTROLS',
    );
    expect(interior).toBeDefined();

    const interiorProductTypeCodes = new Set(
      interior!.partGroups.flatMap((group) =>
        group.productTypes.map((productType) => productType.code),
      ),
    );
    const targetCounts = new Map<string, number>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const code of template.targetProductTypeCodes) {
        if (!interiorProductTypeCodes.has(code)) continue;
        targetCounts.set(code, (targetCounts.get(code) ?? 0) + 1);
      }
    }

    expect(interiorProductTypeCodes.size).toBe(14);
    expect(
      [...interiorProductTypeCodes].filter(
        (code) => targetCounts.get(code) !== 1,
      ),
    ).toEqual([]);
  });

});

describe('CatalogCanonicalProductLibraryService', () => {
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('reports canonical catalog installation counts', async () => {
    const db = {
      category: {
        count: vi.fn().mockResolvedValue(10),
      },
      productFamily: {
        count: vi.fn().mockResolvedValue(20),
      },
      productType: {
        count: vi.fn().mockResolvedValue(30),
      },
    } as unknown as DatabaseService;

    const service = new CatalogCanonicalProductLibraryService(db);
    await expect(service.status()).resolves.toMatchObject({
      valid: true,
      categories: { expected: 22, installed: 10 },
      partGroups: { expected: 78, installed: 20 },
      productTypes: { expected: 432, installed: 30 },
    });
  });

  it('installs the complete canonical taxonomy into an empty catalog', async () => {
    let categorySequence = 0;
    let familySequence = 0;
    let productTypeSequence = 0;

    const tx = {
      category: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: `category-${++categorySequence}`,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: vi.fn(),
      },
      productFamily: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: `family-${++familySequence}`,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: vi.fn(),
      },
      productType: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: `product-type-${++productTypeSequence}`,
            version: 1,
            currentSchemaVersionId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: vi.fn(),
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

    const service = new CatalogCanonicalProductLibraryService(db);
    const result = await service.install(actorId);

    expect(result).toMatchObject({
      valid: true,
      categories: { expected: 22, installed: 22 },
      partGroups: { expected: 78, installed: 78 },
      productTypes: { expected: 432, installed: 432 },
      createdCategories: 22,
      createdPartGroups: 78,
      createdProductTypes: 432,
    });

    expect(tx.category.create).toHaveBeenCalledTimes(22);
    expect(tx.productFamily.create).toHaveBeenCalledTimes(78);
    expect(tx.productType.create).toHaveBeenCalledTimes(432);

    expect(tx.productType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'BRAKE_DISC',
          slug: canonicalSlug('BRAKE_DISC'),
          status: MasterDataStatus.ACTIVE,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG_INSTALLED',
          metadata: expect.objectContaining({
            hierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
            createdProductTypes: 432,
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

  it('blocks instead of moving an existing Product Type from another Part Group', async () => {
    const brakeCategory = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG[0];
    const discGroup = brakeCategory?.partGroups[0];
    const brakeDisc = discGroup?.productTypes.find(
      (productType) => productType.code === 'BRAKE_DISC',
    );
    expect(brakeCategory && discGroup && brakeDisc).toBeTruthy();

    const existingCategory = {
      id: 'category-brakes',
      parentId: null,
      code: brakeCategory!.code,
      name: brakeCategory!.name,
      slug: canonicalSlug(brakeCategory!.code),
      description: brakeCategory!.description,
      sortOrder: 10,
      level: 0,
      isLeaf: true,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdById: actorId,
      updatedById: actorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const existingFamily = {
      id: 'family-disc',
      categoryId: existingCategory.id,
      code: discGroup!.code,
      name: discGroup!.name,
      description: discGroup!.description,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdById: actorId,
      updatedById: actorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const tx = {
      category: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([existingCategory])
          .mockResolvedValueOnce([
            { code: existingCategory.code, slug: existingCategory.slug },
          ]),
        create: vi.fn(),
        update: vi.fn(),
      },
      productFamily: {
        findMany: vi.fn().mockResolvedValue([existingFamily]),
        create: vi.fn().mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: `new-family-${String(data.code)}`,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: vi.fn(),
      },
      productType: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'brake-disc-existing',
              categoryId: existingCategory.id,
              productFamilyId: 'wrong-family',
              parentId: null,
              code: brakeDisc!.code,
              name: brakeDisc!.name,
              slug: canonicalSlug(brakeDisc!.code),
              description: 'Existing',
              sortOrder: 0,
              status: MasterDataStatus.ACTIVE,
              version: 1,
              currentSchemaVersionId: null,
              createdById: actorId,
              updatedById: actorId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ])
          .mockResolvedValueOnce([
            {
              code: brakeDisc!.code,
              slug: canonicalSlug(brakeDisc!.code),
            },
          ]),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    const db = {
      ...tx,
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as DatabaseService;

    const service = new CatalogCanonicalProductLibraryService(db);

    await expect(service.install(actorId)).rejects.toMatchObject({
      response: {
        code: 'CANONICAL_PRODUCT_CATALOG_PRODUCT_TYPE_CONFLICT',
      },
    });

    expect(tx.productType.update).not.toHaveBeenCalled();
  });
});
