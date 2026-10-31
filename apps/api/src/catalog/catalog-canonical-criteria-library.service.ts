import { ConflictException, Injectable } from '@nestjs/common';
import {
  MasterDataStatus,
  Prisma,
  ProductTypeAttributeAssignmentOrigin,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import {
  CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES,
  CANONICAL_CRITERIA_TEMPLATE_LIBRARY_VALIDATION,
  type CanonicalCriteriaTemplateItemSpec,
} from '../scripts/canonical-criteria-template-library.js';

export interface CanonicalCriteriaLibraryStatus {
  valid: boolean;
  validationErrors: string[];
  templates: {
    expected: number;
    installed: number;
  };
  attributes: {
    expected: number;
    resolved: number;
  };
  productTypeTargets: {
    expectedCodes: number;
    resolvedCodes: number;
    unmatchedCodes: string[];
  };
  assignments: {
    expected: number;
    installed: number;
  };
}

export interface CanonicalCriteriaLibraryInstallResult
  extends CanonicalCriteriaLibraryStatus {
  createdTemplates: number;
  updatedTemplates: number;
  createdItems: number;
  updatedItems: number;
  removedItems: number;
  createdTargets: number;
  removedTargets: number;
  createdAssignments: number;
  updatedAssignments: number;
  removedAssignments: number;
}

@Injectable()
export class CatalogCanonicalCriteriaLibraryService {
  constructor(private readonly database: DatabaseService) {}

  async status(): Promise<CanonicalCriteriaLibraryStatus> {
    const templateCodes = CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.map(
      (template) => template.code,
    );
    const attributeCodes = this.attributeCodes();
    const targetCodes = this.targetCodes();

    const [installedTemplates, attributes, productTypes] = await Promise.all([
      this.database.productTypeCriteriaTemplate.count({
        where: { code: { in: templateCodes } },
      }),
      this.database.attributeDefinition.findMany({
        where: { code: { in: attributeCodes } },
        select: { id: true, code: true, defaultUnitId: true },
      }),
      this.database.productType.findMany({
        where: { code: { in: targetCodes } },
        select: { id: true, code: true },
      }),
    ]);

    const attributeByCode = new Map(
      attributes.map((attribute) => [attribute.code, attribute]),
    );
    const productTypeByCode = new Map(
      productTypes.map((productType) => [productType.code, productType.id]),
    );
    const expectedAssignments = this.expectedAssignmentSpecs(
      attributeByCode,
      productTypeByCode,
    );

    const assignments =
      productTypes.length === 0 || attributes.length === 0
        ? []
        : await this.database.productTypeAttributeAssignment.findMany({
            where: {
              productTypeId: { in: productTypes.map((item) => item.id) },
              attributeId: { in: attributes.map((item) => item.id) },
            },
            select: {
              productTypeId: true,
              attributeId: true,
              requirement: true,
              displayMode: true,
              displayOrder: true,
              validationRule: true,
              conditionalRule: true,
              defaultUnitId: true,
              searchable: true,
              filterable: true,
              comparable: true,
              variantDefining: true,
              marketplaceVisible: true,
              sellerEditable: true,
            },
          });
    const assignmentByKey = new Map(
      assignments.map((assignment) => [
        `${assignment.productTypeId}:${assignment.attributeId}`,
        assignment,
      ]),
    );
    const installedAssignments = [...expectedAssignments.entries()].filter(
      ([key, expected]) => {
        const assignment = assignmentByKey.get(key);
        return (
          assignment !== undefined &&
          !this.assignmentNeedsUpdate(
            assignment,
            expected.spec,
            expected.defaultUnitId,
          )
        );
      },
    ).length;

    const resolvedTargets = new Set(productTypes.map((item) => item.code));

    return {
      valid: CANONICAL_CRITERIA_TEMPLATE_LIBRARY_VALIDATION.length === 0,
      validationErrors: [...CANONICAL_CRITERIA_TEMPLATE_LIBRARY_VALIDATION],
      templates: {
        expected: templateCodes.length,
        installed: installedTemplates,
      },
      attributes: {
        expected: attributeCodes.length,
        resolved: attributes.length,
      },
      productTypeTargets: {
        expectedCodes: targetCodes.length,
        resolvedCodes: resolvedTargets.size,
        unmatchedCodes: targetCodes.filter((code) => !resolvedTargets.has(code)),
      },
      assignments: {
        expected: expectedAssignments.size,
        installed: installedAssignments,
      },
    };
  }

  async install(
    actorId: string,
  ): Promise<CanonicalCriteriaLibraryInstallResult> {
    if (CANONICAL_CRITERIA_TEMPLATE_LIBRARY_VALIDATION.length > 0) {
      throw new ConflictException({
        code: 'CANONICAL_CRITERIA_LIBRARY_INVALID',
        message: 'Canonical Criteria Template library validation failed',
        details: {
          errors: CANONICAL_CRITERIA_TEMPLATE_LIBRARY_VALIDATION,
        },
      });
    }

    const attributeCodes = this.attributeCodes();
    const targetCodes = this.targetCodes();

    return this.database.$transaction(
      async (tx) => {
        const [attributes, productTypes] = await Promise.all([
          tx.attributeDefinition.findMany({
            where: { code: { in: attributeCodes } },
          }),
          tx.productType.findMany({
            where: { code: { in: targetCodes } },
            select: { id: true, code: true, status: true },
          }),
        ]);

        const attributeByCode = new Map(
          attributes.map((attribute) => [attribute.code, attribute]),
        );
        const missingAttributes = attributeCodes.filter(
          (code) => !attributeByCode.has(code),
        );
        const inactiveAttributes = attributes
          .filter((attribute) => attribute.status !== MasterDataStatus.ACTIVE)
          .map((attribute) => attribute.code);

        if (missingAttributes.length > 0 || inactiveAttributes.length > 0) {
          throw new ConflictException({
            code: 'CANONICAL_CRITERIA_LIBRARY_ATTRIBUTE_MISMATCH',
            message:
              'Canonical Criteria Templates require the current active Master Attribute Library',
            details: {
              missingAttributeCodes: missingAttributes,
              inactiveAttributeCodes: inactiveAttributes,
            },
          });
        }

        const productTypeByCode = new Map(
          productTypes.map((productType) => [productType.code, productType]),
        );

        let createdTemplates = 0;
        let updatedTemplates = 0;
        let createdItems = 0;
        let updatedItems = 0;
        let removedItems = 0;
        let createdTargets = 0;
        let removedTargets = 0;
        let createdAssignments = 0;
        let updatedAssignments = 0;
        let removedAssignments = 0;

        for (const spec of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
          const resolvedTargetIds = spec.targetProductTypeCodes
            .map((code) => productTypeByCode.get(code)?.id)
            .filter((id): id is string => Boolean(id));
          const templateStatus =
            resolvedTargetIds.length > 0
              ? MasterDataStatus.ACTIVE
              : MasterDataStatus.DRAFT;

          let template =
            await tx.productTypeCriteriaTemplate.findUnique({
              where: { code: spec.code },
            });

          if (!template) {
            template = await tx.productTypeCriteriaTemplate.create({
              data: {
                productFamilyId: null,
                code: spec.code,
                name: spec.name,
                description: spec.description,
                status: templateStatus,
                createdById: actorId,
                updatedById: actorId,
              },
            });
            createdTemplates += 1;
          } else if (
            template.name !== spec.name ||
            template.description !== spec.description ||
            template.productFamilyId !== null ||
            template.status !== templateStatus
          ) {
            template = await tx.productTypeCriteriaTemplate.update({
              where: { id: template.id },
              data: {
                productFamilyId: null,
                name: spec.name,
                description: spec.description,
                status: templateStatus,
                version: { increment: 1 },
                updatedById: actorId,
              },
            });
            updatedTemplates += 1;
          }

          const existingTargets =
            await tx.productTypeCriteriaTemplateTarget.findMany({
              where: { templateId: template.id },
              select: { productTypeId: true },
            });
          const desiredTargetIds = new Set(resolvedTargetIds);
          const staleTargetIds = existingTargets
            .map((target) => target.productTypeId)
            .filter((id) => !desiredTargetIds.has(id));

          if (staleTargetIds.length > 0) {
            const removed =
              await tx.productTypeCriteriaTemplateTarget.deleteMany({
                where: {
                  templateId: template.id,
                  productTypeId: { in: staleTargetIds },
                },
              });
            removedTargets += removed.count;
          }

          const existingTargetIds = new Set(
            existingTargets.map((target) => target.productTypeId),
          );
          for (const productTypeId of resolvedTargetIds) {
            if (existingTargetIds.has(productTypeId)) continue;
            await tx.productTypeCriteriaTemplateTarget.create({
              data: { templateId: template.id, productTypeId },
            });
            createdTargets += 1;
          }

          const existingItems =
            await tx.productTypeCriteriaTemplateItem.findMany({
              where: { templateId: template.id },
              include: {
                attribute: { select: { code: true } },
              },
            });
          const existingItemByAttributeCode = new Map(
            existingItems.map((item) => [item.attribute.code, item]),
          );
          const desiredAttributeCodes = new Set(
            spec.items.map((item) => item.attributeCode),
          );
          const staleItems = existingItems.filter(
            (item) => !desiredAttributeCodes.has(item.attribute.code),
          );

          if (staleItems.length > 0) {
            const removed =
              await tx.productTypeCriteriaTemplateItem.deleteMany({
                where: { id: { in: staleItems.map((item) => item.id) } },
              });
            removedItems += removed.count;
          }

          for (const itemSpec of spec.items) {
            const attribute = attributeByCode.get(itemSpec.attributeCode);
            if (!attribute) {
              throw new ConflictException({
                code: 'CANONICAL_CRITERIA_LIBRARY_ATTRIBUTE_MISMATCH',
                message: `Missing Attribute ${itemSpec.attributeCode}`,
              });
            }

            const itemStatus =
              templateStatus === MasterDataStatus.ACTIVE
                ? MasterDataStatus.ACTIVE
                : MasterDataStatus.DRAFT;
            const requirement =
              itemSpec.requirement === 'MANDATORY'
                ? ProductTypeAttributeRequirement.MANDATORY
                : ProductTypeAttributeRequirement.OPTIONAL;
            const existing = existingItemByAttributeCode.get(
              itemSpec.attributeCode,
            );

            if (!existing) {
              await tx.productTypeCriteriaTemplateItem.create({
                data: {
                  templateId: template.id,
                  attributeId: attribute.id,
                  requirement,
                  displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
                  displayOrder: itemSpec.displayOrder,
                  validationRule: Prisma.JsonNull,
                  conditionalRule: Prisma.JsonNull,
                  defaultUnitId: attribute.defaultUnitId,
                  searchable: itemSpec.searchable,
                  filterable: itemSpec.filterable,
                  comparable: itemSpec.comparable,
                  variantDefining: itemSpec.variantDefining,
                  marketplaceVisible: itemSpec.marketplaceVisible,
                  sellerEditable: itemSpec.sellerEditable,
                  status: itemStatus,
                  createdById: actorId,
                  updatedById: actorId,
                },
              });
              createdItems += 1;
              continue;
            }

            if (this.itemNeedsUpdate(existing, itemSpec, attribute.defaultUnitId, itemStatus)) {
              await tx.productTypeCriteriaTemplateItem.update({
                where: { id: existing.id },
                data: {
                  requirement,
                  displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
                  displayOrder: itemSpec.displayOrder,
                  validationRule: Prisma.JsonNull,
                  conditionalRule: Prisma.JsonNull,
                  defaultUnitId: attribute.defaultUnitId,
                  searchable: itemSpec.searchable,
                  filterable: itemSpec.filterable,
                  comparable: itemSpec.comparable,
                  variantDefining: itemSpec.variantDefining,
                  marketplaceVisible: itemSpec.marketplaceVisible,
                  sellerEditable: itemSpec.sellerEditable,
                  status: itemStatus,
                  version: { increment: 1 },
                  updatedById: actorId,
                },
              });
              updatedItems += 1;
            }
          }

          const resolvedTargets = spec.targetProductTypeCodes
            .map((code) => productTypeByCode.get(code))
            .filter(
              (
                productType,
              ): productType is {
                id: string;
                code: string;
                status: MasterDataStatus;
              } => Boolean(productType),
            );
          const desiredAttributeIds = spec.items
            .map((itemSpec) => attributeByCode.get(itemSpec.attributeCode)?.id)
            .filter((id): id is string => Boolean(id));
          const existingAssignments =
            resolvedTargets.length === 0 || desiredAttributeIds.length === 0
              ? []
              : await tx.productTypeAttributeAssignment.findMany({
                  where: {
                    productTypeId: {
                      in: resolvedTargets.map((productType) => productType.id),
                    },
                    attributeId: { in: desiredAttributeIds },
                  },
                });
          const existingAssignmentByKey = new Map(
            existingAssignments.map((assignment) => [
              `${assignment.productTypeId}:${assignment.attributeId}`,
              assignment,
            ]),
          );

          for (const productType of resolvedTargets) {
            for (const itemSpec of spec.items) {
              const attribute = attributeByCode.get(itemSpec.attributeCode);
              if (!attribute) continue;

              const requirement =
                itemSpec.requirement === 'MANDATORY'
                  ? ProductTypeAttributeRequirement.MANDATORY
                  : ProductTypeAttributeRequirement.OPTIONAL;
              const key = `${productType.id}:${attribute.id}`;
              const existing = existingAssignmentByKey.get(key);

              if (!existing) {
                await tx.productTypeAttributeAssignment.create({
                  data: {
                    productTypeId: productType.id,
                    attributeId: attribute.id,
                    requirement,
                    displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
                    displayOrder: itemSpec.displayOrder,
                    validationRule: Prisma.JsonNull,
                    conditionalRule: Prisma.JsonNull,
                    defaultUnitId: attribute.defaultUnitId,
                    searchable: itemSpec.searchable,
                    filterable: itemSpec.filterable,
                    comparable: itemSpec.comparable,
                    variantDefining: itemSpec.variantDefining,
                    marketplaceVisible: itemSpec.marketplaceVisible,
                    sellerEditable: itemSpec.sellerEditable,
                    origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
                    status:
                      productType.status === MasterDataStatus.ACTIVE
                        ? MasterDataStatus.ACTIVE
                        : MasterDataStatus.DRAFT,
                    createdById: actorId,
                    updatedById: actorId,
                  },
                });
                createdAssignments += 1;
                continue;
              }

              if (
                this.assignmentNeedsUpdate(
                  existing,
                  itemSpec,
                  attribute.defaultUnitId,
                )
              ) {
                await tx.productTypeAttributeAssignment.update({
                  where: { id: existing.id },
                  data: {
                    requirement,
                    displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
                    displayOrder: itemSpec.displayOrder,
                    validationRule: Prisma.JsonNull,
                    conditionalRule: Prisma.JsonNull,
                    defaultUnitId: attribute.defaultUnitId,
                    searchable: itemSpec.searchable,
                    filterable: itemSpec.filterable,
                    comparable: itemSpec.comparable,
                    variantDefining: itemSpec.variantDefining,
                    marketplaceVisible: itemSpec.marketplaceVisible,
                    sellerEditable: itemSpec.sellerEditable,
                    version: { increment: 1 },
                    updatedById: actorId,
                  },
                });
                updatedAssignments += 1;
              }
            }
          }
        }

        const attributeIdByCode = new Map(
          attributes.map((attribute) => [attribute.code, attribute.id]),
        );
        const productTypeIdByCode = new Map(
          productTypes.map((productType) => [
            productType.code,
            productType.id,
          ]),
        );
        const desiredAssignmentKeys = this.expectedAssignmentKeys(
          attributeIdByCode,
          productTypeIdByCode,
        );

        const canonicalAssignments =
          await tx.productTypeAttributeAssignment.findMany({
            where: {
              origin: ProductTypeAttributeAssignmentOrigin.CANONICAL,
            },
            select: {
              id: true,
              productTypeId: true,
              attributeId: true,
            },
          });
        const staleCanonicalAssignmentIds = canonicalAssignments
          .filter(
            (assignment) =>
              !desiredAssignmentKeys.has(
                `${assignment.productTypeId}:${assignment.attributeId}`,
              ),
          )
          .map((assignment) => assignment.id);

        if (staleCanonicalAssignmentIds.length > 0) {
          const removed = await tx.productTypeAttributeAssignment.deleteMany({
            where: { id: { in: staleCanonicalAssignmentIds } },
          });
          removedAssignments += removed.count;
        }

        const resolvedCodes = new Set(productTypes.map((item) => item.code));
        const unmatchedCodes = targetCodes.filter(
          (code) => !resolvedCodes.has(code),
        );
        const expectedAssignments = desiredAssignmentKeys.size;

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CANONICAL_AUTOMOTIVE_CRITERIA_LIBRARY_INSTALLED',
            entityType: 'ProductTypeCriteriaTemplate',
            metadata: {
              templateCount: CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.length,
              createdTemplates,
              updatedTemplates,
              createdItems,
              updatedItems,
              removedItems,
              createdTargets,
              removedTargets,
              createdAssignments,
              updatedAssignments,
              removedAssignments,
              canonicalAssignmentCount: expectedAssignments,
              unmatchedProductTypeCodes: unmatchedCodes,
            },
          },
        });

        return {
          valid: true,
          validationErrors: [],
          templates: {
            expected: CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.length,
            installed: CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.length,
          },
          attributes: {
            expected: attributeCodes.length,
            resolved: attributes.length,
          },
          productTypeTargets: {
            expectedCodes: targetCodes.length,
            resolvedCodes: resolvedCodes.size,
            unmatchedCodes,
          },
          assignments: {
            expected: expectedAssignments,
            installed: expectedAssignments,
          },
          createdTemplates,
          updatedTemplates,
          createdItems,
          updatedItems,
          removedItems,
          createdTargets,
          removedTargets,
          createdAssignments,
          updatedAssignments,
          removedAssignments,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 300_000,
      },
    );
  }

  private attributeCodes(): string[] {
    return [
      ...new Set(
        CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.flatMap((template) =>
          template.items.map((item) => item.attributeCode),
        ),
      ),
    ].sort();
  }

  private targetCodes(): string[] {
    return [
      ...new Set(
        CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES.flatMap(
          (template) => template.targetProductTypeCodes,
        ),
      ),
    ].sort();
  }

  private expectedAssignmentSpecs(
    attributeByCode: ReadonlyMap<
      string,
      { id: string; defaultUnitId: string | null }
    >,
    productTypeByCode: ReadonlyMap<string, string>,
  ): Map<
    string,
    { spec: CanonicalCriteriaTemplateItemSpec; defaultUnitId: string | null }
  > {
    const assignments = new Map<
      string,
      { spec: CanonicalCriteriaTemplateItemSpec; defaultUnitId: string | null }
    >();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const productTypeCode of template.targetProductTypeCodes) {
        const productTypeId = productTypeByCode.get(productTypeCode);
        if (!productTypeId) continue;

        for (const item of template.items) {
          const attribute = attributeByCode.get(item.attributeCode);
          if (!attribute) continue;
          assignments.set(
            `${productTypeId}:${attribute.id}`,
            { spec: item, defaultUnitId: attribute.defaultUnitId },
          );
        }
      }
    }

    return assignments;
  }

  private expectedAssignmentKeys(
    attributeByCode: ReadonlyMap<string, string>,
    productTypeByCode: ReadonlyMap<string, string>,
  ): Set<string> {
    const keys = new Set<string>();

    for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
      for (const productTypeCode of template.targetProductTypeCodes) {
        const productTypeId = productTypeByCode.get(productTypeCode);
        if (!productTypeId) continue;

        for (const item of template.items) {
          const attributeId = attributeByCode.get(item.attributeCode);
          if (!attributeId) continue;
          keys.add(`${productTypeId}:${attributeId}`);
        }
      }
    }

    return keys;
  }

  private assignmentNeedsUpdate(
    existing: {
      requirement: ProductTypeAttributeRequirement;
      displayMode: ProductTypeAttributeDisplayMode;
      displayOrder: number;
      validationRule: Prisma.JsonValue | null;
      conditionalRule: Prisma.JsonValue | null;
      defaultUnitId: string | null;
      searchable: boolean;
      filterable: boolean;
      comparable: boolean;
      variantDefining: boolean;
      marketplaceVisible: boolean;
      sellerEditable: boolean;
    },
    spec: CanonicalCriteriaTemplateItemSpec,
    defaultUnitId: string | null,
  ): boolean {
    const requirement =
      spec.requirement === 'MANDATORY'
        ? ProductTypeAttributeRequirement.MANDATORY
        : ProductTypeAttributeRequirement.OPTIONAL;

    return (
      existing.requirement !== requirement ||
      existing.displayMode !== ProductTypeAttributeDisplayMode.VISIBLE ||
      existing.displayOrder !== spec.displayOrder ||
      existing.validationRule !== null ||
      existing.conditionalRule !== null ||
      existing.defaultUnitId !== defaultUnitId ||
      existing.searchable !== spec.searchable ||
      existing.filterable !== spec.filterable ||
      existing.comparable !== spec.comparable ||
      existing.variantDefining !== spec.variantDefining ||
      existing.marketplaceVisible !== spec.marketplaceVisible ||
      existing.sellerEditable !== spec.sellerEditable
    );
  }

  private itemNeedsUpdate(
    existing: {
      requirement: ProductTypeAttributeRequirement;
      displayMode: ProductTypeAttributeDisplayMode;
      displayOrder: number;
      validationRule: Prisma.JsonValue | null;
      conditionalRule: Prisma.JsonValue | null;
      defaultUnitId: string | null;
      searchable: boolean;
      filterable: boolean;
      comparable: boolean;
      variantDefining: boolean;
      marketplaceVisible: boolean;
      sellerEditable: boolean;
      status: MasterDataStatus;
    },
    spec: CanonicalCriteriaTemplateItemSpec,
    defaultUnitId: string | null,
    status: MasterDataStatus,
  ): boolean {
    const requirement =
      spec.requirement === 'MANDATORY'
        ? ProductTypeAttributeRequirement.MANDATORY
        : ProductTypeAttributeRequirement.OPTIONAL;

    return (
      existing.requirement !== requirement ||
      existing.displayMode !== ProductTypeAttributeDisplayMode.VISIBLE ||
      existing.displayOrder !== spec.displayOrder ||
      existing.validationRule !== null ||
      existing.conditionalRule !== null ||
      existing.defaultUnitId !== defaultUnitId ||
      existing.searchable !== spec.searchable ||
      existing.filterable !== spec.filterable ||
      existing.comparable !== spec.comparable ||
      existing.variantDefining !== spec.variantDefining ||
      existing.marketplaceVisible !== spec.marketplaceVisible ||
      existing.sellerEditable !== spec.sellerEditable ||
      existing.status !== status
    );
  }
}
