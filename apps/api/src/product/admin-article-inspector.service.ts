import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PartNumberType,
  Prisma,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { ArticleValidationService } from './article-validation.service.js';
import type {
  AdminArticleInspectorDto,
  AdminArticleInspectorFitmentCriterionDto,
  AdminArticleInspectorFitmentDto,
  AdminArticleInspectorQueryDto,
  AdminArticleInspectorRelationDto,
  AdminArticleInspectorTechnicalValueDto,
} from './dto/admin-article-inspector.dto.js';

const coreSelect = {
  id: true,
  name: true,
  shortDescription: true,
  description: true,
  manufacturerNotes: true,
  status: true,
  version: true,
  packQuantity: true,
  articleSource: true,
  sourceReference: true,
  submittedAt: true,
  catalogReviewSubmittedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true } },
  productFamily: { select: { id: true, code: true, name: true } },
  productType: { select: { id: true, code: true, name: true } },
  brand: { select: { id: true, code: true, name: true } },
  sourceSeller: {
    select: {
      id: true,
      sellerCode: true,
      displayName: true,
      businessName: true,
    },
  },
  unitOfMeasure: {
    select: { id: true, code: true, name: true, symbol: true },
  },
  schemaVersion: {
    select: {
      schemaVersion: true,
      schemaHash: true,
      snapshot: true,
    },
  },
  attributeValues: {
    select: {
      valueString: true,
      valueNumeric: true,
      valueBoolean: true,
      valueReferenceId: true,
      valueJson: true,
      unit: true,
      unitDefinition: {
        select: { symbol: true },
      },
      attribute: {
        select: {
          code: true,
          name: true,
          dataType: true,
          group: { select: { name: true } },
          defaultUnit: { select: { symbol: true } },
        },
      },
    },
  },
  partNumbers: {
    select: {
      id: true,
      type: true,
      partNumber: true,
      normalizedPartNumber: true,
      isPrimary: true,
      status: true,
      issuerBrand: {
        select: { id: true, code: true, name: true },
      },
    },
    orderBy: [
      { isPrimary: 'desc' as const },
      { type: 'asc' as const },
      { normalizedPartNumber: 'asc' as const },
    ],
  },
  articleIdentifiers: {
    select: {
      id: true,
      type: true,
      value: true,
      normalizedValue: true,
      status: true,
    },
    orderBy: [
      { type: 'asc' as const },
      { normalizedValue: 'asc' as const },
    ],
  },
  assets: {
    select: {
      id: true,
      type: true,
      title: true,
      storageReference: true,
      mimeType: true,
      visibility: true,
      sortOrder: true,
      status: true,
    },
    orderBy: [
      { type: 'asc' as const },
      { sortOrder: 'asc' as const },
      { id: 'asc' as const },
    ],
  },
} satisfies Prisma.ProductSelect;

