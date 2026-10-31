import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import {
  AccountType,
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  Prisma,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  VehicleSteeringSide,
} from '@prisma/client';
import { AppModule } from '../app.module.js';
import { CatalogSchemaService } from '../catalog/catalog-schema.service.js';
import { DatabaseService } from '../database/database.service.js';
import { vehicleConfigurationIdentityCode } from '../vehicle/vehicle-configuration-identity.js';
import { ADMIN_DEMO_DATA as data } from './admin-demo-data.js';

const { values } = parseArgs({
  options: { 'actor-email': { type: 'string' } },
  strict: true,
});

if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_ADMIN_DEMO_SEED !== 'true') {
  throw new Error('admin:seed-demo requires NODE_ENV=development and ALLOW_ADMIN_DEMO_SEED=true on an isolated disposable database. Demo records are never canonical production data.');
}

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error'],
});

try {
  const db = app.get(DatabaseService);
  const schemas = app.get(CatalogSchemaService);
  const requestedEmail = values['actor-email']?.trim().toLowerCase();
  const actor = await db.user.findFirst({
    where: {
      accountType: AccountType.ADMIN,
      ...(requestedEmail ? { email: requestedEmail } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });

  if (!actor) {
    throw new Error(
      requestedEmail
        ? `No ADMIN account exists for ${requestedEmail}.`
        : 'No ADMIN account exists. Provision an Admin before seeding demo data.',
    );
  }

  const categories = new Map<string, Awaited<ReturnType<typeof db.category.upsert>>>();
  for (const item of data.categories) {
    const parent = item.parentCode ? categories.get(item.parentCode) : null;
    if (item.parentCode && !parent) {
      throw new Error(`Missing demo parent category ${item.parentCode}`);
    }
    const record = await db.category.upsert({
      where: { code: item.code },
      update: {
        parentId: parent?.id ?? null,
        name: item.name,
        slug: item.slug,
        description: 'Development sample data for Admin UI testing.',
        sortOrder: item.sortOrder,
        level: parent ? parent.level + 1 : 0,
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        parentId: parent?.id ?? null,
        code: item.code,
        name: item.name,
        slug: item.slug,
        description: 'Development sample data for Admin UI testing.',
        sortOrder: item.sortOrder,
        level: parent ? parent.level + 1 : 0,
        isLeaf: true,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    categories.set(item.code, record);
  }
  await db.category.update({
    where: { code: 'DEMO_AUTOMOTIVE_PARTS' },
    data: { isLeaf: false, updatedById: actor.id },
  });

  const productTypes = new Map<string, Awaited<ReturnType<typeof db.productType.upsert>>>();
  for (const item of data.productTypes) {
    const category = categories.get(item.categoryCode);
    if (!category) throw new Error(`Missing demo category ${item.categoryCode}`);
    const record = await db.productType.upsert({
      where: { code: item.code },
      update: {
        categoryId: category.id,
        name: item.name,
        slug: item.slug,
        description: 'Development sample Product Type.',
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        categoryId: category.id,
        code: item.code,
        name: item.name,
        slug: item.slug,
        description: 'Development sample Product Type.',
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    productTypes.set(item.code, record);
  }

  const attributeMap = new Map<string, Awaited<ReturnType<typeof db.attributeDefinition.upsert>>>();
  for (const item of data.attributes) {
    const record = await db.attributeDefinition.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        dataType: item.dataType as AttributeDataType,
        scope: AttributeScope.PRODUCT,
        valueSource: item.valueSource as AttributeValueSource,
        unit: item.unit,
        description: 'Development sample Attribute.',
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        code: item.code,
        name: item.name,
        dataType: item.dataType as AttributeDataType,
        scope: AttributeScope.PRODUCT,
        valueSource: item.valueSource as AttributeValueSource,
        unit: item.unit,
        description: 'Development sample Attribute.',
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    attributeMap.set(item.code, record);
  }

  for (const item of data.allowedValues) {
    const attribute = attributeMap.get(item.attributeCode);
    if (!attribute) throw new Error(`Missing demo Attribute ${item.attributeCode}`);
    await db.attributeAllowedValue.upsert({
      where: {
        attributeId_code: { attributeId: attribute.id, code: item.code },
      },
      update: {
        label: item.label,
        sortOrder: item.sortOrder,
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        attributeId: attribute.id,
        code: item.code,
        label: item.label,
        sortOrder: item.sortOrder,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  for (const item of data.assignments) {
    const productType = productTypes.get(item.productTypeCode);
    const attribute = attributeMap.get(item.attributeCode);
    if (!productType || !attribute) {
      throw new Error(`Missing assignment dependency for ${item.productTypeCode}/${item.attributeCode}`);
    }
    await db.productTypeAttributeAssignment.upsert({
      where: {
        productTypeId_attributeId: {
          productTypeId: productType.id,
          attributeId: attribute.id,
        },
      },
      update: {
        requirement: item.requirement as ProductTypeAttributeRequirement,
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        displayOrder: item.displayOrder,
        validationRule:
          'validationRule' in item && item.validationRule
            ? (item.validationRule as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        conditionalRule: 'conditionalRule' in item && item.conditionalRule
          ? (item.conditionalRule as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        searchable: item.searchable,
        filterable: item.filterable,
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        productTypeId: productType.id,
        attributeId: attribute.id,
        requirement: item.requirement as ProductTypeAttributeRequirement,
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        displayOrder: item.displayOrder,
        validationRule:
          'validationRule' in item && item.validationRule
            ? (item.validationRule as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        conditionalRule: 'conditionalRule' in item && item.conditionalRule
          ? (item.conditionalRule as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        searchable: item.searchable,
        filterable: item.filterable,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  for (const productType of productTypes.values()) {
    const current = await db.productType.findUnique({
      where: { id: productType.id },
      select: { version: true, currentSchemaVersionId: true },
    });
    if (current && !current.currentSchemaVersionId) {
      await schemas.publish(
        productType.id,
        { productTypeVersion: current.version },
        actor.id,
      );
    }
  }

  const makes = new Map<string, Awaited<ReturnType<typeof db.vehicleMake.upsert>>>();
  for (const item of data.makes) {
    const record = await db.vehicleMake.upsert({
      where: { code: item.code },
      update: { name: item.name, status: MasterDataStatus.ACTIVE, updatedById: actor.id },
      create: {
        code: item.code,
        name: item.name,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    makes.set(item.code, record);
  }

  const models = new Map<string, Awaited<ReturnType<typeof db.vehicleModel.upsert>>>();
  for (const item of data.models) {
    const make = makes.get(item.makeCode);
    if (!make) throw new Error(`Missing demo make ${item.makeCode}`);
    const record = await db.vehicleModel.upsert({
      where: { makeId_code: { makeId: make.id, code: item.code } },
      update: { name: item.name, status: MasterDataStatus.ACTIVE, updatedById: actor.id },
      create: {
        makeId: make.id,
        code: item.code,
        name: item.name,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    models.set(item.code, record);
  }

  const generations = new Map<string, Awaited<ReturnType<typeof db.vehicleGeneration.upsert>>>();
  for (const item of data.generations) {
    const model = models.get(item.modelCode);
    if (!model) throw new Error(`Missing demo model ${item.modelCode}`);
    const existingGeneration = await db.vehicleGeneration.findFirst({
      where: {
        modelId: model.id,
        derivativeId: null,
        code: item.code,
      },
    });
    const record = existingGeneration
      ? await db.vehicleGeneration.update({
          where: { id: existingGeneration.id },
          data: {
            name: item.name,
            startYear: item.startYear,
            endYear: item.endYear,
            status: MasterDataStatus.ACTIVE,
            updatedById: actor.id,
          },
        })
      : await db.vehicleGeneration.create({
          data: {
            modelId: model.id,
            derivativeId: null,
            code: item.code,
            name: item.name,
            startYear: item.startYear,
            endYear: item.endYear,
            status: MasterDataStatus.ACTIVE,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
    generations.set(item.code, record);
  }

  const trims = new Map<string, Awaited<ReturnType<typeof db.vehicleTrim.upsert>>>();
  for (const item of data.trims) {
    const generation = generations.get(item.generationCode);
    if (!generation) throw new Error(`Missing demo generation ${item.generationCode}`);
    const record = await db.vehicleTrim.upsert({
      where: {
        generationId_code: {
          generationId: generation.id,
          code: item.code,
        },
      },
      update: {
        name: item.name,
        equipmentLevel: item.name.replace(' (Demo)', ''),
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        generationId: generation.id,
        code: item.code,
        name: item.name,
        equipmentLevel: item.name.replace(' (Demo)', ''),
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    trims.set(item.code, record);
  }

  const engines = new Map<string, { id: string }>();
  for (const item of data.engines) {
    const existing = await db.vehicleEngine.findFirst({ where: { code: item.code } });
    const record = existing
      ? await db.vehicleEngine.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            family: item.family,
            displacementCc: item.displacementCc,
            fuelType: item.fuelType,
            cylinderCount: item.cylinderCount,
            aspiration: item.aspiration,
            status: MasterDataStatus.ACTIVE,
            updatedById: actor.id,
          },
        })
      : await db.vehicleEngine.create({
          data: {
            ...item,
            status: MasterDataStatus.ACTIVE,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
    engines.set(item.code, record);
  }

  const transmissions = new Map<string, { id: string }>();
  for (const item of data.transmissions) {
    const existing = await db.vehicleTransmission.findFirst({ where: { code: item.code } });
    const record = existing
      ? await db.vehicleTransmission.update({
          where: { id: existing.id },
          data: {
            transmissionType: item.transmissionType,
            gearCount: item.gearCount,
            driveType: item.driveType,
            status: MasterDataStatus.ACTIVE,
            updatedById: actor.id,
          },
        })
      : await db.vehicleTransmission.create({
          data: {
            ...item,
            status: MasterDataStatus.ACTIVE,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
    transmissions.set(item.code, record);
  }

  const bodyTypes = new Map<string, Awaited<ReturnType<typeof db.vehicleBodyType.upsert>>>();
  for (const item of data.bodyTypes) {
    const record = await db.vehicleBodyType.upsert({
      where: { code: item.code },
      update: { name: item.name, status: MasterDataStatus.ACTIVE, updatedById: actor.id },
      create: {
        ...item,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    bodyTypes.set(item.code, record);
  }

  const markets = new Map<string, Awaited<ReturnType<typeof db.vehicleMarket.upsert>>>();
  for (const item of data.markets) {
    const record = await db.vehicleMarket.upsert({
      where: { code: item.code },
      update: { name: item.name, status: MasterDataStatus.ACTIVE, updatedById: actor.id },
      create: {
        ...item,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    markets.set(item.code, record);
  }

  for (const item of data.configurations) {
    const make = makes.get(item.makeCode);
    const model = models.get(item.modelCode);
    const generation = generations.get(item.generationCode);
    const trim = trims.get(item.trimCode);
    const engine = engines.get(item.engineCode);
    const transmission = transmissions.get(item.transmissionCode);
    const bodyType = bodyTypes.get(item.bodyTypeCode);
    const market = markets.get(item.marketCode);
    if (!make || !model || !generation || !trim || !engine || !transmission || !bodyType || !market) {
      throw new Error(`Missing Vehicle Configuration dependency for ${item.code}`);
    }

    const configurationId = randomUUID();
    await db.vehicleConfiguration.upsert({
      where: { code: item.code },
      update: {
        makeId: make.id,
        modelId: model.id,
        generationId: generation.id,
        trimId: trim.id,
        engineId: engine.id,
        transmissionId: transmission.id,
        bodyTypeId: bodyType.id,
        marketId: market.id,
        modelYear: item.modelYear,
        productionStartYear: item.startYear,
        productionEndYear: item.endYear,
        steeringSide: item.steeringSide as VehicleSteeringSide,
        status: MasterDataStatus.ACTIVE,
        updatedById: actor.id,
      },
      create: {
        id: configurationId,
        identityCode: vehicleConfigurationIdentityCode(configurationId),
        code: item.code,
        makeId: make.id,
        modelId: model.id,
        generationId: generation.id,
        trimId: trim.id,
        engineId: engine.id,
        transmissionId: transmission.id,
        bodyTypeId: bodyType.id,
        marketId: market.id,
        modelYear: item.modelYear,
        productionStartYear: item.startYear,
        productionEndYear: item.endYear,
        steeringSide: item.steeringSide as VehicleSteeringSide,
        status: MasterDataStatus.ACTIVE,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'ADMIN_DEMO_DATA_SEEDED',
      entityType: 'DevelopmentSeed',
      entityId: actor.id,
      metadata: {
        categories: data.categories.length,
        productTypes: data.productTypes.length,
        attributes: data.attributes.length,
        vehicleConfigurations: data.configurations.length,
      },
    },
  });

  process.stdout.write(
    [
      '',
      'Admin demo data is ready.',
      `Audit actor: ${actor.email ?? actor.id}`,
      `Categories: ${data.categories.length}`,
      `Product Types: ${data.productTypes.length}`,
      `Attributes: ${data.attributes.length}`,
      `Vehicle Makes: ${data.makes.length}`,
      `Vehicle Models: ${data.models.length}`,
      `Vehicle Configurations: ${data.configurations.length}`,
      '',
      'Key vehicle example:',
      'Toyota (Demo) → Corolla (Demo) → E140 (Demo) → GLI (Demo)',
      '  → 2ZR-FE 1.8L + 5-speed Manual',
      '  → 2ZR-FE 1.8L + 4-speed Automatic',
      '',
    ].join('\n'),
  );
} finally {
  await app.close();
}
