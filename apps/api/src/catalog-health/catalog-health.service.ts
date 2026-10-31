import { Injectable } from '@nestjs/common';
import {
  ArticleSource,
  MasterDataStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { ArticleValidationService } from '../product/article-validation.service.js';
import {
  CatalogQualityEntityType,
  CatalogQualityIssue,
  type CatalogHealthLowCompletenessArticleDto,
  type CatalogHealthOeCollisionDto,
  type CatalogHealthProductTypeSampleDto,
  type CatalogHealthResponseDto,
  type CatalogQualityFindingDto,
  type CatalogQualityFindingPageDto,
  type CatalogQualityFindingQueryDto,
} from './dto/catalog-health.dto.js';

type OeCollisionCountRow = { count: number };
type OeCollisionSampleRow = {
  normalized_part_number: string;
  issuer_brand: string | null;
  article_brand: string | null;
  product_type: string;
  article_count: number;
};

type QualityProductTypeRow = {
  id: string;
  code: string;
  name: string;
};

type QualityFitmentArticleRow = {
  id: string;
  name: string;
  product_type: string;
  brand: string | null;
};

type QualityOeCollisionRow = OeCollisionSampleRow & {
  group_id: string;
  article_ids: string[];
};

const COMPLETENESS_SAMPLE_LIMIT = 20;
const LOW_COMPLETENESS_SAMPLE_LIMIT = 10;
const PRODUCT_TYPE_SAMPLE_LIMIT = 10;
const OE_COLLISION_SAMPLE_LIMIT = 10;

@Injectable()
export class CatalogHealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly articleValidation: ArticleValidationService,
  ) {}

  async getHealth(): Promise<CatalogHealthResponseDto> {
    const [
      productTypes,
      articleTotal,
      activeArticles,
      sellerAwaitingReview,
      sellerDraftCandidates,
      activeWithoutRequiredVerifiedFitment,
      oeCollisionCount,
      oeCollisionSamples,
      activeConfigurations,
      activeConfigurationsWithoutEngine,
      incompleteActiveConfigurations,
      activeModelsWithoutConfigurations,
      activeGenerationsWithoutConfigurations,
    ] = await Promise.all([
      this.database.productType.findMany({
        where: { status: MasterDataStatus.ACTIVE },
        select: {
          id: true,
          code: true,
          name: true,
          currentSchemaVersion: { select: { snapshot: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.database.product.count({
        where: { status: { not: ProductStatus.ARCHIVED } },
      }),
      this.database.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.database.product.count({
        where: {
          articleSource: ArticleSource.SELLER_SUBMISSION,
          status: ProductStatus.DRAFT,
        },
      }),
      this.database.product.findMany({
        where: {
          articleSource: ArticleSource.SELLER_SUBMISSION,
          status: ProductStatus.DRAFT,
        },
        select: { id: true, name: true },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take: COMPLETENESS_SAMPLE_LIMIT,
      }),
      this.countActiveArticlesWithoutRequiredVerifiedFitment(),
      this.countOeCollisionGroups(),
      this.listOeCollisionSamples(),
      this.database.vehicleConfiguration.count({
        where: { status: MasterDataStatus.ACTIVE },
      }),
      this.database.vehicleConfiguration.count({
        where: {
          status: MasterDataStatus.ACTIVE,
          engineId: null,
        },
      }),
      this.database.vehicleConfiguration.count({
        where: {
          status: MasterDataStatus.ACTIVE,
          OR: [
            { generationId: null },
            { trimId: null },
            { engineId: null },
            { transmissionId: null },
            { bodyTypeId: null },
            { marketId: null },
          ],
        },
      }),
      this.database.vehicleModel.count({
        where: {
          status: MasterDataStatus.ACTIVE,
          configurations: { none: { status: MasterDataStatus.ACTIVE } },
        },
      }),
      this.database.vehicleGeneration.count({
        where: {
          status: MasterDataStatus.ACTIVE,
          configurations: { none: { status: MasterDataStatus.ACTIVE } },
        },
      }),
    ]);

    const productTypeHealth = this.productTypeHealth(productTypes);
    const lowCompleteness = await this.lowCompletenessSamples(
      sellerDraftCandidates,
    );

    const actionItems =
      productTypeHealth.withoutPublishedSchema +
      productTypeHealth.withoutRequiredCriteria +
      activeWithoutRequiredVerifiedFitment +
      oeCollisionCount +
      incompleteActiveConfigurations +
      activeModelsWithoutConfigurations +
      activeGenerationsWithoutConfigurations +
      lowCompleteness.total;

    const status: CatalogHealthResponseDto['status'] =
      activeWithoutRequiredVerifiedFitment > 0 ||
      incompleteActiveConfigurations > 0
        ? 'CRITICAL'
        : actionItems > 0
          ? 'ATTENTION'
          : 'HEALTHY';

    return {
      generatedAt: new Date().toISOString(),
      status,
      actionItems,
      productTypes: {
        active: productTypes.length,
        withoutPublishedSchema: productTypeHealth.withoutPublishedSchema,
        withoutRequiredCriteria: productTypeHealth.withoutRequiredCriteria,
        samples: productTypeHealth.samples,
      },
      articles: {
        total: articleTotal,
        active: activeArticles,
        sellerAwaitingReview,
        activeWithoutRequiredVerifiedFitment,
        completenessSampleEvaluated: sellerDraftCandidates.length,
        lowCompletenessInSample: lowCompleteness.total,
        lowCompletenessSamples: lowCompleteness.samples,
      },
      oeReferences: {
        collisionGroups: oeCollisionCount,
        samples: oeCollisionSamples,
      },
      vehicles: {
        activeConfigurations,
        activeConfigurationsWithoutEngine,
        incompleteActiveConfigurations,
        activeModelsWithoutConfigurations,
        activeGenerationsWithoutConfigurations,
      },
    };
  }

  private productTypeHealth(
    productTypes: Array<{
      id: string;
      code: string;
      name: string;
      currentSchemaVersion: { snapshot: Prisma.JsonValue } | null;
    }>,
  ): {
    withoutPublishedSchema: number;
    withoutRequiredCriteria: number;
    samples: CatalogHealthProductTypeSampleDto[];
  } {
    let withoutPublishedSchema = 0;
    let withoutRequiredCriteria = 0;
    const samples: CatalogHealthProductTypeSampleDto[] = [];

    for (const productType of productTypes) {
      if (!productType.currentSchemaVersion) {
        withoutPublishedSchema += 1;
        this.pushProductTypeSample(samples, productType, 'NO_PUBLISHED_SCHEMA');
        continue;
      }

      if (!this.hasRequiredCriteria(productType.currentSchemaVersion.snapshot)) {
        withoutRequiredCriteria += 1;
        this.pushProductTypeSample(samples, productType, 'NO_REQUIRED_CRITERIA');
      }
    }

    return { withoutPublishedSchema, withoutRequiredCriteria, samples };
  }

  private pushProductTypeSample(
    samples: CatalogHealthProductTypeSampleDto[],
    productType: { id: string; code: string; name: string },
    issue: CatalogHealthProductTypeSampleDto['issue'],
  ): void {
    if (samples.length >= PRODUCT_TYPE_SAMPLE_LIMIT) return;
    samples.push({
      id: productType.id,
      code: productType.code,
      name: productType.name,
      issue,
    });
  }

  private hasRequiredCriteria(snapshot: Prisma.JsonValue): boolean {
    if (!this.isRecord(snapshot) || !Array.isArray(snapshot.attributes)) {
      return false;
    }

    return snapshot.attributes.some((candidate) => {
      if (!this.isRecord(candidate)) return false;
      return (
        candidate.requirement === 'MANDATORY' ||
        candidate.requirement === 'CONDITIONAL'
      );
    });
  }

  private async lowCompletenessSamples(
    articles: Array<{ id: string; name: string }>,
  ): Promise<{
    total: number;
    samples: CatalogHealthLowCompletenessArticleDto[];
  }> {
    const evaluated: CatalogHealthLowCompletenessArticleDto[] = [];

    for (let start = 0; start < articles.length; start += 5) {
      const batch = articles.slice(start, start + 5);
      const results = await Promise.all(
        batch.map(async (article) => {
          const validation = await this.articleValidation.validate(article.id);
          if (validation.qualityScore >= 80) return null;
          return {
            articleId: article.id,
            name: article.name,
            qualityScore: validation.qualityScore,
            qualityBand: validation.qualityBand as 'NEEDS_WORK' | 'POOR',
            issueCount: validation.issues.length,
            issueAreas: [...new Set(validation.issues.map((issue) => issue.area))],
          } satisfies CatalogHealthLowCompletenessArticleDto;
        }),
      );
      evaluated.push(
        ...results.filter(
          (item): item is CatalogHealthLowCompletenessArticleDto =>
            item !== null,
        ),
      );
    }

    evaluated.sort(
      (left, right) =>
        left.qualityScore - right.qualityScore ||
        right.issueCount - left.issueCount ||
        left.name.localeCompare(right.name),
    );

    return {
      total: evaluated.length,
      samples: evaluated.slice(0, LOW_COMPLETENESS_SAMPLE_LIMIT),
    };
  }

  private async countActiveArticlesWithoutRequiredVerifiedFitment(): Promise<number> {
    const rows = await this.database.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "products" p
        JOIN "product_type_schema_versions" s
          ON s."id" = p."schema_version_id"
        WHERE p."status" = 'ACTIVE'
          AND COALESCE(
            s."snapshot" #>> '{articleRequirements,fitment}',
            s."snapshot" #>> '{requirements,fitment}',
            'OPTIONAL'
          ) = 'REQUIRED'
          AND NOT EXISTS (
            SELECT 1
            FROM "vehicle_compatibilities" vc
            WHERE vc."product_id" = p."id"
              AND vc."status" = 'ACTIVE'
              AND vc."verification_status" IN ('VERIFIED', 'APPROVED')
          )
      `,
    );
    return rows[0]?.count ?? 0;
  }

  private async countOeCollisionGroups(): Promise<number> {
    const rows = await this.database.$queryRaw<OeCollisionCountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM (
          SELECT
            pn."brand_id",
            pn."normalized_part_number",
            p."brand_id",
            p."product_type_id"
          FROM "part_numbers" pn
          JOIN "products" p ON p."id" = pn."product_id"
          WHERE pn."part_number_type" = 'OE'
            AND pn."status" IN ('DRAFT', 'ACTIVE')
            AND p."status" IN ('DRAFT', 'ACTIVE')
          GROUP BY
            pn."brand_id",
            pn."normalized_part_number",
            p."brand_id",
            p."product_type_id"
          HAVING COUNT(DISTINCT p."id") > 1
        ) collisions
      `,
    );
    return rows[0]?.count ?? 0;
  }

  private async listOeCollisionSamples(): Promise<CatalogHealthOeCollisionDto[]> {
    const rows = await this.database.$queryRaw<OeCollisionSampleRow[]>(
      Prisma.sql`
        SELECT
          pn."normalized_part_number",
          issuer."name" AS "issuer_brand",
          article_brand."name" AS "article_brand",
          pt."name" AS "product_type",
          COUNT(DISTINCT p."id")::int AS "article_count"
        FROM "part_numbers" pn
        JOIN "products" p ON p."id" = pn."product_id"
        JOIN "product_types" pt ON pt."id" = p."product_type_id"
        LEFT JOIN "brands" issuer ON issuer."id" = pn."brand_id"
        LEFT JOIN "brands" article_brand ON article_brand."id" = p."brand_id"
        WHERE pn."part_number_type" = 'OE'
          AND pn."status" IN ('DRAFT', 'ACTIVE')
          AND p."status" IN ('DRAFT', 'ACTIVE')
        GROUP BY
          pn."brand_id",
          pn."normalized_part_number",
          p."brand_id",
          p."product_type_id",
          issuer."name",
          article_brand."name",
          pt."name"
        HAVING COUNT(DISTINCT p."id") > 1
        ORDER BY
          COUNT(DISTINCT p."id") DESC,
          pn."normalized_part_number" ASC
        LIMIT ${OE_COLLISION_SAMPLE_LIMIT}
      `,
    );

    return rows.map((row) => ({
      normalizedPartNumber: row.normalized_part_number,
      issuerBrand: row.issuer_brand,
      articleBrand: row.article_brand,
      productType: row.product_type,
      articleCount: row.article_count,
    }));
  }

  async getFindings(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    switch (query.issue) {
      case CatalogQualityIssue.NO_PUBLISHED_SCHEMA:
        return this.findProductTypesWithoutPublishedSchema(query);
      case CatalogQualityIssue.NO_REQUIRED_CRITERIA:
        return this.findProductTypesWithoutRequiredCriteria(query);
      case CatalogQualityIssue.SELLER_AWAITING_REVIEW:
        return this.findSellerArticlesAwaitingReview(query);
      case CatalogQualityIssue.REQUIRED_FITMENT_GAP:
        return this.findRequiredFitmentGaps(query);
      case CatalogQualityIssue.OE_COLLISION:
        return this.findOeCollisions(query);
      case CatalogQualityIssue.INCOMPLETE_CONFIGURATION:
        return this.findIncompleteVehicleConfigurations(query);
      case CatalogQualityIssue.MODEL_WITHOUT_CONFIGURATION:
        return this.findModelsWithoutConfigurations(query);
      case CatalogQualityIssue.GENERATION_WITHOUT_CONFIGURATION:
        return this.findGenerationsWithoutConfigurations(query);
      default:
        throw new Error(`Unsupported catalog quality issue: ${String(query.issue)}`);
    }
  }

  private async findProductTypesWithoutPublishedSchema(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const where = {
      status: MasterDataStatus.ACTIVE,
      currentSchemaVersionId: null,
    } satisfies Prisma.ProductTypeWhereInput;
    const [total, rows] = await Promise.all([
      this.database.productType.count({ where }),
      this.database.productType.findMany({
        where,
        select: { id: true, code: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
      }),
    ]);

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `product-type:${row.id}:schema`,
          issue: CatalogQualityIssue.NO_PUBLISHED_SCHEMA,
          severity: 'ATTENTION',
          entityType: CatalogQualityEntityType.PRODUCT_TYPE,
          entityId: row.id,
          title: row.name,
          code: row.code,
          context: ['Active Product Type has no published Schema.'],
        }),
      ),
      total,
      query,
    );
  }

  private async findProductTypesWithoutRequiredCriteria(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const countRows = await this.database.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "product_types" pt
        JOIN "product_type_schema_versions" s
          ON s."id" = pt."current_schema_version_id"
        WHERE pt."status" = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              COALESCE(s."snapshot" -> 'attributes', '[]'::jsonb)
            ) attribute
            WHERE attribute ->> 'requirement' IN ('MANDATORY', 'CONDITIONAL')
          )
      `,
    );
    const rows = await this.database.$queryRaw<QualityProductTypeRow[]>(
      Prisma.sql`
        SELECT
          pt."id"::text AS "id",
          pt."code",
          pt."name"
        FROM "product_types" pt
        JOIN "product_type_schema_versions" s
          ON s."id" = pt."current_schema_version_id"
        WHERE pt."status" = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              COALESCE(s."snapshot" -> 'attributes', '[]'::jsonb)
            ) attribute
            WHERE attribute ->> 'requirement' IN ('MANDATORY', 'CONDITIONAL')
          )
        ORDER BY pt."name" ASC, pt."id" ASC
        LIMIT ${query.pageSize}
        OFFSET ${this.skip(query)}
      `,
    );

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `product-type:${row.id}:criteria`,
          issue: CatalogQualityIssue.NO_REQUIRED_CRITERIA,
          severity: 'ATTENTION',
          entityType: CatalogQualityEntityType.PRODUCT_TYPE,
          entityId: row.id,
          title: row.name,
          code: row.code,
          context: [
            'Published Schema has no Mandatory or Conditional technical criteria.',
          ],
        }),
      ),
      countRows[0]?.count ?? 0,
      query,
    );
  }

  private async findSellerArticlesAwaitingReview(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const where = {
      articleSource: ArticleSource.SELLER_SUBMISSION,
      status: ProductStatus.DRAFT,
    } satisfies Prisma.ProductWhereInput;
    const [total, rows] = await Promise.all([
      this.database.product.count({ where }),
      this.database.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          submittedAt: true,
          productType: { select: { name: true } },
          brand: { select: { name: true } },
        },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
      }),
    ]);

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `article:${row.id}:seller-review`,
          issue: CatalogQualityIssue.SELLER_AWAITING_REVIEW,
          severity: 'ATTENTION',
          entityType: CatalogQualityEntityType.ARTICLE,
          entityId: row.id,
          title: row.name,
          context: [
            row.brand?.name ? `Brand: ${row.brand.name}` : 'Brand not supplied',
            `Product Type: ${row.productType.name}`,
            'Source: Seller submission',
            `Submitted: ${row.submittedAt.toISOString()}`,
          ],
        }),
      ),
      total,
      query,
    );
  }

  private async findRequiredFitmentGaps(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const total = await this.countActiveArticlesWithoutRequiredVerifiedFitment();
    const rows = await this.database.$queryRaw<QualityFitmentArticleRow[]>(
      Prisma.sql`
        SELECT
          p."id"::text AS "id",
          p."name",
          pt."name" AS "product_type",
          b."name" AS "brand"
        FROM "products" p
        JOIN "product_type_schema_versions" s
          ON s."id" = p."schema_version_id"
        JOIN "product_types" pt
          ON pt."id" = p."product_type_id"
        LEFT JOIN "brands" b
          ON b."id" = p."brand_id"
        WHERE p."status" = 'ACTIVE'
          AND COALESCE(
            s."snapshot" #>> '{articleRequirements,fitment}',
            s."snapshot" #>> '{requirements,fitment}',
            'OPTIONAL'
          ) = 'REQUIRED'
          AND NOT EXISTS (
            SELECT 1
            FROM "vehicle_compatibilities" vc
            WHERE vc."product_id" = p."id"
              AND vc."status" = 'ACTIVE'
              AND vc."verification_status" IN ('VERIFIED', 'APPROVED')
          )
        ORDER BY p."updated_at" DESC, p."id" ASC
        LIMIT ${query.pageSize}
        OFFSET ${this.skip(query)}
      `,
    );

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `article:${row.id}:fitment`,
          issue: CatalogQualityIssue.REQUIRED_FITMENT_GAP,
          severity: 'CRITICAL',
          entityType: CatalogQualityEntityType.ARTICLE,
          entityId: row.id,
          title: row.name,
          context: [
            row.brand ? `Brand: ${row.brand}` : 'Brand not supplied',
            `Product Type: ${row.product_type}`,
            'Active Article requires verified vehicle fitment but has none.',
          ],
        }),
      ),
      total,
      query,
    );
  }

  private async findOeCollisions(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const total = await this.countOeCollisionGroups();
    const rows = await this.database.$queryRaw<QualityOeCollisionRow[]>(
      Prisma.sql`
        SELECT
          MIN(pn."id"::text) AS "group_id",
          pn."normalized_part_number",
          issuer."name" AS "issuer_brand",
          article_brand."name" AS "article_brand",
          pt."name" AS "product_type",
          COUNT(DISTINCT p."id")::int AS "article_count",
          ARRAY_AGG(DISTINCT p."id"::text ORDER BY p."id"::text) AS "article_ids"
        FROM "part_numbers" pn
        JOIN "products" p ON p."id" = pn."product_id"
        JOIN "product_types" pt ON pt."id" = p."product_type_id"
        LEFT JOIN "brands" issuer ON issuer."id" = pn."brand_id"
        LEFT JOIN "brands" article_brand ON article_brand."id" = p."brand_id"
        WHERE pn."part_number_type" = 'OE'
          AND pn."status" IN ('DRAFT', 'ACTIVE')
          AND p."status" IN ('DRAFT', 'ACTIVE')
        GROUP BY
          pn."brand_id",
          pn."normalized_part_number",
          p."brand_id",
          p."product_type_id",
          issuer."name",
          article_brand."name",
          pt."name"
        HAVING COUNT(DISTINCT p."id") > 1
        ORDER BY
          COUNT(DISTINCT p."id") DESC,
          pn."normalized_part_number" ASC
        LIMIT ${query.pageSize}
        OFFSET ${this.skip(query)}
      `,
    );

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `oe-collision:${row.group_id}`,
          issue: CatalogQualityIssue.OE_COLLISION,
          severity: 'ATTENTION',
          entityType: CatalogQualityEntityType.OE_COLLISION,
          entityId: null,
          title: row.normalized_part_number,
          context: [
            row.issuer_brand
              ? `OE issuer: ${row.issuer_brand}`
              : 'OE issuer not supplied',
            row.article_brand
              ? `Article Brand: ${row.article_brand}`
              : 'Article Brand not supplied',
            `Product Type: ${row.product_type}`,
          ],
          relatedEntityIds: row.article_ids,
          metric: row.article_count,
          metricLabel: `${row.article_count} linked Articles`,
        }),
      ),
      total,
      query,
    );
  }

  private async findIncompleteVehicleConfigurations(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const where = {
      status: MasterDataStatus.ACTIVE,
      OR: [
        { generationId: null },
        { trimId: null },
        { engineId: null },
        { transmissionId: null },
        { bodyTypeId: null },
        { marketId: null },
      ],
    } satisfies Prisma.VehicleConfigurationWhereInput;
    const [total, rows] = await Promise.all([
      this.database.vehicleConfiguration.count({ where }),
      this.database.vehicleConfiguration.findMany({
        where,
        select: {
          id: true,
          identityCode: true,
          modelYear: true,
          generationId: true,
          trimId: true,
          engineId: true,
          transmissionId: true,
          bodyTypeId: true,
          marketId: true,
          make: { select: { name: true } },
          model: { select: { id: true, name: true } },
        },
        orderBy: [{ identityCode: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
      }),
    ]);

    return this.page(
      rows.map((row) => {
        const missing = [
          !row.generationId ? 'Generation' : null,
          !row.trimId ? 'Trim' : null,
          !row.engineId ? 'Engine' : null,
          !row.transmissionId ? 'Transmission' : null,
          !row.bodyTypeId ? 'Body Type' : null,
          !row.marketId ? 'Market' : null,
        ].filter((item): item is string => Boolean(item));

        return this.finding({
          id: `vehicle-configuration:${row.id}:incomplete`,
          issue: CatalogQualityIssue.INCOMPLETE_CONFIGURATION,
          severity: 'CRITICAL',
          entityType: CatalogQualityEntityType.VEHICLE_CONFIGURATION,
          entityId: row.id,
          title: `${row.make.name} ${row.model.name}${row.modelYear ? ` ${row.modelYear}` : ''}`,
          code: row.identityCode,
          context: [`Missing: ${missing.join(', ')}`],
          relatedEntityIds: [row.model.id, row.generationId].filter(
            (id): id is string => Boolean(id),
          ),
        });
      }),
      total,
      query,
    );
  }

  private async findModelsWithoutConfigurations(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const where = {
      status: MasterDataStatus.ACTIVE,
      configurations: { none: { status: MasterDataStatus.ACTIVE } },
    } satisfies Prisma.VehicleModelWhereInput;
    const [total, rows] = await Promise.all([
      this.database.vehicleModel.count({ where }),
      this.database.vehicleModel.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          make: { select: { name: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
      }),
    ]);

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `vehicle-model:${row.id}:no-config`,
          issue: CatalogQualityIssue.MODEL_WITHOUT_CONFIGURATION,
          severity: 'ATTENTION',
          entityType: CatalogQualityEntityType.VEHICLE_MODEL,
          entityId: row.id,
          title: `${row.make.name} ${row.name}`,
          code: row.code,
          context: ['Active Vehicle Model has no Active Configured Vehicle.'],
        }),
      ),
      total,
      query,
    );
  }

  private async findGenerationsWithoutConfigurations(
    query: CatalogQualityFindingQueryDto,
  ): Promise<CatalogQualityFindingPageDto> {
    const where = {
      status: MasterDataStatus.ACTIVE,
      configurations: { none: { status: MasterDataStatus.ACTIVE } },
    } satisfies Prisma.VehicleGenerationWhereInput;
    const [total, rows] = await Promise.all([
      this.database.vehicleGeneration.count({ where }),
      this.database.vehicleGeneration.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          startYear: true,
          endYear: true,
          model: {
            select: {
              id: true,
              name: true,
              make: { select: { name: true } },
            },
          },
        },
        orderBy: [{ startYear: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
      }),
    ]);

    return this.page(
      rows.map((row) =>
        this.finding({
          id: `vehicle-generation:${row.id}:no-config`,
          issue: CatalogQualityIssue.GENERATION_WITHOUT_CONFIGURATION,
          severity: 'ATTENTION',
          entityType: CatalogQualityEntityType.VEHICLE_GENERATION,
          entityId: row.id,
          title: `${row.model.make.name} ${row.model.name} · ${row.name}`,
          code: row.code,
          context: [
            row.startYear || row.endYear
              ? `Generation years: ${row.startYear ?? '?'}–${row.endYear ?? 'present'}`
              : 'Generation years not specified',
            'Active Generation has no Active Configured Vehicle.',
          ],
          relatedEntityIds: [row.model.id],
        }),
      ),
      total,
      query,
    );
  }

  private finding(
    input: Omit<
      CatalogQualityFindingDto,
      'code' | 'relatedEntityIds' | 'metric' | 'metricLabel'
    > &
      Partial<
        Pick<
          CatalogQualityFindingDto,
          'code' | 'relatedEntityIds' | 'metric' | 'metricLabel'
        >
      >,
  ): CatalogQualityFindingDto {
    return {
      ...input,
      code: input.code ?? null,
      relatedEntityIds: input.relatedEntityIds ?? [],
      metric: input.metric ?? null,
      metricLabel: input.metricLabel ?? null,
    };
  }

  private page(
    items: CatalogQualityFindingDto[],
    total: number,
    query: CatalogQualityFindingQueryDto,
  ): CatalogQualityFindingPageDto {
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  private skip(query: CatalogQualityFindingQueryDto): number {
    return (query.page - 1) * query.pageSize;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
