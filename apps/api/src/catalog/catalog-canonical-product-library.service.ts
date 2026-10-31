import { ConflictException, Injectable } from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import {
  CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG,
  CANONICAL_PRODUCT_CATALOG_VALIDATION,
  canonicalCatalogStats,
  canonicalSlug,
} from '../scripts/canonical-product-catalog-library.js';

export interface CanonicalProductCatalogStatus {
  valid: boolean;
  validationErrors: string[];
  categories: { expected: number; installed: number };
  partGroups: { expected: number; installed: number };
  productTypes: { expected: number; installed: number };
}

export interface CanonicalProductCatalogInstallResult
  extends CanonicalProductCatalogStatus {
  createdCategories: number;
  updatedCategories: number;
  createdPartGroups: number;
  updatedPartGroups: number;
  createdProductTypes: number;
  updatedProductTypes: number;
}

@Injectable()
export class CatalogCanonicalProductLibraryService {
  constructor(private readonly database: DatabaseService) {}

  async status(): Promise<CanonicalProductCatalogStatus> {
    const stats = canonicalCatalogStats();
    const categoryCodes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.map(
      (category) => category.code,
    );
    const partGroupCodes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap(
      (category) => category.partGroups.map((group) => group.code),
    );
    const productTypeCodes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap(
      (category) =>
        category.partGroups.flatMap((group) =>
          group.productTypes.map((productType) => productType.code),
        ),
    );

    const [categories, partGroups, productTypes] = await Promise.all([
      this.database.category.count({
        where: { code: { in: categoryCodes } },
      }),
      this.database.productFamily.count({
        where: { code: { in: partGroupCodes } },
      }),
      this.database.productType.count({
        where: { code: { in: productTypeCodes } },
      }),
    ]);

    return {
      valid: CANONICAL_PRODUCT_CATALOG_VALIDATION.length === 0,
      validationErrors: [...CANONICAL_PRODUCT_CATALOG_VALIDATION],
      categories: { expected: stats.categories, installed: categories },
      partGroups: { expected: stats.partGroups, installed: partGroups },
      productTypes: { expected: stats.productTypes, installed: productTypes },
    };
  }