const fitmentSelect = {
  id: true,
  vehicleConfigurationId: true,
  fitmentType: true,
  source: true,
  verificationStatus: true,
  status: true,
  yearFrom: true,
  yearTo: true,
  position: true,
  notes: true,
  vehicleConfiguration: {
    select: {
      identityCode: true,
      modelYear: true,
      make: { select: { name: true } },
      model: { select: { name: true } },
      generation: { select: { name: true } },
      trim: { select: { name: true } },
      engine: { select: { name: true, code: true } },
      transmission: {
        select: { transmissionType: true, code: true },
      },
      bodyType: { select: { name: true } },
      market: { select: { name: true } },
    },
  },
  make: { select: { name: true } },
  model: { select: { name: true } },
  generation: { select: { name: true } },
  trim: { select: { name: true } },
  engine: { select: { name: true, code: true } },
  transmission: {
    select: { transmissionType: true, code: true },
  },
  bodyType: { select: { name: true } },
  market: { select: { name: true } },
  criteria: {
    select: {
      type: true,
      textValue: true,
      rangeFrom: true,
      rangeTo: true,
      productionFromYear: true,
      productionFromMonth: true,
      productionToYear: true,
      productionToMonth: true,
      axlePosition: true,
      installationPosition: true,
      isRequired: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.VehicleCompatibilitySelect;

const relatedArticleSelect = {
  id: true,
  name: true,
  status: true,
  brand: { select: { name: true } },
  partNumbers: {
    where: { type: PartNumberType.MANUFACTURER },
    select: { partNumber: true },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const relationSelect = {
  id: true,
  sourceArticleId: true,
  targetArticleId: true,
  type: true,
  note: true,
  componentQuantity: true,
  componentRole: true,
  componentOrder: true,
  status: true,
  sourceArticle: { select: relatedArticleSelect },
  targetArticle: { select: relatedArticleSelect },
} satisfies Prisma.ArticleRelationSelect;

type CoreRecord = Prisma.ProductGetPayload<{ select: typeof coreSelect }>;
type FitmentRecord = Prisma.VehicleCompatibilityGetPayload<{
  select: typeof fitmentSelect;
}>;
type RelationRecord = Prisma.ArticleRelationGetPayload<{
  select: typeof relationSelect;
}>;

@Injectable()
export class AdminArticleInspectorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly validation: ArticleValidationService,
  ) {}

  async get(
    articleId: string,
    query: AdminArticleInspectorQueryDto,
  ): Promise<AdminArticleInspectorDto> {
    const fitmentPage = query.fitmentPage ?? 1;
    const fitmentPageSize = query.fitmentPageSize ?? 25;
    const relationPage = query.relationPage ?? 1;
    const relationPageSize = query.relationPageSize ?? 25;
    const relationWhere: Prisma.ArticleRelationWhereInput = {
      OR: [{ sourceArticleId: articleId }, { targetArticleId: articleId }],
    };

    const [article, validation, fitmentTotal, fitments, relationTotal, relations] =
      await Promise.all([
        this.database.product.findUnique({
          where: { id: articleId },
          select: coreSelect,
        }),
        this.validation.validate(articleId),
        this.database.vehicleCompatibility.count({
          where: { productId: articleId },
        }),
        this.database.vehicleCompatibility.findMany({
          where: { productId: articleId },
          select: fitmentSelect,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (fitmentPage - 1) * fitmentPageSize,
          take: fitmentPageSize,
        }),
        this.database.articleRelation.count({ where: relationWhere }),
        this.database.articleRelation.findMany({
          where: relationWhere,
          select: relationSelect,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (relationPage - 1) * relationPageSize,
          take: relationPageSize,
        }),
      ]);

    if (!article) {
      throw new NotFoundException({
        code: 'MANUFACTURER_ARTICLE_NOT_FOUND',
        message: 'The Manufacturer Article was not found.',
      });
    }

    return {
      id: article.id,
      name: article.name,
      shortDescription: article.shortDescription,
      description: article.description,
      manufacturerNotes: article.manufacturerNotes,
      status: article.status,
      version: article.version,
      category: article.category,
      productFamily: article.productFamily,
      productType: article.productType,
      brand: article.brand,
      unitOfMeasure: article.unitOfMeasure,
      packQuantity:
        article.packQuantity === null ? null : Number(article.packQuantity),
      schemaVersion: article.schemaVersion.schemaVersion,
      schemaHash: article.schemaVersion.schemaHash,
      articleSource: article.articleSource,
      sourceReference: article.sourceReference,
      sourceSeller: article.sourceSeller,
      submittedAt: article.submittedAt,
      catalogReviewSubmittedAt: article.catalogReviewSubmittedAt,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      technicalValues: this.technicalValues(article),
      partNumbers: article.partNumbers,
      identifiers: article.articleIdentifiers,
      assets: article.assets,
      fitments: {
        items: fitments.map((fitment) => this.fitment(fitment)),
        total: fitmentTotal,
        page: fitmentPage,
        pageSize: fitmentPageSize,
        pageCount:
          fitmentTotal === 0 ? 0 : Math.ceil(fitmentTotal / fitmentPageSize),
      },
      relations: {
        items: relations.map((relation) =>
          this.relation(articleId, relation),
        ),
        total: relationTotal,
        page: relationPage,
        pageSize: relationPageSize,
        pageCount:
          relationTotal === 0
            ? 0
            : Math.ceil(relationTotal / relationPageSize),
      },
      validation: {
        readyForActivation: validation.readyForActivation,
        qualityScore: validation.qualityScore,
        qualityBand: validation.qualityBand,
        summary: validation.summary,
        issues: validation.issues,
      },
    };
  }

  private technicalValues(
    article: CoreRecord,
  ): AdminArticleInspectorTechnicalValueDto[] {
    const requirementByCode = this.attributeRequirements(
      article.schemaVersion.snapshot,
    );

    return article.attributeValues
      .map((row) => ({
        code: row.attribute.code,
        name: row.attribute.name,
        group: row.attribute.group?.name ?? null,
        dataType: row.attribute.dataType,
        requirement: requirementByCode.get(row.attribute.code) ?? null,
        value: this.attributeValue(row),
        unit:
          row.unitDefinition?.symbol ??
          row.unit ??
          row.attribute.defaultUnit?.symbol ??
          null,
      }))
      .sort((left, right) => {
        const groupComparison = (left.group ?? '').localeCompare(
          right.group ?? '',
        );
        return groupComparison || left.name.localeCompare(right.name);
      });
  }

  private attributeRequirements(snapshot: Prisma.JsonValue): Map<string, string> {
    const result = new Map<string, string>();
    if (!this.isRecord(snapshot) || !Array.isArray(snapshot.attributes)) {
      return result;
    }

    for (const item of snapshot.attributes) {
      if (!this.isRecord(item)) continue;
      const code = typeof item.code === 'string' ? item.code : null;
      const requirement =
        typeof item.requirement === 'string' ? item.requirement : null;
      if (code && requirement) result.set(code, requirement);
    }
    return result;
  }

  private attributeValue(
    row: CoreRecord['attributeValues'][number],
  ): unknown {
    if (row.valueString !== null) return row.valueString;
    if (row.valueNumeric !== null) return Number(row.valueNumeric);
    if (row.valueBoolean !== null) return row.valueBoolean;
    if (row.valueReferenceId !== null) return row.valueReferenceId;
    return row.valueJson;
  }

  private fitment(record: FitmentRecord): AdminArticleInspectorFitmentDto {
    const configuration = record.vehicleConfiguration;
    const make = configuration?.make.name ?? record.make?.name ?? null;
    const model = configuration?.model.name ?? record.model?.name ?? null;
    const generation =
      configuration?.generation?.name ?? record.generation?.name ?? null;
    const trim = configuration?.trim?.name ?? record.trim?.name ?? null;
    const engine = configuration?.engine ?? record.engine;
    const transmission = configuration?.transmission ?? record.transmission;
    const bodyType =
      configuration?.bodyType?.name ?? record.bodyType?.name ?? null;
    const market = configuration?.market?.name ?? record.market?.name ?? null;
    const modelYear = configuration?.modelYear ?? null;

    const identityParts = [
      make,
      model,
      modelYear ? String(modelYear) : null,
      generation,
      trim,
    ].filter((value): value is string => Boolean(value));
    const powertrainParts = [
      engine?.code ?? engine?.name ?? null,
      transmission?.code ?? transmission?.transmissionType ?? null,
    ].filter((value): value is string => Boolean(value));
    const contextParts = [bodyType, market].filter(
      (value): value is string => Boolean(value),
    );

    const targetLabel =
      [
        identityParts.join(' '),
        powertrainParts.length > 0 ? powertrainParts.join(' / ') : null,
        contextParts.length > 0 ? contextParts.join(' / ') : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ') || 'Structured vehicle fitment';

    return {
      id: record.id,
      vehicleConfigurationId: record.vehicleConfigurationId,
      targetLabel,
      identityCode: configuration?.identityCode ?? null,
      fitmentType: record.fitmentType,
      source: record.source,
      verificationStatus: record.verificationStatus,
      status: record.status,
      yearFrom: record.yearFrom,
      yearTo: record.yearTo,
      position: record.position,
      criteria: record.criteria.map((criterion) =>
        this.fitmentCriterion(criterion),
      ),
      notes: record.notes,
    };
  }

  private fitmentCriterion(
    criterion: FitmentRecord['criteria'][number],
  ): AdminArticleInspectorFitmentCriterionDto {
    const fragments: string[] = [];
    if (criterion.textValue) fragments.push(criterion.textValue);
    if (criterion.rangeFrom !== null || criterion.rangeTo !== null) {
      fragments.push(
        `${criterion.rangeFrom ?? '?'}–${criterion.rangeTo ?? '?'}`,
      );
    }
    if (
      criterion.productionFromYear !== null ||
      criterion.productionToYear !== null
    ) {
      fragments.push(
        `${this.yearMonth(
          criterion.productionFromYear,
          criterion.productionFromMonth,
        )}–${this.yearMonth(
          criterion.productionToYear,
          criterion.productionToMonth,
        )}`,
      );
    }
    if (criterion.axlePosition) fragments.push(criterion.axlePosition);
    if (criterion.installationPosition) {
      fragments.push(criterion.installationPosition);
    }

    return {
      type: criterion.type,
      label: fragments.join(' · ') || criterion.type,
      required: criterion.isRequired,
    };
  }

  private relation(
    articleId: string,
    relation: RelationRecord,
  ): AdminArticleInspectorRelationDto {
    const outgoing = relation.sourceArticleId === articleId;
    const related = outgoing
      ? relation.targetArticle
      : relation.sourceArticle;

    return {
      id: relation.id,
      direction: outgoing ? 'OUTGOING' : 'INCOMING',
      type: relation.type,
      relatedArticle: {
        id: related.id,
        name: related.name,
        brand: related.brand?.name ?? null,
        manufacturerPartNumber:
          related.partNumbers[0]?.partNumber ?? null,
        status: related.status,
      },
      note: relation.note,
      componentQuantity:
        relation.componentQuantity === null
          ? null
          : Number(relation.componentQuantity),
      componentRole: relation.componentRole,
      componentOrder: relation.componentOrder,
      status: relation.status,
    };
  }

  private yearMonth(
    year: number | null,
    month: number | null,
  ): string {
    if (year === null) return '?';
    return month === null
      ? String(year)
      : `${year}-${String(month).padStart(2, '0')}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
