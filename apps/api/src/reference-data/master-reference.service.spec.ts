import { describe, expect, it, vi } from "vitest";
import type { DatabaseService } from "../database/database.service.js";
import {
  LEGACY_SEEDED_CATEGORY_CODES,
  MASTER_REFERENCE_DATA,
  LEGACY_SEEDED_PRODUCT_TYPE_CODES,
} from "../scripts/master-reference-data.js";
import { MasterReferenceService } from "./master-reference.service.js";

function attributeMasterCounts() {
  return {
    attributeGroups: MASTER_REFERENCE_DATA.attributeGroups.length,
    unitDimensions: MASTER_REFERENCE_DATA.unitDimensions.length,
    attributeUnits: MASTER_REFERENCE_DATA.unitDimensions.reduce(
      (total, dimension) => total + dimension.units.length,
      0,
    ),
    optionSets: MASTER_REFERENCE_DATA.optionSets.length,
    optionValues: MASTER_REFERENCE_DATA.optionSets.reduce(
      (total, optionSet) => total + optionSet.values.length,
      0,
    ),
    attributes: MASTER_REFERENCE_DATA.attributes.length,
    attributeAliases: MASTER_REFERENCE_DATA.attributes.reduce(
      (total, attribute) => total + attribute.aliases.length,
      0,
    ),
    allowedValues: MASTER_REFERENCE_DATA.allowedValues.length,
  };
}

describe("MasterReferenceService legacy replacement retirement", () => {
  it("blocks replacement and install before any database read or mutation", async () => {
    const service = new MasterReferenceService({} as DatabaseService);
    await expect(service.replace("admin")).rejects.toMatchObject({
      response: { code: "LEGACY_VEHICLE_LIBRARY_RETIRED" },
    });
    await expect(service.install("admin")).rejects.toMatchObject({
      response: { code: "LEGACY_VEHICLE_LIBRARY_RETIRED" },
    });
  });
});