  async install(
    actorId: string,
  ): Promise<CanonicalProductCatalogInstallResult> {
    if (CANONICAL_PRODUCT_CATALOG_VALIDATION.length > 0) {
      throw new ConflictException({
        code: 'CANONICAL_PRODUCT_CATALOG_INVALID',
        message: 'Canonical automotive Product Catalog validation failed',
        details: { errors: CANONICAL_PRODUCT_CATALOG_VALIDATION },
      });
    }

    return this.database.$transaction(
      async (tx) => {
        const categoryCodes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.map(
          (category) => category.code,
        );
        const categorySlugs = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.map(
          (category) => canonicalSlug(category.code),
        );
        const partGroupCodes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap(
          (category) => category.partGroups.map((group) => group.code),
        );
        const productTypeCodes = CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap(
          (category) =>
            category.partGroups.flatMap((group) =>
              group.productTypes.map((productType) => productType.code),
            ),
        );
        const productTypeSlugs =
          CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap((category) =>
            category.partGroups.flatMap((group) =>
              group.productTypes.map((productType) =>
                canonicalSlug(productType.code),
              ),
            ),
          );

        const [
          existingCategories,
          categorySlugRows,
          existingPartGroups,
          existingProductTypes,
          productTypeSlugRows,
        ] = await Promise.all([
          tx.category.findMany({
            where: { code: { in: categoryCodes } },
          }),
          tx.category.findMany({
            where: { slug: { in: categorySlugs } },
            select: { code: true, slug: true },
          }),
          tx.productFamily.findMany({
            where: { code: { in: partGroupCodes } },
          }),
          tx.productType.findMany({
            where: { code: { in: productTypeCodes } },
          }),
          tx.productType.findMany({
            where: { slug: { in: productTypeSlugs } },
            select: { code: true, slug: true },
          }),
        ]);

        const categoryByCode = new Map(
          existingCategories.map((record) => [record.code, record]),
        );
        const partGroupByCode = new Map(
          existingPartGroups.map((record) => [record.code, record]),
        );
        const productTypeByCode = new Map(
          existingProductTypes.map((record) => [record.code, record]),
        );

        this.assertSlugOwnership(
          categorySlugRows,
          new Map(
            CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.map((category) => [
              canonicalSlug(category.code),
              category.code,
            ]),
          ),
          'Category',
        );
        this.assertSlugOwnership(
          productTypeSlugRows,
          new Map(
            CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.flatMap((category) =>
              category.partGroups.flatMap((group) =>
                group.productTypes.map((productType) => [
                  canonicalSlug(productType.code),
                  productType.code,
                ]),
              ),
            ),
          ),
          'Product Type',
        );

        let createdCategories = 0;
        let updatedCategories = 0;
        let createdPartGroups = 0;
        let updatedPartGroups = 0;
        let createdProductTypes = 0;
        let updatedProductTypes = 0;

        for (const [categoryIndex, categorySpec] of
          CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.entries()) {
          const categorySortOrder = (categoryIndex + 1) * 10;
          const categorySlug = canonicalSlug(categorySpec.code);
          let category = categoryByCode.get(categorySpec.code);

          if (category) {
            if (category.parentId !== null || category.level !== 0) {
              throw new ConflictException({
                code: 'CANONICAL_PRODUCT_CATALOG_CATEGORY_CONFLICT',
                message:
                  `Category ${categorySpec.code} exists in a legacy nested hierarchy`,
              });
            }

            if (
              category.name !== categorySpec.name ||
              category.slug !== categorySlug ||
              category.description !== categorySpec.description ||
              category.sortOrder !== categorySortOrder ||
              category.isLeaf !== true
            ) {
              category = await tx.category.update({
                where: { id: category.id },
                data: {
                  name: categorySpec.name,
                  slug: categorySlug,
                  description: categorySpec.description,
                  sortOrder: categorySortOrder,
                  isLeaf: true,
                  version: { increment: 1 },
                  updatedById: actorId,
                },
              });
              updatedCategories += 1;
            }
          } else {
            category = await tx.category.create({
              data: {
                parentId: null,
                code: categorySpec.code,
                name: categorySpec.name,
                slug: categorySlug,
                description: categorySpec.description,
                sortOrder: categorySortOrder,
                level: 0,
                isLeaf: true,
                status: MasterDataStatus.ACTIVE,
                createdById: actorId,
                updatedById: actorId,
              },
            });
            categoryByCode.set(category.code, category);
            createdCategories += 1;
          }

          for (const [groupIndex, groupSpec] of
            categorySpec.partGroups.entries()) {
            let group = partGroupByCode.get(groupSpec.code);

            if (group) {
              if (group.categoryId !== category.id) {
                throw new ConflictException({
                  code: 'CANONICAL_PRODUCT_CATALOG_PART_GROUP_CONFLICT',
                  message:
                    `Part Group ${groupSpec.code} already belongs to another Category`,
                  details: {
                    expectedCategoryCode: categorySpec.code,
                    actualCategoryId: group.categoryId,
                  },
                });
              }

              if (
                group.name !== groupSpec.name ||
                group.description !== groupSpec.description
              ) {
                group = await tx.productFamily.update({
                  where: { id: group.id },
                  data: {
                    name: groupSpec.name,
                    description: groupSpec.description,
                    version: { increment: 1 },
                    updatedById: actorId,
                  },
                });
                updatedPartGroups += 1;
              }
            } else {
              group = await tx.productFamily.create({
                data: {
                  categoryId: category.id,
                  code: groupSpec.code,
                  name: groupSpec.name,
                  description: groupSpec.description,
                  status: MasterDataStatus.ACTIVE,
                  createdById: actorId,
                  updatedById: actorId,
                },
              });
              partGroupByCode.set(group.code, group);
              createdPartGroups += 1;
            }

            for (const [productTypeIndex, productTypeSpec] of
              groupSpec.productTypes.entries()) {
              const sortOrder =
                (groupIndex + 1) * 1000 + (productTypeIndex + 1) * 10;
              const slug = canonicalSlug(productTypeSpec.code);
              const description =
                productTypeSpec.description ??
                `${productTypeSpec.name} automotive aftermarket Product Type.`;
              let productType = productTypeByCode.get(productTypeSpec.code);

              if (productType) {
                if (
                  productType.parentId !== null ||
                  productType.categoryId !== category.id ||
                  productType.productFamilyId !== group.id
                ) {
                  throw new ConflictException({
                    code: 'CANONICAL_PRODUCT_CATALOG_PRODUCT_TYPE_CONFLICT',
                    message:
                      `Product Type ${productTypeSpec.code} conflicts with the canonical Category → Part Group placement`,
                    details: {
                      expectedCategoryCode: categorySpec.code,
                      expectedPartGroupCode: groupSpec.code,
                      actualCategoryId: productType.categoryId,
                      actualPartGroupId: productType.productFamilyId,
                    },
                  });
                }

                if (
                  productType.name !== productTypeSpec.name ||
                  productType.slug !== slug ||
                  productType.description !== description ||
                  productType.sortOrder !== sortOrder
                ) {
                  productType = await tx.productType.update({
                    where: { id: productType.id },
                    data: {
                      name: productTypeSpec.name,
                      slug,
                      description,
                      sortOrder,
                      parentId: null,
                      version: { increment: 1 },
                      updatedById: actorId,
                    },
                  });
                  updatedProductTypes += 1;
                }
              } else {
                productType = await tx.productType.create({
                  data: {
                    categoryId: category.id,
                    productFamilyId: group.id,
                    parentId: null,
                    code: productTypeSpec.code,
                    name: productTypeSpec.name,
                    slug,
                    description,
                    sortOrder,
                    status: MasterDataStatus.ACTIVE,
                    createdById: actorId,
                    updatedById: actorId,
                  },
                });
                productTypeByCode.set(productType.code, productType);
                createdProductTypes += 1;
              }
            }
          }
        }

        const stats = canonicalCatalogStats();

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG_INSTALLED',
            entityType: 'ProductType',
            metadata: {
              hierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
              expectedCategories: stats.categories,
              expectedPartGroups: stats.partGroups,
              expectedProductTypes: stats.productTypes,
              createdCategories,
              updatedCategories,
              createdPartGroups,
              updatedPartGroups,
              createdProductTypes,
              updatedProductTypes,
            },
          },
        });

        return {
          valid: true,
          validationErrors: [],
          categories: {
            expected: stats.categories,
            installed: stats.categories,
          },
          partGroups: {
            expected: stats.partGroups,
            installed: stats.partGroups,
          },
          productTypes: {
            expected: stats.productTypes,
            installed: stats.productTypes,
          },
          createdCategories,
          updatedCategories,
          createdPartGroups,
          updatedPartGroups,
          createdProductTypes,
          updatedProductTypes,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 300_000,
      },
    );
  }

  private assertSlugOwnership(
    rows: Array<{ code: string; slug: string }>,
    canonicalOwners: Map<string, string>,
    entityName: string,
  ): void {
    for (const row of rows) {
      const expectedCode = canonicalOwners.get(row.slug);
      if (expectedCode && expectedCode !== row.code) {
        throw new ConflictException({
          code: 'CANONICAL_PRODUCT_CATALOG_SLUG_CONFLICT',
          message:
            `${entityName} slug ${row.slug} is already used by ${row.code}`,
          details: {
            slug: row.slug,
            expectedCode,
            actualCode: row.code,
          },
        });
      }
    }
  }
}
