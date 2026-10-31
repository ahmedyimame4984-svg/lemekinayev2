import { Injectable } from '@nestjs/common';
import {
  ArticleIdentifierType,
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { normalizePartNumber } from '../product/article-identity.js';
import type {
  CatalogSearchArticleResultDto,
  CatalogSearchBrandResultDto,
  CatalogSearchProductTypeResultDto,
  CatalogSearchVehicleResultDto,
  GlobalCatalogSearchQueryDto,
  GlobalCatalogSearchResponseDto,
} from './dto/global-catalog-search.dto.js';

const visibleIdentifierStatuses = [
  MasterDataStatus.DRAFT,
  MasterDataStatus.ACTIVE,
];

const visibleArticleIdentifierStatuses = [
  MasterDataStatus.ACTIVE,
];

const visibleIdentifierTypes = [
  PartNumberType.MANUFACTURER,
  PartNumberType.OE,
  PartNumberType.CROSS_REFERENCE,
  PartNumberType.AFTERMARKET,
  PartNumberType.OTHER,
];

const articleSelect = {
  id: true,
  name: true,
  brandId: true,
  productTypeId: true,
  brand: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  productType: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  partNumbers: {
    where: {
      status: { in: visibleIdentifierStatuses },
      type: { in: visibleIdentifierTypes },
    },
    select: {
      partNumber: true,
      normalizedPartNumber: true,
      type: true,
      isPrimary: true,
    },
  },
  articleIdentifiers: {
    where: {
      status: { in: visibleArticleIdentifierStatuses },
    },
    select: {
      value: true,
      normalizedValue: true,
      type: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ArticleRecord = Prisma.ProductGetPayload<{
  select: typeof articleSelect;
}>;

@Injectable()
export class GlobalCatalogSearchService {
  constructor(private readonly database: DatabaseService) {}

  async search(
    input: GlobalCatalogSearchQueryDto,
  ): Promise<GlobalCatalogSearchResponseDto> {
    const query = input.q.trim();
    const normalizedQuery = this.normalizeText(query);
    const normalizedPartNumber = normalizePartNumber(query);
    const limit = input.limit ?? 8;
    const candidateLimit = Math.max(limit * 5, 25);
    const tokens = this.searchTokens(query);

    const [brands, productTypes, directArticles, vehicles, criteriaRows] =
      await Promise.all([
        this.searchBrands(query, candidateLimit),
        this.searchProductTypes(query, candidateLimit),
        this.searchArticles(
          query,
          normalizedPartNumber,
          tokens,
          candidateLimit,
        ),
        this.searchVehicles(tokens, candidateLimit),
        this.searchCriteria(normalizedQuery, candidateLimit * 2),
      ]);

    const articleResults = new Map<
      string,
      CatalogSearchArticleResultDto
    >();

    for (const article of directArticles) {
      this.mergeArticleResult(
        articleResults,
        this.toArticleResult(
          article,
          query,
          normalizedPartNumber,
        ),
      );
    }

    for (const row of criteriaRows) {
      const searchable = this.searchableAttributeCodes(
        row.product.schemaVersion.snapshot,
      );
      if (!searchable.has(row.attribute.code)) continue;

      this.mergeArticleResult(articleResults, {
        ...this.toArticleResult(
          row.product,
          query,
          normalizedPartNumber,
        ),
        score: Math.max(
          75,
          this.scoreText(
            normalizedQuery,
            row.normalizedValue ?? '',
            90,
            82,
            75,
          ),
        ),
        matchedBy: [`CRITERIA:${row.attribute.code}`],
      });
    }

    return {
      query,
      normalizedQuery,
      articles: [...articleResults.values()]
        .sort((a, b) => this.scoreSort(a, b))
        .slice(0, limit),
      brands: brands
        .map((brand) => this.toBrandResult(brand, query))
        .sort((a, b) => this.scoreSort(a, b))
        .slice(0, limit),
      productTypes: productTypes
        .map((productType) =>
          this.toProductTypeResult(productType, query),
        )
        .sort((a, b) => this.scoreSort(a, b))
        .slice(0, limit),
      vehicles: vehicles
        .map((vehicle) => this.toVehicleResult(vehicle, query))
        .sort((a, b) => this.scoreSort(a, b))
        .slice(0, limit),
    };
  }

  private searchBrands(query: string, take: number) {
    return this.database.brand.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  private searchProductTypes(query: string, take: number) {
    const filters: Prisma.ProductTypeWhereInput[] =
      this.searchTokens(query).map((token) => ({
        OR: [
          { name: { contains: token, mode: 'insensitive' } },
          { code: { contains: token, mode: 'insensitive' } },
          { slug: { contains: token, mode: 'insensitive' } },
          {
            category: {
              name: { contains: token, mode: 'insensitive' },
            },
          },
          {
            productFamily: {
              is: {
                name: { contains: token, mode: 'insensitive' },
              },
            },
          },
        ],
      }));

    return this.database.productType.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        currentSchemaVersionId: { not: null },
        ...(filters.length > 0 ? { AND: filters } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: { select: { name: true } },
        productFamily: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  private searchArticles(
    query: string,
    normalizedPartNumber: string,
    tokens: string[],
    take: number,
  ): Promise<ArticleRecord[]> {
    const tokenFilters: Prisma.ProductWhereInput[] = tokens.map(
      (token) => ({
        OR: [
          { name: { contains: token, mode: 'insensitive' } },
          {
            brand: {
              is: {
                status: MasterDataStatus.ACTIVE,
                OR: [
                  { name: { contains: token, mode: 'insensitive' } },
                  { code: { contains: token, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            productType: {
              is: {
                status: MasterDataStatus.ACTIVE,
                OR: [
                  { name: { contains: token, mode: 'insensitive' } },
                  { code: { contains: token, mode: 'insensitive' } },
                ],
              },
            },
          },
          ...(normalizePartNumber(token).length >= 2
            ? [
                {
                  partNumbers: {
                    some: {
                      status: { in: visibleIdentifierStatuses },
                      type: { in: visibleIdentifierTypes },
                      normalizedPartNumber: {
                        contains: normalizePartNumber(token),
                      },
                    },
                  },
                },
                {
                  articleIdentifiers: {
                    some: {
                      status: { in: visibleArticleIdentifierStatuses },
                      normalizedValue: {
                        contains: normalizePartNumber(token),
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      }),
    );

    const identifierFilter: Prisma.ProductWhereInput | null =
      normalizedPartNumber.length >= 2
        ? {
            OR: [
              {
                partNumbers: {
                  some: {
                    status: { in: visibleIdentifierStatuses },
                    type: { in: visibleIdentifierTypes },
                    normalizedPartNumber: {
                      contains: normalizedPartNumber,
                    },
                  },
                },
              },
              {
                articleIdentifiers: {
                  some: {
                    status: { in: visibleArticleIdentifierStatuses },
                    normalizedValue: {
                      contains: normalizedPartNumber,
                    },
                  },
                },
              },
            ],
          }
        : null;

    return this.database.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        OR: [
          ...(tokenFilters.length > 0
            ? [{ AND: tokenFilters }]
            : []),
          ...(identifierFilter ? [identifierFilter] : []),
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: articleSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  private searchVehicles(tokens: string[], take: number) {
    const filters: Prisma.VehicleConfigurationWhereInput[] =
      tokens.map((token) => {
        const modelYear = this.modelYearToken(token);
        return {
          OR: [
            {
              make: {
                name: { contains: token, mode: 'insensitive' },
              },
            },
            {
              make: {
                code: { contains: token, mode: 'insensitive' },
              },
            },
            {
              model: {
                name: { contains: token, mode: 'insensitive' },
              },
            },
            {
              model: {
                code: { contains: token, mode: 'insensitive' },
              },
            },
            {
              generation: {
                is: {
                  OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { code: { contains: token, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              trim: {
                is: {
                  OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { code: { contains: token, mode: 'insensitive' } },
                    {
                      equipmentLevel: {
                        contains: token,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            },
            {
              engine: {
                is: {
                  OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { code: { contains: token, mode: 'insensitive' } },
                    { family: { contains: token, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              transmission: {
                is: {
                  OR: [
                    { code: { contains: token, mode: 'insensitive' } },
                    {
                      transmissionType: {
                        contains: token,
                        mode: 'insensitive',
                      },
                    },
                    {
                      driveType: {
                        contains: token,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            },
            {
              bodyType: {
                is: {
                  OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { code: { contains: token, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              market: {
                is: {
                  OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { code: { contains: token, mode: 'insensitive' } },
                  ],
                },
              },
            },
            ...(modelYear !== null ? [{ modelYear }] : []),
          ],
        };
      });

    return this.database.vehicleConfiguration.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        ...(filters.length > 0 ? { AND: filters } : {}),
      },
      select: {
        id: true,
        modelYear: true,
        make: { select: { name: true, code: true } },
        model: { select: { name: true, code: true } },
        generation: { select: { name: true, code: true } },
        trim: {
          select: {
            name: true,
            code: true,
            equipmentLevel: true,
          },
        },
        engine: {
          select: {
            name: true,
            code: true,
            family: true,
          },
        },
        transmission: {
          select: {
            code: true,
            transmissionType: true,
            driveType: true,
          },
        },
      },
      orderBy: [
        { make: { name: 'asc' } },
        { model: { name: 'asc' } },
        { modelYear: 'asc' },
        { id: 'asc' },
      ],
      take,
    });
  }

  private searchCriteria(query: string, take: number) {
    if (query.length < 2) return Promise.resolve([]);

    return this.database.productAttributeValue.findMany({
      where: {
        normalizedValue: {
          contains: query,
          mode: 'insensitive',
        },
        product: {
          status: ProductStatus.ACTIVE,
        },
      },
      select: {
        normalizedValue: true,
        attribute: {
          select: {
            code: true,
          },
        },
        product: {
          select: {
            ...articleSelect,
            schemaVersion: {
              select: {
                snapshot: true,
              },
            },
          },
        },
      },
      orderBy: [{ productId: 'asc' }, { attributeId: 'asc' }],
      take,
    });
  }

  private toBrandResult(
    brand: { id: string; code: string; name: string },
    query: string,
  ): CatalogSearchBrandResultDto {
    const nameScore = this.scoreText(query, brand.name, 125, 105, 85);
    const codeScore = this.scoreText(query, brand.code, 130, 110, 90);
    const matchedBy: string[] = [];
    if (nameScore > 0) matchedBy.push('BRAND_NAME');
    if (codeScore > 0) matchedBy.push('BRAND_CODE');

    return {
      id: brand.id,
      code: brand.code,
      name: brand.name,
      score: Math.max(nameScore, codeScore),
      matchedBy,
    };
  }

  private toProductTypeResult(
    productType: {
      id: string;
      code: string;
      name: string;
      category: { name: string };
      productFamily: { name: string } | null;
    },
    query: string,
  ): CatalogSearchProductTypeResultDto {
    const nameScore = this.scoreText(
      query,
      productType.name,
      120,
      100,
      80,
    );
    const codeScore = this.scoreText(
      query,
      productType.code,
      125,
      105,
      85,
    );
    const categoryScore = this.scoreText(
      query,
      productType.category.name,
      90,
      78,
      65,
    );
    const partGroupScore = productType.productFamily
      ? this.scoreText(
          query,
          productType.productFamily.name,
          95,
          82,
          68,
        )
      : 0;
    const hierarchyScore = this.scoreTokenCoverage(
      query,
      [
        productType.category.name,
        productType.productFamily?.name,
        productType.name,
        productType.code,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' '),
      76,
    );
    const matchedBy: string[] = [];
    if (nameScore > 0) matchedBy.push('PRODUCT_TYPE_NAME');
    if (codeScore > 0) matchedBy.push('PRODUCT_TYPE_CODE');
    if (categoryScore > 0) matchedBy.push('CATEGORY');
    if (partGroupScore > 0) matchedBy.push('PART_GROUP');
    if (hierarchyScore > 0 && matchedBy.length === 0) {
      matchedBy.push('PRODUCT_TYPE_HIERARCHY');
    }

    return {
      id: productType.id,
      code: productType.code,
      name: productType.name,
      categoryName: productType.category.name,
      partGroupName: productType.productFamily?.name ?? null,
      score: Math.max(
        nameScore,
        codeScore,
        categoryScore,
        partGroupScore,
        hierarchyScore,
      ),
      matchedBy,
    };
  }

  private toArticleResult(
    article: ArticleRecord,
    query: string,
    normalizedPartNumber: string,
  ): CatalogSearchArticleResultDto {
    const matchedBy = new Set<string>();
    let score = this.scoreText(query, article.name, 115, 95, 75);
    if (score > 0) matchedBy.add('ARTICLE_NAME');

    if (article.brand) {
      const brandScore = Math.max(
        this.scoreText(query, article.brand.name, 110, 92, 72),
        this.scoreText(query, article.brand.code, 115, 97, 77),
      );
      if (brandScore > 0) {
        matchedBy.add('BRAND');
        score = Math.max(score, brandScore);
      }
    }

    const productTypeScore = Math.max(
      this.scoreText(
        query,
        article.productType.name,
        105,
        88,
        68,
      ),
      this.scoreText(
        query,
        article.productType.code,
        110,
        93,
        73,
      ),
    );
    if (productTypeScore > 0) {
      matchedBy.add('PRODUCT_TYPE');
      score = Math.max(score, productTypeScore);
    }

    for (const identifier of article.partNumbers) {
      const identifierScore = this.scorePartNumber(
        normalizedPartNumber,
        identifier.normalizedPartNumber,
        identifier.type,
      );
      if (identifierScore <= 0) continue;

      matchedBy.add(this.identifierMatchLabel(identifier.type));
      score = Math.max(score, identifierScore);
    }

    for (const identifier of article.articleIdentifiers) {
      const identifierScore = this.scoreDirectIdentifier(
        normalizedPartNumber,
        identifier.normalizedValue,
        identifier.type,
      );
      if (identifierScore <= 0) continue;

      matchedBy.add(this.directIdentifierMatchLabel(identifier.type));
      score = Math.max(score, identifierScore);
    }

    const tokenCoverage = this.articleTokenCoverage(
      article,
      query,
    );
    if (tokenCoverage.matched) {
      score = Math.max(score, tokenCoverage.score);
      for (const label of tokenCoverage.matchedBy) {
        matchedBy.add(label);
      }
    }

    const primaryManufacturerPartNumber =
      article.partNumbers.find(
        (identifier) =>
          identifier.type === PartNumberType.MANUFACTURER &&
          identifier.isPrimary,
      )?.partNumber ?? null;

    return {
      id: article.id,
      name: article.name,
      brandId: article.brandId,
      brandName: article.brand?.name ?? null,
      productTypeId: article.productTypeId,
      productTypeName: article.productType.name,
      primaryManufacturerPartNumber,
      score,
      matchedBy: [...matchedBy],
    };
  }

  private toVehicleResult(
    vehicle: {
      id: string;
      modelYear: number | null;
      make: { name: string; code: string };
      model: { name: string; code: string };
      generation: { name: string; code: string | null } | null;
      trim: {
        name: string;
        code: string | null;
        equipmentLevel: string | null;
      } | null;
      engine: {
        name: string;
        code: string | null;
        family: string | null;
      } | null;
      transmission: {
        code: string | null;
        transmissionType: string;
        driveType: string | null;
      } | null;
    },
    query: string,
  ): CatalogSearchVehicleResultDto {
    const fields: Array<[string, string | null | undefined, number]> = [
      ['VEHICLE_MAKE', vehicle.make.name, 115],
      ['VEHICLE_MAKE_CODE', vehicle.make.code, 118],
      ['VEHICLE_MODEL', vehicle.model.name, 120],
      ['VEHICLE_MODEL_CODE', vehicle.model.code, 122],
      ['VEHICLE_GENERATION', vehicle.generation?.name, 112],
      ['VEHICLE_GENERATION_CODE', vehicle.generation?.code, 116],
      ['VEHICLE_TRIM', vehicle.trim?.name, 108],
      ['VEHICLE_TRIM_CODE', vehicle.trim?.code, 110],
      ['ENGINE_NAME', vehicle.engine?.name, 125],
      ['ENGINE_CODE', vehicle.engine?.code, 145],
      ['ENGINE_FAMILY', vehicle.engine?.family, 120],
      ['TRANSMISSION_CODE', vehicle.transmission?.code, 110],
      [
        'TRANSMISSION_TYPE',
        vehicle.transmission?.transmissionType,
        105,
      ],
    ];

    let score = 0;
    const matchedBy: string[] = [];
    for (const [label, value, exactScore] of fields) {
      if (!value) continue;
      const fieldScore = this.scoreText(
        query,
        value,
        exactScore,
        exactScore - 15,
        exactScore - 30,
      );
      if (fieldScore <= 0) continue;
      matchedBy.push(label);
      score = Math.max(score, fieldScore);
    }

    const combined = [
      vehicle.make.name,
      vehicle.model.name,
      vehicle.generation?.name,
      vehicle.trim?.name,
      vehicle.engine?.code,
      vehicle.engine?.name,
      vehicle.modelYear ? String(vehicle.modelYear) : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const yearScore =
      vehicle.modelYear !== null &&
      this.modelYearToken(query) === vehicle.modelYear
        ? 125
        : 0;
    if (yearScore > 0) matchedBy.push('MODEL_YEAR');

    score = Math.max(
      score,
      yearScore,
      this.scoreTokenCoverage(query, combined, 100),
    );
    if (score > 0 && matchedBy.length === 0) {
      matchedBy.push('VEHICLE_HIERARCHY');
    }

    return {
      vehicleConfigurationId: vehicle.id,
      make: vehicle.make.name,
      model: vehicle.model.name,
      generation: vehicle.generation?.name ?? null,
      trim: vehicle.trim?.name ?? null,
      engine:
        vehicle.engine?.code ??
        vehicle.engine?.name ??
        null,
      transmission:
        vehicle.transmission?.code ??
        vehicle.transmission?.transmissionType ??
        null,
      modelYear: vehicle.modelYear,
      score,
      matchedBy,
    };
  }

  private searchableAttributeCodes(
    snapshot: Prisma.JsonValue,
  ): Set<string> {
    if (!this.isRecord(snapshot)) return new Set();
    const value = snapshot.searchableAttributeCodes;
    if (!Array.isArray(value)) return new Set();

    return new Set(
      value.filter(
        (item): item is string =>
          typeof item === 'string' && item.length > 0,
      ),
    );
  }

  private mergeArticleResult(
    target: Map<string, CatalogSearchArticleResultDto>,
    incoming: CatalogSearchArticleResultDto,
  ): void {
    const existing = target.get(incoming.id);
    if (!existing) {
      target.set(incoming.id, incoming);
      return;
    }

    target.set(incoming.id, {
      ...existing,
      score: Math.max(existing.score, incoming.score),
      matchedBy: [
        ...new Set([...existing.matchedBy, ...incoming.matchedBy]),
      ],
    });
  }

  private articleTokenCoverage(
    article: ArticleRecord,
    query: string,
  ): { matched: boolean; score: number; matchedBy: string[] } {
    const tokens = this.searchTokens(query);
    if (tokens.length <= 1) {
      return { matched: false, score: 0, matchedBy: [] };
    }

    const matchedBy = new Set<string>();
    for (const token of tokens) {
      let tokenMatched = false;

      const textFields: Array<[string, string | null | undefined]> = [
        ['ARTICLE_NAME', article.name],
        ['BRAND', article.brand?.name],
        ['BRAND', article.brand?.code],
        ['PRODUCT_TYPE', article.productType.name],
        ['PRODUCT_TYPE', article.productType.code],
      ];

      for (const [label, value] of textFields) {
        if (!value) continue;
        if (this.scoreText(token, value, 1, 1, 1) > 0) {
          matchedBy.add(label);
          tokenMatched = true;
        }
      }

      const normalizedToken = normalizePartNumber(token);
      if (normalizedToken.length >= 2) {
        for (const identifier of article.partNumbers) {
          if (
            this.scorePartNumber(
              normalizedToken,
              identifier.normalizedPartNumber,
              identifier.type,
            ) > 0
          ) {
            matchedBy.add(this.identifierMatchLabel(identifier.type));
            tokenMatched = true;
          }
        }

        for (const identifier of article.articleIdentifiers) {
          if (
            this.scoreDirectIdentifier(
              normalizedToken,
              identifier.normalizedValue,
              identifier.type,
            ) > 0
          ) {
            matchedBy.add(this.directIdentifierMatchLabel(identifier.type));
            tokenMatched = true;
          }
        }
      }

      if (!tokenMatched) {
        return { matched: false, score: 0, matchedBy: [] };
      }
    }

    return {
      matched: true,
      score: 105 + Math.min(tokens.length, 8),
      matchedBy: [...matchedBy],
    };
  }

  private scorePartNumber(
    query: string,
    candidate: string,
    type: PartNumberType,
  ): number {
    if (!query || !candidate) return 0;
    const bonus =
      type === PartNumberType.MANUFACTURER
        ? 15
        : type === PartNumberType.OE
          ? 10
          : 0;

    if (candidate === query) return 160 + bonus;
    if (candidate.startsWith(query)) return 135 + bonus;
    if (candidate.includes(query)) return 112 + bonus;
    return 0;
  }

  private scoreDirectIdentifier(
    query: string,
    candidate: string,
    type: ArticleIdentifierType,
  ): number {
    if (!query || !candidate) return 0;
    const bonus = type === ArticleIdentifierType.TRADE_NUMBER ? 5 : 10;

    if (candidate === query) return 155 + bonus;
    if (candidate.startsWith(query)) return 130 + bonus;
    if (candidate.includes(query)) return 108 + bonus;
    return 0;
  }

  private directIdentifierMatchLabel(type: ArticleIdentifierType): string {
    return type === ArticleIdentifierType.TRADE_NUMBER
      ? 'TRADE_NUMBER'
      : 'GTIN';
  }

  private identifierMatchLabel(type: PartNumberType): string {
    switch (type) {
      case PartNumberType.MANUFACTURER:
        return 'MPN';
      case PartNumberType.OE:
        return 'OE';
      case PartNumberType.CROSS_REFERENCE:
        return 'CROSS_REFERENCE';
      case PartNumberType.AFTERMARKET:
        return 'AFTERMARKET_REFERENCE';
      case PartNumberType.OTHER:
        return 'OTHER_REFERENCE';
      case PartNumberType.SUPPLIER:
        return 'SUPPLIER_REFERENCE';
    }
  }

  private scoreText(
    query: string,
    candidate: string,
    exact: number,
    prefix: number,
    contains: number,
  ): number {
    const normalizedQuery = this.normalizeText(query);
    const normalizedCandidate = this.normalizeText(candidate);
    if (!normalizedQuery || !normalizedCandidate) return 0;
    if (normalizedCandidate === normalizedQuery) return exact;
    if (normalizedCandidate.startsWith(normalizedQuery)) return prefix;
    if (normalizedCandidate.includes(normalizedQuery)) return contains;
    return this.scoreTokenCoverage(
      normalizedQuery,
      normalizedCandidate,
      Math.max(contains - 10, 1),
    );
  }

  private scoreTokenCoverage(
    query: string,
    candidate: string,
    score: number,
  ): number {
    const tokens = this.searchTokens(query);
    if (tokens.length === 0) return 0;
    const normalizedCandidate = this.normalizeText(candidate);
    return tokens.every((token) =>
      normalizedCandidate.includes(this.normalizeText(token)),
    )
      ? score
      : 0;
  }

  private modelYearToken(value: string): number | null {
    const normalized = value.trim();
    if (!/^\d{4}$/u.test(normalized)) return null;
    const year = Number(normalized);
    return year >= 1886 && year <= 2200 ? year : null;
  }

  private searchTokens(value: string): string[] {
    return [
      ...new Set(
        value
          .trim()
          .split(/\s+/u)
          .map((token) => token.trim())
          .filter((token) => token.length >= 2),
      ),
    ].slice(0, 8);
  }

  private normalizeText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/gu, ' ');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private scoreSort<T extends { score: number }>(a: T, b: T): number {
    return b.score - a.score;
  }
}
