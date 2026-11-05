import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  AccountStatus,
  AccountType,
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  ProductStatus,
  ProductTypeAttributeDisplayMode,
  ProvenanceVerificationState,
  VehicleIdentificationMethod,
  VehicleSteeringSide,
  ProductTypeAttributeRequirement,
} from '@prisma/client';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { AdminAuthService } from '../src/auth/admin-auth.service.js';
import type { AuthPrincipal } from '../src/auth/auth.types.js';
import { SessionService } from '../src/auth/session.service.js';
import { CatalogAttributeAssignmentService } from '../src/catalog/catalog-attribute-assignment.service.js';
import { CatalogAttributeService } from '../src/catalog/catalog-attribute.service.js';
import { CatalogSchemaService } from '../src/catalog/catalog-schema.service.js';
import { CatalogService } from '../src/catalog/catalog.service.js';
import type { HealthStatus } from '../src/health/health.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { ProductService } from '../src/product/product.service.js';
import {
  MasterDataLifecycleEntityType,
} from '../src/master-data-lifecycle/dto/master-data-lifecycle.dto.js';
import { MasterDataLifecycleService } from '../src/master-data-lifecycle/master-data-lifecycle.service.js';
import { GlobalCatalogSearchService } from '../src/search/global-catalog-search.service.js';
import { VehicleConfigurationService } from '../src/vehicle/vehicle-configuration.service.js';
import { VehicleIdentificationService } from '../src/vehicle/vehicle-identification.service.js';
import { VehicleService } from '../src/vehicle/vehicle.service.js';

