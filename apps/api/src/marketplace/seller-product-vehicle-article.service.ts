import { Injectable } from '@nestjs/common';
import { CompatibilityFitmentType, MasterDataStatus, ProductStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerService } from './seller.service.js';

@Injectable()
export class SellerProductVehicleArticleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
  ) {}

  async list(userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const records = await this.database.productVehicleArticle.findMany({
      where: {
        vehicleConfiguration: { status: MasterDataStatus.ACTIVE },
        product: {
          OR: [
            { status: ProductStatus.ACTIVE },
            { status: ProductStatus.DRAFT, sourceSellerId: seller.id },
          ],
          compatibilities: {
            some: {
              vehicleConfigurationId: { not: null },
              fitmentType: CompatibilityFitmentType.EXACT,
              status: { not: MasterDataStatus.ARCHIVED },
            },
          },
        },
      },
      select: {
        id: true,
        productId: true,
        vehicleConfigurationId: true,
        product: {
          select: {
            name: true,
            status: true,
            brand: { select: { name: true } },
            productType: { select: { name: true } },
          },
        },
        vehicleConfiguration: {
          select: {
            identityCode: true,
            modelYear: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
            generation: { select: { name: true, derivative: { select: { name: true } } } },
            trim: { select: { name: true } },
            engine: { select: { name: true, code: true } },
            transmission: { select: { code: true, transmissionType: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    if (records.length === 0) return [];

    // Only expose applications with a current exact fitment for this specific pair.
    const valid = await this.database.vehicleCompatibility.findMany({
      where: {
        OR: records.map((record) => ({ productId: record.productId, vehicleConfigurationId: record.vehicleConfigurationId })),
        fitmentType: CompatibilityFitmentType.EXACT,
        status: { not: MasterDataStatus.ARCHIVED },
      },
      select: { productId: true, vehicleConfigurationId: true, verificationStatus: true, status: true },
    });
    const byPair = new Map<string, Set<string>>();
    for (const fitment of valid) {
      const key = `${fitment.productId}:${fitment.vehicleConfigurationId}`;
      const states = byPair.get(key) ?? new Set<string>();
      states.add(fitment.status === MasterDataStatus.ACTIVE &&
        (fitment.verificationStatus === 'VERIFIED' || fitment.verificationStatus === 'APPROVED')
        ? 'VERIFIED' : 'UNVERIFIED');
      byPair.set(key, states);
    }
    return records.flatMap((record) => {
      const states = byPair.get(`${record.productId}:${record.vehicleConfigurationId}`);
      if (!states || (record.product.status === ProductStatus.ACTIVE && !states.has('VERIFIED'))) return [];
      return [{
        id: record.id,
        productId: record.productId,
        vehicleConfigurationId: record.vehicleConfigurationId,
        productName: record.product.name,
        productStatus: record.product.status,
        brandName: record.product.brand?.name ?? null,
        productTypeName: record.product.productType.name,
        vehicleLabel: [
          record.vehicleConfiguration.make.name,
          record.vehicleConfiguration.model.name,
          record.vehicleConfiguration.generation?.derivative?.name,
          record.vehicleConfiguration.generation?.name,
          record.vehicleConfiguration.trim?.name,
          record.vehicleConfiguration.modelYear,
          record.vehicleConfiguration.engine?.name ?? record.vehicleConfiguration.engine?.code,
          record.vehicleConfiguration.transmission?.code ?? record.vehicleConfiguration.transmission?.transmissionType,
        ].filter(Boolean).join(' · '),
        vehicleCode: record.vehicleConfiguration.identityCode,
        verified: states.has('VERIFIED'),
      }];
    });
  }
}
