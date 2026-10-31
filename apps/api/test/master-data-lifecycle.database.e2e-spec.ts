import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccountType,
  AttributeDataType,
  AttributeScope,
  MasterDataStatus,
  PrismaClient,
} from '@prisma/client';
import type { DatabaseService } from '../src/database/database.service.js';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { CatalogAttributeAssignmentService } from '../src/catalog/catalog-attribute-assignment.service.js';
import { MasterDataLifecycleService } from '../src/master-data-lifecycle/master-data-lifecycle.service.js';
import { MasterDataLifecycleEntityType as Entity } from '../src/master-data-lifecycle/dto/master-data-lifecycle.dto.js';

// Explicit opt-in: this must be a disposable, migrated test database.
// Never fall back to the developer's DATABASE_URL or remove historical audit rows.
const connectionString = process.env.LIFECYCLE_TEST_DATABASE_URL;

describe.skipIf(!connectionString)(
  'Master lifecycle against PostgreSQL',
  () => {
    let db: PrismaClient;
    let lifecycle: MasterDataLifecycleService;
    let catalog: CatalogService;
    let assignments: CatalogAttributeAssignmentService;
    const actorId = randomUUID();

    beforeAll(async () => {
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString, max: 1, maxUses: 1 }),
      });
      await db.$connect();
      const database = db as DatabaseService;
      lifecycle = new MasterDataLifecycleService(database);
      catalog = new CatalogService(database);
      assignments = new CatalogAttributeAssignmentService(database);
      await db.user.create({
        data: { id: actorId, accountType: AccountType.ADMIN },
      });
    });

    afterAll(async () => {
      await db?.$disconnect();
    });

    function identity() {
      const id = randomUUID();
      return {
        id,
        code: `RESTORE_${id.replaceAll('-', '')}`,
        name: `Lifecycle fixture ${id}`,
      };
    }

    async function category(
      status: MasterDataStatus = MasterDataStatus.ACTIVE,
    ) {
      const record = identity();
      return db.category.create({
        data: {
          ...record,
          slug: record.code.toLowerCase(),
          level: 0,
          status,
          createdById: actorId,
          updatedById: actorId,
        },
      });
    }

    it('archives, restores non-active, and reactivates through normal Category validation', async () => {
      const record = await category();
      await lifecycle.transition(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
        {
          version: 1,
          targetStatus: MasterDataStatus.ARCHIVED,
        },
        actorId,
      );
      const restored = await lifecycle.restore(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
        { version: 2 },
        actorId,
      );
      expect(restored).toMatchObject({
        status: 'DEPRECATED',
        version: 3,
        activationWorkflowRequired: true,
      });
      expect(
        await db.category.findUniqueOrThrow({ where: { id: record.id } }),
      ).toMatchObject({ status: 'DEPRECATED', version: 3 });
      const audit = await db.auditLog.findFirstOrThrow({
        where: {
          entityId: record.id,
          action: 'MASTER_DATA_LIFECYCLE_RESTORED',
        },
      });
      expect(audit.actorId).toBe(actorId);
      expect(audit.metadata).toMatchObject({
        before: { status: 'ARCHIVED', version: 2 },
        after: { status: 'DEPRECATED', version: 3 },
      });
      expect(
        await catalog.updateCategory(
          record.id,
          { version: 3, status: MasterDataStatus.ACTIVE },
          actorId,
        ),
      ).toMatchObject({ status: 'ACTIVE', version: 4 });
    });

    it('restores Vehicle masters through the same database guard', async () => {
      const record = await db.vehicleMake.create({
        data: {
          ...identity(),
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      await lifecycle.transition(
        'VEHICLE',
        Entity.VEHICLE_MAKE,
        record.id,
        { version: 1, targetStatus: MasterDataStatus.ARCHIVED },
        actorId,
      );
      expect(
        await lifecycle.restore(
          'VEHICLE',
          Entity.VEHICLE_MAKE,
          record.id,
          { version: 2 },
          actorId,
        ),
      ).toMatchObject({ status: 'DEPRECATED', version: 3 });
      expect(
        await db.auditLog.count({
          where: {
            entityId: record.id,
            action: 'MASTER_DATA_LIFECYCLE_RESTORED',
          },
        }),
      ).toBe(1);
    });

    it('still rejects direct Archived → Active and Archived → Draft database writes', async () => {
      const record = await category();
      await lifecycle.transition(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
        { version: 1, targetStatus: MasterDataStatus.ARCHIVED },
        actorId,
      );
      for (const status of [MasterDataStatus.ACTIVE, MasterDataStatus.DRAFT]) {
        await expect(
          db.category.update({ where: { id: record.id }, data: { status } }),
        ).rejects.toThrow();
        expect(
          await db.category.findUniqueOrThrow({ where: { id: record.id } }),
        ).toMatchObject({ status: 'ARCHIVED', version: 2 });
      }
    });

    it('rejects stale restoration without updating the record or creating a restore audit', async () => {
      const record = await category();
      await lifecycle.transition(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
        { version: 1, targetStatus: MasterDataStatus.ARCHIVED },
        actorId,
      );
      await expect(
        lifecycle.restore(
          'CATALOG',
          Entity.CATEGORY,
          record.id,
          { version: 1 },
          actorId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'MASTER_DATA_LIFECYCLE_VERSION_CONFLICT' },
      });
      expect(
        await db.category.findUniqueOrThrow({ where: { id: record.id } }),
      ).toMatchObject({ status: 'ARCHIVED', version: 2 });
      expect(
        await db.auditLog.count({
          where: {
            entityId: record.id,
            action: 'MASTER_DATA_LIFECYCLE_RESTORED',
          },
        }),
      ).toBe(0);
    });

    it('rolls restoration back if the actor foreign key cannot be satisfied', async () => {
      const record = await category();
      await lifecycle.transition(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
        { version: 1, targetStatus: MasterDataStatus.ARCHIVED },
        actorId,
      );
      await expect(
        lifecycle.restore(
          'CATALOG',
          Entity.CATEGORY,
          record.id,
          { version: 2 },
          randomUUID(),
        ),
      ).rejects.toThrow();
      expect(
        await db.category.findUniqueOrThrow({ where: { id: record.id } }),
      ).toMatchObject({ status: 'ARCHIVED', version: 2 });
      expect(
        await db.auditLog.count({
          where: {
            entityId: record.id,
            action: 'MASTER_DATA_LIFECYCLE_RESTORED',
          },
        }),
      ).toBe(0);
    });

    it('blocks archive while Active children depend on the record', async () => {
      const record = await category();
      await db.productFamily.create({
        data: {
          ...identity(),
          categoryId: record.id,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      await expect(
        lifecycle.transition(
          'CATALOG',
          Entity.CATEGORY,
          record.id,
          { version: 1, targetStatus: MasterDataStatus.ARCHIVED },
          actorId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES' },
      });
      expect(
        await db.category.findUniqueOrThrow({ where: { id: record.id } }),
      ).toMatchObject({ status: 'ACTIVE', version: 1 });
      expect(await db.auditLog.count({ where: { entityId: record.id } })).toBe(
        0,
      );
    });

    it('permanently deletes an unused Draft and retains immutable audit evidence', async () => {
      const record = await category(MasterDataStatus.DRAFT);
      expect(
        await lifecycle.removalPreflight('CATALOG', Entity.CATEGORY, record.id),
      ).toMatchObject({ canPermanentlyDelete: true });
      await lifecycle.permanentDelete(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
        { version: 1, reason: 'Unused test Draft created in error.' },
        actorId,
      );
      expect(
        await db.category.findUnique({ where: { id: record.id } }),
      ).toBeNull();
      expect(
        await db.auditLog.count({
          where: {
            entityId: record.id,
            action: 'MASTER_DATA_PERMANENTLY_DELETED',
            actorId,
          },
        }),
      ).toBe(1);
    });

    it('blocks referenced Draft deletion with dependency counts and preserves the child', async () => {
      const record = await category(MasterDataStatus.DRAFT);
      const child = await db.productFamily.create({
        data: {
          ...identity(),
          categoryId: record.id,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      const preflight = await lifecycle.removalPreflight(
        'CATALOG',
        Entity.CATEGORY,
        record.id,
      );
      expect(preflight.canPermanentlyDelete).toBe(false);
      expect(preflight.dependencies).toContainEqual({
        key: 'productFamilies',
        label: 'Part Groups',
        count: 1,
      });
      await expect(
        lifecycle.permanentDelete(
          'CATALOG',
          Entity.CATEGORY,
          record.id,
          { version: 1, reason: 'Attempt a referenced Draft deletion.' },
          actorId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'MASTER_DATA_PERMANENT_DELETE_BLOCKED' },
      });
      expect(
        await db.productFamily.findUnique({ where: { id: child.id } }),
      ).not.toBeNull();
      expect(
        await db.category.findUnique({ where: { id: record.id } }),
      ).not.toBeNull();
    });

    it('removes only the Product Type Attribute relationship, retaining its master and audit', async () => {
      const parent = await category();
      const type = identity();
      const productType = await db.productType.create({
        data: {
          ...type,
          slug: type.code.toLowerCase(),
          categoryId: parent.id,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      const attribute = await db.attributeDefinition.create({
        data: {
          ...identity(),
          dataType: AttributeDataType.TEXT,
          scope: AttributeScope.PRODUCT,
          status: MasterDataStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      const assignment = await db.productTypeAttributeAssignment.create({
        data: {
          productTypeId: productType.id,
          attributeId: attribute.id,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      await assignments.deleteAssignmentsBulk(
        productType.id,
        { assignments: [{ id: assignment.id, version: 1 }] },
        actorId,
      );
      expect(
        await db.productTypeAttributeAssignment.findUnique({
          where: { id: assignment.id },
        }),
      ).toBeNull();
      expect(
        await db.attributeDefinition.findUnique({
          where: { id: attribute.id },
        }),
      ).toMatchObject({ status: 'ACTIVE' });
      expect(
        await db.auditLog.count({
          where: { action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_UNASSIGNED', actorId },
        }),
      ).toBe(1);
    });
  },
);
