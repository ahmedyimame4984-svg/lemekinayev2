import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  MasterReferenceService,
  type AttributeMasterInstallResult,
  type CanonicalAttributeMasterStatus,
} from '../reference-data/master-reference.service.js';
import {
  CatalogCanonicalCriteriaLibraryService,
  type CanonicalCriteriaLibraryInstallResult,
  type CanonicalCriteriaLibraryStatus,
} from './catalog-canonical-criteria-library.service.js';
import {
  CatalogCanonicalProductLibraryService,
  type CanonicalProductCatalogInstallResult,
  type CanonicalProductCatalogStatus,
} from './catalog-canonical-product-library.service.js';

export interface ProfessionalCatalogBaselineStatus {
  ready: boolean;
  reconciliationInProgress: boolean;
  attributes: CanonicalAttributeMasterStatus;
  catalog: CanonicalProductCatalogStatus;
  criteria: CanonicalCriteriaLibraryStatus;
}

export interface ProfessionalCatalogBaselineReconcileResult
  extends ProfessionalCatalogBaselineStatus {
  reconciled: {
    attributes: AttributeMasterInstallResult;
    catalog: CanonicalProductCatalogInstallResult;
    criteria: CanonicalCriteriaLibraryInstallResult;
  };
}

@Injectable()
export class CatalogProfessionalBaselineService {
  private reconciliationInProgress = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly referenceData: MasterReferenceService,
    private readonly canonicalProducts: CatalogCanonicalProductLibraryService,
    private readonly canonicalCriteria: CatalogCanonicalCriteriaLibraryService,
  ) {}

  async status(): Promise<ProfessionalCatalogBaselineStatus> {
    return this.readStatus(this.reconciliationInProgress);
  }

  async reconcile(
    actorId: string,
  ): Promise<ProfessionalCatalogBaselineReconcileResult> {
    if (this.reconciliationInProgress) {
      throw new ConflictException({
        code: 'PROFESSIONAL_CATALOG_RECONCILIATION_IN_PROGRESS',
        message: 'Professional Catalog Baseline reconciliation is already running.',
      });
    }

    this.reconciliationInProgress = true;

    try {
      // Dependency order matters:
      // 1. Criteria reference canonical Attributes.
      // 2. Criteria target canonical Product Types.
      // 3. Canonical assignments can only materialize after both exist.
      const attributes = await this.referenceData.reconcileAttributes(actorId);
      const catalog = await this.canonicalProducts.install(actorId);
      const criteria = await this.canonicalCriteria.install(actorId);

      const status = await this.readStatus(false);

      await this.database.auditLog.create({
        data: {
          actorId,
          action: 'PROFESSIONAL_AUTOMOTIVE_CATALOG_BASELINE_RECONCILED',
          entityType: 'ProfessionalCatalogBaseline',
          entityId: actorId,
          metadata: {
            nonDestructive: true,
            retrySafe: true,
            hierarchy: 'CATEGORY_PART_GROUP_PRODUCT_TYPE',
            ready: status.ready,
            attributes: {
              ready: status.attributes.ready,
              expected: {
                attributeGroups: status.attributes.expected.attributeGroups,
                unitDimensions: status.attributes.expected.unitDimensions,
                attributeUnits: status.attributes.expected.attributeUnits,
                optionSets: status.attributes.expected.optionSets,
                optionValues: status.attributes.expected.optionValues,
                attributes: status.attributes.expected.attributes,
                attributeAliases: status.attributes.expected.attributeAliases,
                allowedValues: status.attributes.expected.allowedValues,
              },
            },
            catalog: {
              categories: status.catalog.categories,
              partGroups: status.catalog.partGroups,
              productTypes: status.catalog.productTypes,
            },
            criteria: {
              templates: status.criteria.templates,
              attributes: status.criteria.attributes,
              productTypeTargets: status.criteria.productTypeTargets,
              assignments: status.criteria.assignments,
            },
          },
        },
      });

      return {
        ...status,
        reconciled: {
          attributes,
          catalog,
          criteria,
        },
      };
    } finally {
      this.reconciliationInProgress = false;
    }
  }

  private async readStatus(
    reconciliationInProgress: boolean,
  ): Promise<ProfessionalCatalogBaselineStatus> {
    const [attributes, catalog, criteria] = await Promise.all([
      this.referenceData.canonicalAttributeStatus(),
      this.canonicalProducts.status(),
      this.canonicalCriteria.status(),
    ]);

    const ready =
      attributes.valid &&
      attributes.ready &&
      catalog.valid &&
      catalog.categories.installed === catalog.categories.expected &&
      catalog.partGroups.installed === catalog.partGroups.expected &&
      catalog.productTypes.installed === catalog.productTypes.expected &&
      criteria.valid &&
      criteria.templates.installed === criteria.templates.expected &&
      criteria.attributes.resolved === criteria.attributes.expected &&
      criteria.productTypeTargets.resolvedCodes ===
        criteria.productTypeTargets.expectedCodes &&
      criteria.productTypeTargets.unmatchedCodes.length === 0 &&
      criteria.assignments.installed === criteria.assignments.expected;

    return {
      ready,
      reconciliationInProgress,
      attributes,
      catalog,
      criteria,
    };
  }
}