describe("MasterReferenceService attribute replacement", () => {
  it("uses the attribute-only replacement path and never clears vehicle masters", async () => {
    const db = {
      productTypeAttributeAssignment: { count: vi.fn().mockResolvedValue(0) },
      productTypeSchemaVersion: { count: vi.fn().mockResolvedValue(0) },
      productTypeCriteriaTemplateItem: { count: vi.fn().mockResolvedValue(0) },
      productAttributeValue: { count: vi.fn().mockResolvedValue(0) },
      product: { count: vi.fn().mockResolvedValue(0) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-attr" }) },
    } as unknown as DatabaseService;

    const service = new MasterReferenceService(db);
    const internals = service as unknown as {
      clearAttributeMasterData: () => Promise<void>;
      createAttributes: (actorId: string) => Promise<Map<string, unknown>>;
    };

    const clearAttributes = vi
      .spyOn(internals, "clearAttributeMasterData")
      .mockResolvedValue();
    vi.spyOn(internals, "createAttributes").mockResolvedValue(new Map());

    await expect(service.replaceAttributes("admin-1")).resolves.toMatchObject(
      attributeMasterCounts(),
    );

    expect(clearAttributes).toHaveBeenCalledOnce();
    expect("clearMasterData" in service).toBe(false);
    expect(
      (db as unknown as { auditLog: { create: ReturnType<typeof vi.fn> } })
        .auditLog.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ATTRIBUTE_MASTER_DATA_REPLACED_BY_ADMIN",
          metadata: expect.objectContaining({
            vehicleMasterDataPreserved: true,
          }),
        }),
      }),
    );
  });

  it("reconciles the canonical attribute library incrementally without clearing referenced Attribute identities", async () => {
    const db = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-reconcile" }),
      },
      $transaction: vi.fn(),
    } as unknown as DatabaseService;

    const service = new MasterReferenceService(db);
    const internals = service as unknown as {
      reconcileAttributeMasterData: (
        client: DatabaseService,
        actorId: string,
      ) => Promise<void>;
      clearAttributeMasterData: () => Promise<void>;
    };

    const reconcile = vi
      .spyOn(internals, "reconcileAttributeMasterData")
      .mockResolvedValue();
    const clear = vi
      .spyOn(internals, "clearAttributeMasterData")
      .mockResolvedValue();

    await expect(service.reconcileAttributes("admin-1")).resolves.toMatchObject(
      attributeMasterCounts(),
    );

    expect(reconcile).toHaveBeenCalledWith(db, "admin-1");
    expect(
      (db as unknown as { $transaction: ReturnType<typeof vi.fn> })
        .$transaction,
    ).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(
      (
        db as unknown as {
          auditLog: { create: ReturnType<typeof vi.fn> };
        }
      ).auditLog.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ATTRIBUTE_MASTER_DATA_RECONCILED_BY_ADMIN",
          metadata: expect.objectContaining({
            destructiveReplacement: false,
            restartSafeIncremental: true,
            existingAttributeIdsPreserved: true,
            vehicleMasterDataPreserved: true,
          }),
        }),
      }),
    );
  });

  it("blocks attribute replacement when a Criteria Template depends on current attributes", async () => {
    const db = {
      productTypeAttributeAssignment: { count: vi.fn().mockResolvedValue(0) },
      productTypeSchemaVersion: { count: vi.fn().mockResolvedValue(0) },
      productTypeCriteriaTemplateItem: { count: vi.fn().mockResolvedValue(1) },
      productAttributeValue: { count: vi.fn().mockResolvedValue(0) },
      product: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as DatabaseService;

    const service = new MasterReferenceService(db);

    await expect(service.replaceAttributes("admin-1")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "ATTRIBUTE_MASTER_REPLACEMENT_BLOCKED",
        details: expect.objectContaining({
          productTypeCriteriaTemplateItems: 1,
        }),
      }),
    });
  });

  it("blocks attribute replacement when a Product Type schema depends on current attributes", async () => {
    const db = {
      productTypeAttributeAssignment: { count: vi.fn().mockResolvedValue(1) },
      productTypeSchemaVersion: { count: vi.fn().mockResolvedValue(0) },
      productTypeCriteriaTemplateItem: { count: vi.fn().mockResolvedValue(0) },
      productAttributeValue: { count: vi.fn().mockResolvedValue(0) },
      product: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as DatabaseService;

    const service = new MasterReferenceService(db);

    await expect(service.replaceAttributes("admin-1")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "ATTRIBUTE_MASTER_REPLACEMENT_BLOCKED",
      }),
    });
  });
});