describe('API (e2e)', () => {
  let app: INestApplication;
  const database = { isHealthy: vi.fn().mockResolvedValue(true) };
  const customerPrincipal: AuthPrincipal = {
    userId: 'customer-1',
    sessionId: 'customer-session',
    accountType: AccountType.CUSTOMER,
    status: AccountStatus.ACTIVE,
    roles: ['customer'],
    permissions: [],
  };
  const adminPrincipal: AuthPrincipal = {
    userId: 'admin-1',
    sessionId: 'admin-session',
    accountType: AccountType.ADMIN,
    status: AccountStatus.ACTIVE,
    roles: ['platform-admin'],
    permissions: [
      'admin.portal.access',
      'admin.accounts.manage',
      'catalog.manage',
      'vehicle.manage',
    ],
  };
  const limitedAdminPrincipal: AuthPrincipal = {
    ...adminPrincipal,
    sessionId: 'limited-admin-session',
    permissions: ['admin.portal.access'],
  };
  const sessions = {
    authenticateToken: vi.fn(async (token: string) => {
      if (token === 'customer-token') return customerPrincipal;
      if (token === 'admin-token') return adminPrincipal;
      if (token === 'limited-admin-token') return limitedAdminPrincipal;
      return null;
    }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
  };
  const categoryRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    parentId: null,
    code: 'SPARE_PARTS',
    name: 'Spare Parts',
    slug: 'spare-parts',
    description: null,
    sortOrder: 0,
    level: 0,
    isLeaf: true,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: 'admin-1',
    updatedById: 'admin-1',
    createdAt: new Date('2026-09-23T18:00:00.000Z'),
    updatedAt: new Date('2026-09-23T18:00:00.000Z'),
  };
  const partGroupId = '12121212-1212-4121-8121-121212121212';
  const productTypeRecord = {
    id: '44444444-4444-4444-8444-444444444444',
    categoryId: categoryRecord.id,
    productFamilyId: partGroupId,
    parentId: null,
    code: 'BRAKE_PAD',
    name: 'Brake Pad',
    slug: 'brake-pad',
    description: null,
    sortOrder: 0,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    currentSchemaVersionId: null,
    createdById: 'admin-1',
    updatedById: 'admin-1',
    createdAt: new Date('2026-09-27T09:00:00.000Z'),
    updatedAt: new Date('2026-09-27T09:00:00.000Z'),
  };
  const attributeRecord = {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'ATTR_FUEL_TYPE',
    name: 'Fuel Type',
    dataType: AttributeDataType.SELECT,
    scope: AttributeScope.VEHICLE,
    valueSource: AttributeValueSource.STATIC,
    unit: null,
    description: 'Vehicle fuel type',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T15:00:00.000Z'),
    updatedAt: new Date('2026-09-27T15:00:00.000Z'),
  };
  const attributeValueRecord = {
    id: '66666666-6666-4666-8666-666666666666',
    attributeId: attributeRecord.id,
    code: 'DIESEL',
    label: 'Diesel',
    description: null,
    sortOrder: 0,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T15:00:00.000Z'),
    updatedAt: new Date('2026-09-27T15:00:00.000Z'),
  };
  const assignmentRecord = {
    id: '77777777-7777-4777-8777-777777777777',
    productTypeId: productTypeRecord.id,
    attributeId: attributeRecord.id,
    requirement: ProductTypeAttributeRequirement.MANDATORY,
    displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
    displayOrder: 10,
    validationRule: { min: 1 },
    conditionalRule: null,
    searchable: true,
    filterable: true,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T16:00:00.000Z'),
    updatedAt: new Date('2026-09-27T16:00:00.000Z'),
  };
  const schemaVersionRecord = {
    id: '88888888-8888-4888-8888-888888888888',
    productTypeId: productTypeRecord.id,
    schemaVersion: 1,
    schemaHash: 'a'.repeat(64),
    snapshot: {
      productType: {
        id: productTypeRecord.id,
        categoryId: categoryRecord.id,
        productFamilyId: partGroupId,
        code: productTypeRecord.code,
        name: productTypeRecord.name,
        slug: productTypeRecord.slug,
      },
      attributes: [
        {
          assignmentId: assignmentRecord.id,
          attributeId: attributeRecord.id,
          code: attributeRecord.code,
          name: attributeRecord.name,
          dataType: attributeRecord.dataType,
          scope: attributeRecord.scope,
          valueSource: attributeRecord.valueSource,
          requirement: assignmentRecord.requirement,
          displayMode: assignmentRecord.displayMode,
          allowedValues: [
            {
              id: attributeValueRecord.id,
              code: attributeValueRecord.code,
              label: attributeValueRecord.label,
              sortOrder: attributeValueRecord.sortOrder,
            },
          ],
        },
      ],
    },
    publishedAt: new Date('2026-09-27T17:30:00.000Z'),
  };
  const productRecord = {
    id: '99999999-9999-4999-8999-999999999999',
    categoryId: categoryRecord.id,
    productFamilyId: partGroupId,
    productTypeId: productTypeRecord.id,
    schemaVersionId: schemaVersionRecord.id,
    brandId: null,
    schemaVersion: 1,
    schemaHash: 'a'.repeat(64),
    name: 'Brake Pad Set',
    description: 'Canonical validated Product Master',
    status: ProductStatus.DRAFT,
    version: 1,
    values: {
      ATTR_FUEL_TYPE: 'DIESEL',
    },
    createdAt: new Date('2026-09-27T19:00:00.000Z'),
    updatedAt: new Date('2026-09-27T19:00:00.000Z'),
  };
  const makeRecord = {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'TOYOTA',
    name: 'Toyota',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: 'admin-1',
    updatedById: 'admin-1',
    createdAt: new Date('2026-09-23T18:00:00.000Z'),
    updatedAt: new Date('2026-09-23T18:00:00.000Z'),
  };
  const vehicleModelRecord = {
    id: '23232323-2323-4232-8232-232323232323',
    makeId: makeRecord.id,
    code: 'COROLLA',
    name: 'Corolla',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const generationRecord = {
    id: '33333333-3333-4333-8333-333333333333',
    modelId: vehicleModelRecord.id,
    code: 'E140',
    name: 'E140',
    startYear: 2006,
    endYear: 2013,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const trimRecord = {
    id: '34343434-3434-4343-8343-343434343434',
    generationId: generationRecord.id,
    code: 'GLI',
    name: 'GLI',
    equipmentLevel: 'GLI',
    startYear: 2008,
    endYear: 2013,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const engineRecord = {
    id: '35353535-3535-4353-8353-353535353535',
    code: '2ZR-FE',
    name: '2ZR-FE 1.8L',
    family: 'ZR',
    displacementCc: 1798,
    fuelType: 'PETROL',
    cylinderCount: 4,
    aspiration: 'NATURALLY_ASPIRATED',
    powerKw: null,
    torqueNm: null,
    startYear: 2006,
    endYear: null,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const transmissionRecord = {
    id: '36363636-3636-4363-8363-363636363636',
    code: null,
    transmissionType: 'MANUAL',
    gearCount: 5,
    driveType: 'FWD',
    startYear: 2006,
    endYear: null,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const bodyTypeRecord = {
    id: '37373737-3737-4373-8373-373737373737',
    code: 'SEDAN',
    name: 'Sedan',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const marketRecord = {
    id: '38383838-3838-4383-8383-383838383838',
    code: 'ETHIOPIA',
    name: 'Ethiopia',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const vehicleConfigurationRecord = {
    id: '39393939-3939-4393-8393-393939393939',
    code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_MT',
    makeId: makeRecord.id,
    modelId: vehicleModelRecord.id,
    generationId: generationRecord.id,
    trimId: trimRecord.id,
    engineId: engineRecord.id,
    transmissionId: transmissionRecord.id,
    bodyTypeId: bodyTypeRecord.id,
    marketId: marketRecord.id,
    modelYear: 2010,
    productionStartYear: 2009,
    productionEndYear: 2011,
    steeringSide: VehicleSteeringSide.LHD,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-09-27T18:00:00.000Z'),
    updatedAt: new Date('2026-09-27T18:00:00.000Z'),
  };
  const catalog = {
    listPublishedCategories: vi.fn().mockResolvedValue([categoryRecord]),
    getPublishedCategory: vi.fn().mockResolvedValue(categoryRecord),
    listAdminCategories: vi.fn().mockResolvedValue([categoryRecord]),
    createCategory: vi.fn().mockResolvedValue(categoryRecord),
    updateCategory: vi.fn().mockResolvedValue(categoryRecord),
    listAdminProductTypes: vi.fn().mockResolvedValue([productTypeRecord]),
    createProductType: vi.fn().mockResolvedValue(productTypeRecord),
    updateProductType: vi.fn().mockResolvedValue(productTypeRecord),
  };
  const catalogAttributes = {
    listAdminAttributes: vi.fn().mockResolvedValue([attributeRecord]),
    createAttribute: vi.fn().mockResolvedValue(attributeRecord),
    updateAttribute: vi.fn().mockResolvedValue(attributeRecord),
    listAdminAllowedValues: vi.fn().mockResolvedValue([attributeValueRecord]),
    createAllowedValue: vi.fn().mockResolvedValue(attributeValueRecord),
    updateAllowedValue: vi.fn().mockResolvedValue(attributeValueRecord),
  };
  const catalogAssignments = {
    listAdminAssignments: vi.fn().mockResolvedValue([assignmentRecord]),
    createAssignment: vi.fn().mockResolvedValue(assignmentRecord),
    updateAssignment: vi.fn().mockResolvedValue(assignmentRecord),
  };
  const catalogSchemas = {
    listAdminVersions: vi.fn().mockResolvedValue([schemaVersionRecord]),
    publish: vi.fn().mockResolvedValue(schemaVersionRecord),
    getCurrentPublishedSchema: vi.fn().mockResolvedValue(schemaVersionRecord),
    getPublishedSchemaVersion: vi.fn().mockResolvedValue(schemaVersionRecord),
  };
  const products = {
    listAdmin: vi.fn().mockResolvedValue([productRecord]),
    getAdmin: vi.fn().mockResolvedValue(productRecord),
    previewApprovedCatalogImport: vi.fn().mockResolvedValue({
      datasetReference: 'approved-catalog-2026-10',
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [
        {
          rowNumber: 1,
          rowKey: 'row-1',
          productTypeId: productTypeRecord.id,
          brandId: null,
          normalizedManufacturerPartNumber: null,
          errors: [],
        },
      ],
    }),
    commitApprovedCatalogImport: vi.fn().mockResolvedValue({
      datasetReference: 'approved-catalog-2026-10',
      createdCount: 1,
      items: [{ rowKey: 'row-1', articleId: productRecord.id }],
    }),
    create: vi.fn().mockResolvedValue(productRecord),
    update: vi.fn().mockResolvedValue({
      ...productRecord,
      status: ProductStatus.ACTIVE,
      version: 2,
    }),
    listPublished: vi.fn().mockResolvedValue([
      { ...productRecord, status: ProductStatus.ACTIVE },
    ]),
    getPublished: vi.fn().mockResolvedValue({
      ...productRecord,
      status: ProductStatus.ACTIVE,
    }),
  };
  const globalSearch = {
    search: vi.fn().mockResolvedValue({
      query: 'brake',
      normalizedQuery: 'brake',
      articles: [
        {
          id: productRecord.id,
          name: 'Brake Pad Set',
          brandId: null,
          brandName: null,
          productTypeId: productTypeRecord.id,
          productTypeName: productTypeRecord.name,
          primaryManufacturerPartNumber: null,
          score: 115,
          matchedBy: ['ARTICLE_NAME'],
        },
      ],
      brands: [],
      productTypes: [
        {
          id: productTypeRecord.id,
          code: productTypeRecord.code,
          name: productTypeRecord.name,
          categoryName: categoryRecord.name,
          partGroupName: 'Disc Brake',
          score: 120,
          matchedBy: ['PRODUCT_TYPE_NAME'],
        },
      ],
      vehicles: [],
    }),
  };

  const masterDataLifecycle = {
    getState: vi.fn().mockImplementation(
      async (
        _domain: 'CATALOG' | 'VEHICLE',
        entityType: MasterDataLifecycleEntityType,
        entityId: string,
      ) => ({
        entityType,
        entityId,
        status: MasterDataStatus.ACTIVE,
        version: 1,
        supersededById: null,
        reason: null,
        sourceReference: null,
        allowedNextStatuses: [
          MasterDataStatus.DEPRECATED,
          MasterDataStatus.SUPERSEDED,
        ],
        activationWorkflowRequired: false,
      }),
    ),
    transition: vi.fn().mockImplementation(
      async (
        _domain: 'CATALOG' | 'VEHICLE',
        entityType: MasterDataLifecycleEntityType,
        entityId: string,
        input: {
          version: number;
          targetStatus: MasterDataStatus;
          reason: string;
          supersededById?: string;
          sourceReference?: string;
        },
      ) => ({
        entityType,
        entityId,
        status: input.targetStatus,
        version: input.version + 1,
        supersededById: input.supersededById ?? null,
        reason: input.reason,
        sourceReference: input.sourceReference ?? null,
        allowedNextStatuses:
          input.targetStatus === MasterDataStatus.DEPRECATED
            ? [
                MasterDataStatus.ACTIVE,
                MasterDataStatus.SUPERSEDED,
                MasterDataStatus.ARCHIVED,
              ]
            : [],
        activationWorkflowRequired:
          input.targetStatus === MasterDataStatus.DEPRECATED,
      }),
    ),
  };

  const vehicles = {
    listPublishedMakes: vi.fn().mockResolvedValue([makeRecord]),
    listPublishedModels: vi.fn().mockResolvedValue([]),
    listAdminMakes: vi.fn().mockResolvedValue([makeRecord]),
    listAdminModels: vi.fn().mockResolvedValue([]),
    createMake: vi.fn().mockResolvedValue(makeRecord),
    updateMake: vi.fn().mockResolvedValue(makeRecord),
    createModel: vi.fn(),
    updateModel: vi.fn(),
  };
  const vehicleConfigurations = {
    listPublishedGenerations: vi.fn().mockResolvedValue([generationRecord]),
    listPublishedTrims: vi.fn().mockResolvedValue([trimRecord]),
    listPublishedEngines: vi.fn().mockResolvedValue([engineRecord]),
    listPublishedTransmissions: vi.fn().mockResolvedValue([transmissionRecord]),
    listPublishedBodyTypes: vi.fn().mockResolvedValue([bodyTypeRecord]),
    listPublishedMarkets: vi.fn().mockResolvedValue([marketRecord]),
    listPublishedConfigurations: vi.fn().mockResolvedValue([
      vehicleConfigurationRecord,
    ]),
    listAdminGenerations: vi.fn().mockResolvedValue([generationRecord]),
    listAdminTrims: vi.fn().mockResolvedValue([trimRecord]),
    listAdminEngines: vi.fn().mockResolvedValue([engineRecord]),
    listAdminTransmissions: vi.fn().mockResolvedValue([transmissionRecord]),
    listAdminBodyTypes: vi.fn().mockResolvedValue([bodyTypeRecord]),
    listAdminMarkets: vi.fn().mockResolvedValue([marketRecord]),
    listAdminConfigurations: vi.fn().mockResolvedValue([
      vehicleConfigurationRecord,
    ]),
    createGeneration: vi.fn().mockResolvedValue(generationRecord),
    updateGeneration: vi.fn().mockResolvedValue(generationRecord),
    createTrim: vi.fn().mockResolvedValue(trimRecord),
    updateTrim: vi.fn().mockResolvedValue(trimRecord),
    createEngine: vi.fn().mockResolvedValue(engineRecord),
    updateEngine: vi.fn().mockResolvedValue(engineRecord),
    createTransmission: vi.fn().mockResolvedValue(transmissionRecord),
    updateTransmission: vi.fn().mockResolvedValue(transmissionRecord),
    createBodyType: vi.fn().mockResolvedValue(bodyTypeRecord),
    updateBodyType: vi.fn().mockResolvedValue(bodyTypeRecord),
    createMarket: vi.fn().mockResolvedValue(marketRecord),
    updateMarket: vi.fn().mockResolvedValue(marketRecord),
    createConfiguration: vi.fn().mockResolvedValue(
      vehicleConfigurationRecord,
    ),
    updateConfiguration: vi.fn().mockResolvedValue(
      vehicleConfigurationRecord,
    ),
  };
  const vehicleIdentifierMappingRecord = {
    id: '40404040-4040-4404-8404-404040404040',
    identifierType: VehicleIdentificationMethod.CHASSIS,
    rawIdentifier: 'NZE121-0123456',
    normalizedIdentifier: 'NZE1210123456',
    vehicleConfigurationId: vehicleConfigurationRecord.id,
    provider: 'approved-jdm-source',
    sourceReference: 'catalog-row-42',
    verificationState: ProvenanceVerificationState.VERIFIED,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: new Date('2026-10-06T18:00:00.000Z'),
    updatedAt: new Date('2026-10-06T18:00:00.000Z'),
  };
  const vehicleIdentification = {
    validate: vi.fn().mockReturnValue({
      valid: true,
      identifierType: VehicleIdentificationMethod.CHASSIS,
      normalizedIdentifier: 'NZE1210123456',
      errors: [],
      wmi: null,
      vds: null,
      vis: null,
    }),
    resolve: vi.fn().mockResolvedValue({
      status: 'EXACT_MATCH',
      identifierType: VehicleIdentificationMethod.CHASSIS,
      normalizedIdentifier: 'NZE1210123456',
      provider: 'approved-jdm-source',
      resolutionSource: 'VERIFIED_MAPPING',
      candidateCount: 1,
      matchedFields: ['verifiedIdentifierMapping'],
      missingForExactMatch: [],
      candidates: [vehicleConfigurationRecord],
    }),
    listAdminMappings: vi.fn().mockResolvedValue([
      vehicleIdentifierMappingRecord,
    ]),
    createMapping: vi.fn().mockResolvedValue(vehicleIdentifierMappingRecord),
    updateMapping: vi.fn().mockResolvedValue({
      ...vehicleIdentifierMappingRecord,
      version: 2,
    }),
  };

  const adminAuth = {
    beginActivation: vi.fn().mockResolvedValue({
      challengeToken: 'enrollment-challenge-token-with-enough-length',
      expiresAt: new Date('2026-09-23T20:05:00.000Z'),
      secret: 'BASE32SECRET',
      otpauthUri: 'otpauth://totp/Lemekinaye',
    }),
    verifyActivation: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue({
      challengeToken: 'login-challenge-token-with-enough-length-value',
      expiresAt: new Date('2026-09-23T20:05:00.000Z'),
    }),
    verifyLoginMfa: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date('2026-09-23T20:30:00.000Z'),
      refreshToken: 'refresh-token',
      sessionExpiresAt: new Date('2026-09-24T04:00:00.000Z'),
    }),
    refreshSession: vi.fn().mockResolvedValue({
      accessToken: 'rotated-access-token',
      accessTokenExpiresAt: new Date('2026-09-23T20:30:00.000Z'),
      refreshToken: 'rotated-refresh-token',
      sessionExpiresAt: new Date('2026-09-24T04:00:00.000Z'),
    }),
    logoutSession: vi.fn().mockResolvedValue(undefined),
    listAdminAccounts: vi.fn().mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        email: 'admin@example.com',
        name: 'Platform Admin',
        status: 'ACTIVE',
        mfaEnrolled: true,
        lockedUntil: null,
        lastSeenAt: new Date('2026-10-05T09:00:00.000Z'),
        roles: [{ key: 'platform-admin', name: 'Platform Admin', permissions: ['admin.accounts.manage'] }],
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-05T09:00:00.000Z'),
      },
    ]),
    updateAdminAccountStatus: vi.fn().mockImplementation(async (userId, input) => ({
      id: userId,
      email: 'admin@example.com',
      name: 'Platform Admin',
      status: input.status,
      mfaEnrolled: true,
      lockedUntil: null,
      lastSeenAt: new Date('2026-10-05T09:00:00.000Z'),
      roles: [{ key: 'platform-admin', name: 'Platform Admin', permissions: ['admin.accounts.manage'] }],
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-05T09:00:00.000Z'),
    })),
    provisionAdmin: vi.fn().mockResolvedValue({
      userId: '33333333-3333-4333-8333-333333333333',
      activationToken: 'activation-token',
      expiresAt: new Date('2026-09-24T20:00:00.000Z'),
    }),
  };

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost/lemekinaye');
    vi.stubEnv(
      'AUTH_MFA_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64'),
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(database)
      .overrideProvider(SessionService)
      .useValue(sessions)
      .overrideProvider(AdminAuthService)
      .useValue(adminAuth)
      .overrideProvider(CatalogService)
      .useValue(catalog)
      .overrideProvider(CatalogAttributeService)
      .useValue(catalogAttributes)
      .overrideProvider(CatalogAttributeAssignmentService)
      .useValue(catalogAssignments)
      .overrideProvider(CatalogSchemaService)
      .useValue(catalogSchemas)
      .overrideProvider(ProductService)
      .useValue(products)
      .overrideProvider(GlobalCatalogSearchService)
      .useValue(globalSearch)
      .overrideProvider(MasterDataLifecycleService)
      .useValue(masterDataLifecycle)
      .overrideProvider(VehicleService)
      .useValue(vehicles)
      .overrideProvider(VehicleConfigurationService)
      .useValue(vehicleConfigurations)
      .overrideProvider(VehicleIdentificationService)
      .useValue(vehicleIdentification)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('GET /api/v1/health', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect('Content-Type', /json/)
      .expect(200);

    const body = response.body as HealthStatus;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('lemekinaye-api');
    expect(body.version).toBe('0.1.0');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('GET /api/docs-json exposes the versioned authentication contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body).toMatchObject({
      info: { title: 'Lemekinaye API', version: '1.0' },
    });
    expect(response.body.paths).toHaveProperty('/api/v1/auth/me');
    expect(response.body.paths).toHaveProperty('/api/v1/auth/logout');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/me');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/auth/login');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/auth/activate');
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/auth/activate/verify',
    );
    expect(response.body.paths).toHaveProperty('/api/v1/admin/auth/mfa/verify');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/auth/refresh');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/auth/logout');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/accounts');
    expect(response.body.paths).toHaveProperty(
      '/api/v1/vehicle-identification/validate',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/vehicle-identification/resolve',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/vehicles/identifiers',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/vehicles/identifiers/{id}',
    );
    expect(response.body.paths).toHaveProperty('/api/v1/admin/accounts/{userId}/status');
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/accounts/provision',
    );
    expect(response.body.paths).toHaveProperty('/api/v1/search/catalog');
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/lifecycle/{entityType}/{id}',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/vehicles/lifecycle/{entityType}/{id}',
    );
    expect(response.body.paths).toHaveProperty('/api/v1/catalog/categories');
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/categories',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/product-types',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/product-types/{id}',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/product-types/{productTypeId}/schemas',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/product-types/{productTypeId}/schemas/publish',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/catalog/product-types/{id}/schema',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/catalog/product-types/{id}/schema/{version}',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/catalog/product-types/{id}/schema/validate',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/product-types/{productTypeId}/attributes',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/product-types/{productTypeId}/attributes/{assignmentId}',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/attributes',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/attributes/{id}',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/attributes/{id}/values',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/catalog/attributes/{id}/values/{valueId}',
    );
    expect(response.body.paths).toHaveProperty('/api/v1/admin/products');
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/products/import/preview',
    );
    expect(response.body.paths).toHaveProperty(
      '/api/v1/admin/products/import/commit',
    );
    expect(response.body.paths).toHaveProperty('/api/v1/admin/products/{id}');
    expect(response.body.paths).toHaveProperty('/api/v1/products');
    expect(response.body.paths).toHaveProperty('/api/v1/products/{id}');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/makes');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/makes');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/generations');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/trims');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/engines');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/transmissions');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/body-types');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/markets');
    expect(response.body.paths).toHaveProperty('/api/v1/vehicles/configurations');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/generations');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/trims');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/engines');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/transmissions');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/body-types');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/markets');
    expect(response.body.paths).toHaveProperty('/api/v1/admin/vehicles/configurations');
  });

  it('GET /api/v1/health/live', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
  });

  it('GET /api/v1/health/ready checks PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      checks: { database: 'up' },
    });
    expect(database.isHealthy).toHaveBeenCalled();
  });

  it('GET /api/v1/auth/me rejects unauthenticated requests', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('GET /api/v1/auth/me resolves an authenticated session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer customer-token')
      .expect(200);

    expect(response.body).toEqual(customerPrincipal);
  });

  it('GET /api/v1/admin/me blocks an account without permission', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', 'Bearer customer-token')
      .expect(403);

    expect(response.body).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('GET /api/v1/admin/me allows an explicit Admin permission', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual(adminPrincipal);
  });

  it('POST /api/v1/auth/logout revokes the current session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer customer-token')
      .expect(204);

    expect(sessions.revokeSession).toHaveBeenCalledWith(
      'customer-session',
      'customer-1',
    );
  });

  it('POST /api/v1/admin/auth/login starts MFA without issuing a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'a secure password' })
      .expect(200);

    expect(response.body).toMatchObject({
      challengeToken: 'login-challenge-token-with-enough-length-value',
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(adminAuth.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@example.com' }),
      expect.objectContaining({ sourceIp: expect.any(String) }),
    );
  });

  it('POST /api/v1/admin/auth/mfa/verify issues the MFA-backed session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/mfa/verify')
      .send({
        challengeToken: 'login-challenge-token-with-enough-length-value',
        code: '123456',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('rotates and revokes Admin sessions through refresh-token contracts', async () => {
    const refreshToken = 'refresh-token-with-enough-length-for-validation';
    const refresh = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refresh.body).toMatchObject({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/logout')
      .send({ refreshToken })
      .expect(204);
    expect(adminAuth.refreshSession).toHaveBeenCalledWith(
      refreshToken,
      expect.objectContaining({ sourceIp: expect.any(String) }),
    );
    expect(adminAuth.logoutSession).toHaveBeenCalledWith(
      refreshToken,
      expect.objectContaining({ sourceIp: expect.any(String) }),
    );
  });

  it('POST /api/v1/admin/auth/activate rejects weak passwords at the boundary', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/activate')
      .send({
        activationToken: 'activation-token-with-enough-length-for-validation',
        password: 'short',
      })
      .expect(400);

    expect(adminAuth.beginActivation).not.toHaveBeenCalled();
  });

  it('GET/PATCH /api/v1/admin/accounts require privileged Admin permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/accounts')
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/accounts')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ status: 'ACTIVE', mfaEnrolled: true }),
    ]);

    const userId = '33333333-3333-4333-8333-333333333333';
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/accounts/${userId}/status`)
      .set('Authorization', 'Bearer admin-token')
      .send({ status: 'SUSPENDED' })
      .expect(200);
    expect(adminAuth.updateAdminAccountStatus).toHaveBeenCalledWith(
      userId,
      { status: 'SUSPENDED' },
      'admin-1',
    );
  });

  it('POST /api/v1/admin/accounts/provision requires explicit permission', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/accounts/provision')
      .set('Authorization', 'Bearer limited-admin-token')
      .send({ email: 'new-admin@example.com', name: 'New Admin' })
      .expect(403);

    const provision = await request(app.getHttpServer())
      .post('/api/v1/admin/accounts/provision')
      .set('Authorization', 'Bearer admin-token')
      .send({ email: 'new-admin@example.com', name: 'New Admin' })
      .expect(201);

    expect(provision.headers['cache-control']).toBe('no-store');
    expect(adminAuth.provisionAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new-admin@example.com' }),
      'admin-1',
    );
  });

  it('GET /api/v1/search/catalog is public and forwards validated search controls', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/search/catalog?q=brake&limit=5')
      .expect(200);

    expect(response.body).toMatchObject({
      query: 'brake',
      articles: [
        expect.objectContaining({
          id: productRecord.id,
          matchedBy: ['ARTICLE_NAME'],
        }),
      ],
      productTypes: [
        expect.objectContaining({
          id: productTypeRecord.id,
        }),
      ],
    });
    expect(globalSearch.search).toHaveBeenCalledWith({
      q: 'brake',
      limit: 5,
    });
  });

  it('GET /api/v1/search/catalog rejects invalid search controls before the service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/search/catalog?q=x')
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/search/catalog?q=brake&limit=100')
      .expect(400);
  });

  it('GET /api/v1/catalog/categories exposes active catalog data publicly', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/categories')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ code: 'SPARE_PARTS', status: 'ACTIVE' }),
    ]);
  });

  it('POST /api/v1/admin/catalog/categories blocks non-Admin accounts', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/categories')
      .set('Authorization', 'Bearer customer-token')
      .send({ code: 'LIGHTING', name: 'Lighting', slug: 'lighting' })
      .expect(403);

    expect(response.body).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('POST /api/v1/admin/catalog/categories rejects source-owned mutation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ code: 'SPARE_PARTS', name: 'Spare Parts', slug: 'spare-parts' })
      .expect(403);


  });


  it('GET /api/v1/admin/catalog/product-types requires catalog.manage', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/product-types')
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/product-types')
      .set('Authorization', 'Bearer admin-token')
      .query({ categoryId: categoryRecord.id, status: 'ACTIVE' })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ code: 'BRAKE_PAD', status: 'ACTIVE' }),
    ]);
    expect(catalog.listAdminProductTypes).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: categoryRecord.id,
        status: MasterDataStatus.ACTIVE,
      }),
    );
  });

  it('POST /api/v1/admin/catalog/product-types rejects source-owned mutation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/product-types')
      .set('Authorization', 'Bearer admin-token')
      .send({
        categoryId: categoryRecord.id,
        productFamilyId: partGroupId,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        slug: 'brake-pad',
      })
      .expect(403);


  });

  it('PATCH /api/v1/admin/catalog/product-types/:id rejects source-owned mutation', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/catalog/product-types/${productTypeRecord.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ version: 1, name: 'Front Brake Pad' })
      .expect(403);


  });

  it('rejects malformed product type administration input before the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/product-types')
      .set('Authorization', 'Bearer admin-token')
      .send({
        categoryId: 'not-a-uuid',
        code: 'not valid',
        name: ' ',
        slug: 'Not Valid',
      })
      .expect(403);
  });




  it('GET /api/v1/admin/products requires catalog.manage', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/products?status=DRAFT')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: productRecord.id,
        schemaVersion: 1,
        status: ProductStatus.DRAFT,
      }),
    ]);
    expect(products.listAdmin).toHaveBeenCalledWith({
      status: ProductStatus.DRAFT,
    });
  });

  it('POST /api/v1/admin/products/import/preview requires catalog.manage and performs zero-write preview through ProductService', async () => {
    const input = {
      datasetReference: 'approved-catalog-2026-10',
      rows: [
        {
          rowKey: 'row-1',
          productTypeId: productTypeRecord.id,
          schemaVersion: 1,
          name: 'Imported Brake Pad',
          values: { ATTR_FUEL_TYPE: 'DIESEL' },
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin/products/import/preview')
      .set('Authorization', 'Bearer limited-admin-token')
      .send(input)
      .expect(403);

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products/import/preview')
      .set('Authorization', 'Bearer admin-token')
      .send(input)
      .expect(200);

    expect(response.body).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    expect(products.previewApprovedCatalogImport).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetReference: 'approved-catalog-2026-10',
      }),
      'admin-1',
    );
  });

  it('POST /api/v1/admin/products/import/commit forwards a validated normalized batch without exposing normal Admin Product creation', async () => {
    const input = {
      datasetReference: 'approved-catalog-2026-10',
      rows: [
        {
          rowKey: 'row-1',
          productTypeId: productTypeRecord.id,
          schemaVersion: 1,
          name: 'Imported Brake Pad',
          values: { ATTR_FUEL_TYPE: 'DIESEL' },
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products/import/commit')
      .set('Authorization', 'Bearer admin-token')
      .send(input)
      .expect(201);

    expect(response.body).toMatchObject({
      createdCount: 1,
      items: [{ rowKey: 'row-1', articleId: productRecord.id }],
    });
    expect(products.commitApprovedCatalogImport).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetReference: 'approved-catalog-2026-10',
      }),
      'admin-1',
    );
  });

  it('does not register Admin Product creation because actual Products are seller-owned', async () => {
    const input = {
      productTypeId: productTypeRecord.id,
      schemaVersion: 1,
      name: 'Brake Pad Set',
      values: {
        ATTR_FUEL_TYPE: 'DIESEL',
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send(input)
      .expect(404);

    expect(products.create).not.toHaveBeenCalled();
  });

  it('keeps malformed Admin Product creation outside the registered Admin API', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({
        productTypeId: productTypeRecord.id,
        schemaVersion: 0,
        name: 'x',
        values: [],
      })
      .expect(404);

    expect(products.create).not.toHaveBeenCalled();
  });

  it('does not register Admin Product updates because actual Products are seller-owned', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productRecord.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        version: 1,
        status: ProductStatus.ACTIVE,
      })
      .expect(404);

    expect(products.update).not.toHaveBeenCalled();
  });

  it('GET /api/v1/products exposes only ProductService published records', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: productRecord.id,
        status: ProductStatus.ACTIVE,
      }),
    ]);
    expect(products.listPublished).toHaveBeenCalled();
  });

  it('GET /api/v1/products/:id retrieves an ACTIVE canonical Product', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/products/${productRecord.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: productRecord.id,
      status: ProductStatus.ACTIVE,
      values: { ATTR_FUEL_TYPE: 'DIESEL' },
    });
    expect(products.getPublished).toHaveBeenCalledWith(productRecord.id);
  });

  it('GET /api/v1/admin/catalog/product-types/:id/schemas requires catalog.manage', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/schemas`,
      )
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/schemas`,
      )
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        productTypeId: productTypeRecord.id,
        schemaVersion: 1,
      }),
    ]);
    expect(catalogSchemas.listAdminVersions).toHaveBeenCalledWith(
      productTypeRecord.id,
    );
  });

  it('POST /api/v1/admin/catalog/product-types/:id/schemas/publish rejects consumer-side canonical publication', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/schemas/publish`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({ productTypeVersion: 1 })
      .expect(403);


  });

  it('rejects malformed Product Type schema publication input', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/schemas/publish`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({ productTypeVersion: 0 })
      .expect(403);

    expect(catalogSchemas.publish).not.toHaveBeenCalledWith(
      productTypeRecord.id,
      { productTypeVersion: 0 },
      expect.anything(),
    );
  });

  it('GET /api/v1/catalog/product-types/:id/schema exposes the current published schema publicly', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/catalog/product-types/${productTypeRecord.id}/schema`)
      .expect(200);

    expect(response.body).toMatchObject({
      productTypeId: productTypeRecord.id,
      schemaVersion: 1,
      snapshot: expect.objectContaining({
        attributes: [
          expect.objectContaining({ code: attributeRecord.code }),
        ],
      }),
    });
    expect(catalogSchemas.getCurrentPublishedSchema).toHaveBeenCalledWith(
      productTypeRecord.id,
    );
  });

  it('GET /api/v1/catalog/product-types/:id/schema/:version keeps historical schemas readable', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/catalog/product-types/${productTypeRecord.id}/schema/1`,
      )
      .expect(200);

    expect(response.body).toMatchObject({
      productTypeId: productTypeRecord.id,
      schemaVersion: 1,
    });
    expect(catalogSchemas.getPublishedSchemaVersion).toHaveBeenCalledWith(
      productTypeRecord.id,
      1,
    );
  });

  it('POST /api/v1/catalog/product-types/:id/schema/validate validates the current published schema publicly', async () => {
    const valid = await request(app.getHttpServer())
      .post(
        `/api/v1/catalog/product-types/${productTypeRecord.id}/schema/validate`,
      )
      .send({
        values: {
          ATTR_FUEL_TYPE: 'DIESEL',
        },
      })
      .expect(200);

    expect(valid.body).toMatchObject({
      valid: true,
      schemaVersion: 1,
      schemaHash: 'a'.repeat(64),
      requiredAttributeCodes: ['ATTR_FUEL_TYPE'],
      issues: [],
    });
    expect(catalogSchemas.getCurrentPublishedSchema).toHaveBeenCalledWith(
      productTypeRecord.id,
    );

    const invalid = await request(app.getHttpServer())
      .post(
        `/api/v1/catalog/product-types/${productTypeRecord.id}/schema/validate`,
      )
      .send({
        values: {
          ATTR_FUEL_TYPE: 'PETROL',
          ATTR_UNKNOWN: 'x',
        },
      })
      .expect(200);

    expect(invalid.body.valid).toBe(false);
    expect(invalid.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNKNOWN_ATTRIBUTE',
          attributeCode: 'ATTR_UNKNOWN',
        }),
        expect.objectContaining({
          code: 'VALUE_NOT_ALLOWED',
          attributeCode: 'ATTR_FUEL_TYPE',
        }),
      ]),
    );
  });

  it('POST /api/v1/catalog/product-types/:id/schema/validate supports exact historical schema versions', async () => {
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/catalog/product-types/${productTypeRecord.id}/schema/validate`,
      )
      .send({
        schemaVersion: 1,
        values: {
          ATTR_FUEL_TYPE: 'DIESEL',
        },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      valid: true,
      schemaVersion: 1,
    });
    expect(catalogSchemas.getPublishedSchemaVersion).toHaveBeenCalledWith(
      productTypeRecord.id,
      1,
    );
  });

  it('rejects malformed published-schema validation requests before evaluation', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/catalog/product-types/${productTypeRecord.id}/schema/validate`,
      )
      .send({
        schemaVersion: 0,
        values: [],
      })
      .expect(400);
  });

  it('GET /api/v1/admin/catalog/product-types/:id/attributes requires catalog.manage', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/attributes`,
      )
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/attributes`,
      )
      .set('Authorization', 'Bearer admin-token')
      .query({ status: 'ACTIVE', requirement: 'MANDATORY' })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        attributeId: attributeRecord.id,
        requirement: 'MANDATORY',
        filterable: true,
      }),
    ]);
    expect(catalogAssignments.listAdminAssignments).toHaveBeenCalledWith(
      productTypeRecord.id,
      expect.objectContaining({
        status: MasterDataStatus.ACTIVE,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
      }),
    );
  });

  it('POST /api/v1/admin/catalog/product-types/:id/attributes assigns an approved attribute', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/attributes`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({
        attributeId: attributeRecord.id,
        requirement: 'MANDATORY',
        displayMode: 'VISIBLE',
        displayOrder: 10,
        validationRule: { min: 1 },
        searchable: true,
        filterable: true,
        status: 'ACTIVE',
      })
      .expect(201);

    expect(catalogAssignments.createAssignment).toHaveBeenCalledWith(
      productTypeRecord.id,
      expect.objectContaining({
        attributeId: attributeRecord.id,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        searchable: true,
        filterable: true,
      }),
      'admin-1',
    );
  });

  it('PATCH /api/v1/admin/catalog/product-types/:id/attributes/:assignmentId forwards versioned assignment updates', async () => {
    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/attributes/${assignmentRecord.id}`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({
        version: 1,
        displayOrder: 20,
        searchable: false,
      })
      .expect(200);

    expect(catalogAssignments.updateAssignment).toHaveBeenCalledWith(
      productTypeRecord.id,
      assignmentRecord.id,
      expect.objectContaining({
        version: 1,
        displayOrder: 20,
        searchable: false,
      }),
      'admin-1',
    );
  });

  it('rejects malformed Product Type attribute assignment input before the service', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/catalog/product-types/${productTypeRecord.id}/attributes`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({
        attributeId: 'not-a-uuid',
        requirement: 'NOT_VALID',
        displayOrder: -1,
        searchable: 'yes',
      })
      .expect(400);
  });

  it('GET /api/v1/admin/catalog/attributes requires catalog.manage', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/attributes')
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/attributes')
      .set('Authorization', 'Bearer admin-token')
      .query({
        status: 'ACTIVE',
        dataType: 'SELECT',
        scope: 'VEHICLE',
        valueSource: 'STATIC',
      })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        code: 'ATTR_FUEL_TYPE',
        valueSource: 'STATIC',
      }),
    ]);
    expect(catalogAttributes.listAdminAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MasterDataStatus.ACTIVE,
        dataType: AttributeDataType.SELECT,
        scope: AttributeScope.VEHICLE,
        valueSource: AttributeValueSource.STATIC,
      }),
    );
  });

  it('POST /api/v1/admin/catalog/attributes rejects source-owned mutation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/attributes')
      .set('Authorization', 'Bearer admin-token')
      .send({
        code: 'ATTR_FUEL_TYPE',
        name: 'Fuel Type',
        dataType: 'SELECT',
        scope: 'VEHICLE',
        valueSource: 'STATIC',
        status: 'ACTIVE',
      })
      .expect(403);


  });

  it('reads allowed values but denies local canonical mutations', async () => {
    const values = await request(app.getHttpServer())
      .get(`/api/v1/admin/catalog/attributes/${attributeRecord.id}/values`)
      .set('Authorization', 'Bearer admin-token')
      .query({ status: 'ACTIVE' })
      .expect(200);

    expect(values.body).toEqual([
      expect.objectContaining({ code: 'DIESEL', label: 'Diesel' }),
    ]);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/catalog/attributes/${attributeRecord.id}/values`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        code: 'DIESEL',
        label: 'Diesel',
        status: 'ACTIVE',
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/catalog/attributes/${attributeRecord.id}/values/${attributeValueRecord.id}`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({ version: 1, label: 'Diesel Fuel' })
      .expect(403);



  });

  it('rejects malformed attribute master input before the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/attributes')
      .set('Authorization', 'Bearer admin-token')
      .send({
        code: 'fuel type',
        name: ' ',
        dataType: 'NOT_A_TYPE',
        scope: 'PRODUCT',
      })
      .expect(403);

    expect(catalogAttributes.createAttribute).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'fuel type' }),
      expect.anything(),
    );
  });

  it('GET /api/v1/vehicles/makes exposes active vehicle master data publicly', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/makes')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ code: 'TOYOTA', status: 'ACTIVE' }),
    ]);
  });

  it('GET /api/v1/vehicles/generations and trims expose active hierarchy traversal', async () => {
    const generations = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/generations?modelId=${vehicleModelRecord.id}`)
      .expect(200);

    expect(generations.body).toEqual([
      expect.objectContaining({ code: 'E140', modelId: vehicleModelRecord.id }),
    ]);
    expect(vehicleConfigurations.listPublishedGenerations).toHaveBeenCalledWith(
      vehicleModelRecord.id,
      undefined,
    );

    const trims = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/trims?generationId=${generationRecord.id}`)
      .expect(200);

    expect(trims.body).toEqual([
      expect.objectContaining({ code: 'GLI', generationId: generationRecord.id }),
    ]);
  });

  it('GET /api/v1/vehicles/configurations resolves precise active vehicle configurations', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/vehicles/configurations?modelId=${vehicleModelRecord.id}&generationId=${generationRecord.id}&trimId=${trimRecord.id}&engineId=${engineRecord.id}&transmissionId=${transmissionRecord.id}&modelYear=2010&steeringSide=LHD`,
      )
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_MT',
        engineId: engineRecord.id,
        transmissionId: transmissionRecord.id,
        modelYear: 2010,
        steeringSide: 'LHD',
      }),
    ]);
    expect(vehicleConfigurations.listPublishedConfigurations).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: vehicleModelRecord.id,
        generationId: generationRecord.id,
        trimId: trimRecord.id,
        engineId: engineRecord.id,
        transmissionId: transmissionRecord.id,
        modelYear: 2010,
        steeringSide: VehicleSteeringSide.LHD,
      }),
    );
  });

  it('POST /api/v1/vehicle-identification/validate exposes typed vehicle identification publicly', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-identification/validate')
      .send({
        identifier: 'NZE121-0123456',
        identifierType: 'CHASSIS',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      valid: true,
      identifierType: 'CHASSIS',
      normalizedIdentifier: 'NZE1210123456',
    });
    expect(vehicleIdentification.validate).toHaveBeenCalledWith({
      identifier: 'NZE121-0123456',
      identifierType: VehicleIdentificationMethod.CHASSIS,
    });
  });

  it('POST /api/v1/vehicle-identification/resolve returns canonical candidates without authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicle-identification/resolve')
      .send({
        identifier: 'NZE121-0123456',
        identifierType: 'CHASSIS',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'EXACT_MATCH',
      identifierType: 'CHASSIS',
      candidateCount: 1,
      candidates: [
        expect.objectContaining({ id: vehicleConfigurationRecord.id }),
      ],
    });
  });

  it('Admin VIN lookup requires vehicle.manage and returns decoder evidence with HTTP 200', async () => {
    const input = { identifier: 'JTDBU4EE9B9123456', modelYear: 2011 };
    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/identifiers/resolve')
      .send(input)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/identifiers/resolve')
      .set('Authorization', 'Bearer limited-admin-token')
      .send(input)
      .expect(403);

    vehicleIdentification.resolve.mockResolvedValueOnce({
      status: 'NO_MATCH', identifierType: 'VIN', normalizedIdentifier: input.identifier,
      provider: 'nhtsa-vpic', resolutionSource: 'VIN_PROVIDER',
      decoded: { make: 'Toyota', model: 'Corolla', modelYear: 2011, series: 'LE' },
      warnings: ['Verify decoder evidence.'], candidateCount: 0, matchedFields: ['make', 'model', 'modelYear'],
      missingForExactMatch: ['engine', 'transmission'], candidates: [],
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/identifiers/resolve')
      .set('Authorization', 'Bearer admin-token')
      .send(input)
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'NO_MATCH', provider: 'nhtsa-vpic',
      decoded: { make: 'Toyota', model: 'Corolla', modelYear: 2011, series: 'LE' },
      warnings: ['Verify decoder evidence.'], candidates: [],
    });
    expect(vehicleIdentification.resolve).toHaveBeenLastCalledWith(input);
  });

  it('POST /api/v1/admin/vehicles/identifiers blocks source-owned identifier mutations', async () => {
    const input = {
      identifierType: 'CHASSIS',
      rawIdentifier: 'NZE121-0123456',
      vehicleConfigurationId: vehicleConfigurationRecord.id,
      provider: 'approved-jdm-source',
      sourceReference: 'catalog-row-42',
      verificationState: 'VERIFIED',
      status: 'ACTIVE',
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/identifiers')
      .set('Authorization', 'Bearer limited-admin-token')
      .send(input)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/identifiers')
      .set('Authorization', 'Bearer admin-token')
      .send(input)
      .expect(403);


  });

  it('rejects malformed vehicle identifier mapping input before the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/identifiers')
      .set('Authorization', 'Bearer admin-token')
      .send({
        identifierType: 'UNKNOWN_TYPE',
        rawIdentifier: '',
        vehicleConfigurationId: 'not-a-uuid',
      })
      .expect(403);
  });

  it('POST /api/v1/admin/vehicles/configurations denies local source-owned configuration creation', async () => {
    const input = {
      code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_MT',
      makeId: makeRecord.id,
      modelId: vehicleModelRecord.id,
      generationId: generationRecord.id,
      trimId: trimRecord.id,
      engineId: engineRecord.id,
      transmissionId: transmissionRecord.id,
      bodyTypeId: bodyTypeRecord.id,
      marketId: marketRecord.id,
      modelYear: 2010,
      steeringSide: 'LHD',
      status: 'ACTIVE',
    };

    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/configurations')
      .set('Authorization', 'Bearer limited-admin-token')
      .send(input)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/configurations')
      .set('Authorization', 'Bearer admin-token')
      .send(input)
      .expect(403);


  });

  it('rejects malformed Vehicle Master configuration input before the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/configurations')
      .set('Authorization', 'Bearer admin-token')
      .send({
        code: 'not-valid-code',
        makeId: 'not-a-uuid',
        modelId: vehicleModelRecord.id,
        modelYear: 1200,
      })
      .expect(403);

    expect(vehicleConfigurations.createConfiguration).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'not-valid-code' }),
      expect.anything(),
    );
  });

  it('POST /api/v1/admin/vehicles/makes requires vehicle.manage', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/vehicles/makes')
      .set('Authorization', 'Bearer limited-admin-token')
      .send({ code: 'TOYOTA', name: 'Toyota' })
      .expect(403);

    expect(response.body).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('permits canonical lifecycle inspection but rejects local transitions', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/admin/catalog/lifecycle/CATEGORY/${categoryRecord.id}`,
      )
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    const state = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/catalog/lifecycle/CATEGORY/${categoryRecord.id}`,
      )
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(state.body).toMatchObject({
      entityType: 'CATEGORY',
      entityId: categoryRecord.id,
      status: 'ACTIVE',
    });
    expect(masterDataLifecycle.getState).toHaveBeenCalledWith(
      'CATALOG',
      MasterDataLifecycleEntityType.CATEGORY,
      categoryRecord.id,
    );

    const callsBeforeInvalid =
      masterDataLifecycle.transition.mock.calls.length;
    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/catalog/lifecycle/CATEGORY/${categoryRecord.id}`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({
        version: 1,
        targetStatus: 'DEPRECATED',
        reason: '     ',
      })
      .expect(403);
    expect(masterDataLifecycle.transition).toHaveBeenCalledTimes(
      callsBeforeInvalid,
    );

    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/catalog/lifecycle/CATEGORY/${categoryRecord.id}`,
      )
      .set('Authorization', 'Bearer admin-token')
      .send({
        version: 1,
        targetStatus: 'DEPRECATED',
        reason: 'Taxonomy replaced by the approved canonical category.',
        sourceReference: 'catalog-governance-42',
      })
      .expect(403);
    expect(masterDataLifecycle.transition).toHaveBeenCalledTimes(callsBeforeInvalid);
  });

  it('protects vehicle master-data lifecycle with vehicle.manage', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/admin/vehicles/lifecycle/VEHICLE_MAKE/${makeRecord.id}`,
      )
      .set('Authorization', 'Bearer limited-admin-token')
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/api/v1/admin/vehicles/lifecycle/VEHICLE_MAKE/${makeRecord.id}`,
      )
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(masterDataLifecycle.getState).toHaveBeenCalledWith(
      'VEHICLE',
      MasterDataLifecycleEntityType.VEHICLE_MAKE,
      makeRecord.id,
    );
  });

  it('rejects malformed catalog administration input before the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ code: 'not valid', name: ' ', slug: 'Not Valid' })
      .expect(403);
  });
});