describe("MasterReferenceService legacy catalog cleanup", () => {
  it("removes the untouched 30/60 seeded catalog without touching attributes or vehicles", async () => {
    const categoryCount = vi
      .fn()
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(0);
    const productTypeCount = vi
      .fn()
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(0);

    const tx = {
      productType: {
        updateMany: vi.fn().mockResolvedValue({ count: 60 }),
        count: productTypeCount,
        findMany: vi
          .fn()
          .mockResolvedValue(
            Array.from({ length: 60 }, (_, index) => ({ id: `pt-${index}` })),
          ),
        deleteMany: vi.fn().mockResolvedValue({ count: 60 }),
      },
      productTypeSchemaVersion: {
        deleteMany: vi.fn().mockResolvedValue({ count: 60 }),
      },
      productTypeAttributeAssignment: {
        deleteMany: vi.fn().mockResolvedValue({ count: 100 }),
      },
      productFamily: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      category: {
        count: categoryCount,
        findMany: vi
          .fn()
          .mockResolvedValue(
            Array.from({ length: 30 }, (_, index) => ({ id: `cat-${index}` })),
          ),
        deleteMany: vi.fn().mockResolvedValue({ count: 30 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    const db = {
      category: {
        count: categoryCount,
        findMany: vi
          .fn()
          .mockResolvedValue(
            LEGACY_SEEDED_CATEGORY_CODES.map((code) => ({ code })),
          ),
      },
      productType: {
        count: productTypeCount,
        findMany: vi
          .fn()
          .mockResolvedValue(
            LEGACY_SEEDED_PRODUCT_TYPE_CODES.map((code) => ({ code })),
          ),
      },
      productFamily: { count: vi.fn().mockResolvedValue(0) },
      product: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as DatabaseService;

    const service = new MasterReferenceService(db);

    await expect(service.cleanupLegacySeedCatalog("admin-1")).resolves.toEqual({
      removed: true,
      reason: "removed",
    });

    expect(tx.productTypeAttributeAssignment.deleteMany).toHaveBeenCalledOnce();
    expect(tx.productTypeSchemaVersion.deleteMany).toHaveBeenCalledOnce();
    expect(tx.productType.deleteMany).toHaveBeenCalled();
    expect(tx.category.deleteMany).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "LEGACY_SEEDED_PRODUCT_CATALOG_REMOVED",
        }),
      }),
    );
  });

  it("preserves a catalog that no longer matches the untouched legacy seed shape", async () => {
    const db = {
      category: {
        count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(4),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { code: "BRAKES" },
            { code: "FILTERS" },
            { code: "ENGINE" },
            { code: "ELECTRICAL" },
          ]),
      },
      productType: {
        count: vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(7),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { code: "BRAKE_PAD" },
            { code: "BRAKE_DISC_REAL" },
          ]),
      },
      productFamily: { count: vi.fn().mockResolvedValue(2) },
      product: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(),
    } as unknown as DatabaseService;

    const service = new MasterReferenceService(db);

    await expect(service.cleanupLegacySeedCatalog("admin-1")).resolves.toEqual({
      removed: false,
      reason: "not-legacy-seed-shape",
    });
    expect(
      (db as unknown as { $transaction: ReturnType<typeof vi.fn> })
        .$transaction,
    ).not.toHaveBeenCalled();
  });
});

describe("MasterReferenceService status", () => {
  function createStatusDb(options?: {
    vehicleMasters?: number;
    configurations?: number;
    bodyTypes?: number;
    markets?: number;
    extraAttributes?: number;
    inactiveBaselineGroup?: boolean;
  }) {
    const baseline = attributeMasterCounts();
    const canonicalGroups = baseline.attributeGroups;
    const db = {
      attributeGroup: {
        count: vi.fn().mockImplementation(async (args?: { where?: object }) =>
          args?.where && options?.inactiveBaselineGroup
            ? canonicalGroups - 1
            : canonicalGroups,
        ),
      },
      unitDimension: { count: vi.fn().mockResolvedValue(baseline.unitDimensions) },
      attributeUnit: { count: vi.fn().mockResolvedValue(baseline.attributeUnits) },
      attributeOptionSet: { count: vi.fn().mockResolvedValue(baseline.optionSets) },
      attributeOptionValue: { count: vi.fn().mockResolvedValue(baseline.optionValues) },
      attributeDefinition: {
        count: vi.fn().mockImplementation(async (args?: { where?: object }) =>
          args?.where
            ? baseline.attributes
            : baseline.attributes + (options?.extraAttributes ?? 0),
        ),
      },
      attributeAlias: { count: vi.fn().mockResolvedValue(baseline.attributeAliases) },
      attributeAllowedValue: { count: vi.fn().mockResolvedValue(baseline.allowedValues) },
      category: {
        count: vi.fn().mockImplementation(async (args?: { where?: { parentId?: null } }) =>
          args?.where?.parentId === null ? 0 : 0,
        ),
      },
      productType: { count: vi.fn().mockResolvedValue(0) },
      vehicleMake: { count: vi.fn().mockResolvedValue(options?.vehicleMasters ?? 0) },
      vehicleModel: { count: vi.fn().mockResolvedValue(0) },
      vehicleModelDerivative: { count: vi.fn().mockResolvedValue(0) },
      vehicleGeneration: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn(),
      },
      vehicleTrim: { count: vi.fn().mockResolvedValue(0) },
      vehicleEngine: { count: vi.fn().mockResolvedValue(0) },
      vehicleTransmission: { count: vi.fn().mockResolvedValue(0) },
      vehicleBodyType: { count: vi.fn().mockResolvedValue(options?.bodyTypes ?? 0) },
      vehicleMarket: { count: vi.fn().mockResolvedValue(options?.markets ?? 0) },
      vehicleConfiguration: {
        count: vi.fn().mockResolvedValue(options?.configurations ?? 0),
        findMany: vi.fn(),
      },
      product: { count: vi.fn().mockResolvedValue(0) },
      sellerListing: { count: vi.fn().mockResolvedValue(0) },
      vehicleProfile: { count: vi.fn().mockResolvedValue(0) },
      vehicleCompatibility: { count: vi.fn().mockResolvedValue(0) },
      auditLog: { count: vi.fn(), create: vi.fn() },
    };
    return db;
  }

  it("reports an intentionally empty Admin-managed vehicle library without seed targets", async () => {
    const db = createStatusDb();
    const status = await new MasterReferenceService(
      db as unknown as DatabaseService,
    ).status();

    expect(status).toMatchObject({
      ready: true,
      attributeLibraryReady: true,
      vehicleLibraryState: "EMPTY",
      catalogManagedByAdmin: true,
      replacementInProgress: false,
      counts: {
        attributes: {
          actual: attributeMasterCounts().attributes,
          expected: attributeMasterCounts().attributes,
        },
        categories: { actual: 0, expected: null },
        productTypes: { actual: 0, expected: null },
        vehicleMakes: { actual: 0, expected: null },
        vehicleConfigurations: { actual: 0, expected: null },
      },
    });
    expect(db.vehicleGeneration.findMany).not.toHaveBeenCalled();
    expect(db.vehicleConfiguration.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.count).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("reports manually created vehicle masters without demanding a fixed configuration count", async () => {
    const db = createStatusDb({ vehicleMasters: 3 });
    const status = await new MasterReferenceService(
      db as unknown as DatabaseService,
    ).status();

    expect(status.vehicleLibraryState).toBe("MASTERS_ONLY");
    expect(status.attributeLibraryReady).toBe(true);
    expect(status.counts.vehicleMakes).toEqual({ actual: 3, expected: null });
  });

  it("recognizes manually created Body Types and Markets as vehicle master data", async () => {
    const db = createStatusDb({ bodyTypes: 5, markets: 2 });
    const status = await new MasterReferenceService(
      db as unknown as DatabaseService,
    ).status();

    expect(status.vehicleLibraryState).toBe("MASTERS_ONLY");
    expect(status.counts.vehicleBodyTypes).toEqual({ actual: 5, expected: null });
    expect(status.counts.vehicleMarkets).toEqual({ actual: 2, expected: null });
    expect(status.counts.vehicleMakes).toEqual({ actual: 0, expected: null });
  });

  it("reports saved Configured Vehicles without claiming fitment verification", async () => {
    const db = createStatusDb({ vehicleMasters: 2, configurations: 7 });
    const status = await new MasterReferenceService(
      db as unknown as DatabaseService,
    ).status();

    expect(status.vehicleLibraryState).toBe("CONFIGURATIONS_PRESENT");
    expect(status.counts.vehicleConfigurations).toEqual({
      actual: 7,
      expected: null,
    });
    expect(db.vehicleConfiguration.findMany).not.toHaveBeenCalled();
  });

  it("allows administrator-defined Attributes without treating them as a baseline failure", async () => {
    const db = createStatusDb({ extraAttributes: 2 });
    const status = await new MasterReferenceService(
      db as unknown as DatabaseService,
    ).status();

    expect(status.attributeLibraryReady).toBe(true);
    expect(status.ready).toBe(true);
    expect(status.counts.attributes).toEqual({
      actual: attributeMasterCounts().attributes + 2,
      expected: attributeMasterCounts().attributes,
    });
  });

  it("marks the Attribute baseline not ready when required canonical definitions are inactive", async () => {
    const db = createStatusDb({ inactiveBaselineGroup: true });
    const status = await new MasterReferenceService(
      db as unknown as DatabaseService,
    ).status();

    expect(status.attributeLibraryReady).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.vehicleLibraryState).toBe("EMPTY");
  });
});
