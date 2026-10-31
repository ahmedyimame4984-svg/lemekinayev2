import { Injectable } from '@nestjs/common';
import { MasterDataStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';

/**
 * Seller fitment is selected by an existing configured-vehicle ID.
 * Resolve its display identity in one query; never let Sellers compose new vehicle masters.
 */
@Injectable()
export class SellerVehicleConfigurationService {
  constructor(private readonly database: DatabaseService) {}

  async listByModel(modelId: string): Promise<Array<{ value: string; label: string }>> {
    const records = await this.database.vehicleConfiguration.findMany({
      where: {
        modelId,
        status: MasterDataStatus.ACTIVE,
        model: { status: MasterDataStatus.ACTIVE },
        make: { status: MasterDataStatus.ACTIVE },
      },
      select: {
        id: true,
        code: true,
        modelYear: true,
        productionStartYear: true,
        productionEndYear: true,
        productionEndStatus: true,
        steeringSide: true,
        make: { select: { name: true } },
        model: { select: { name: true } },
        generation: {
          select: { name: true, derivative: { select: { name: true } } },
        },
        trim: { select: { name: true } },
        engine: {
          select: { name: true, code: true, displacementCc: true, fuelType: true },
        },
        transmission: {
          select: { code: true, transmissionType: true, gearCount: true, driveType: true },
        },
        bodyType: { select: { name: true } },
        market: { select: { name: true } },
      },
      orderBy: [{ modelYear: 'asc' }, { productionStartYear: 'asc' }, { id: 'asc' }],
    });

    return records.map((item) => {
      const engineCode = item.engine?.code;
      const engineName = item.engine?.name;
      const engineLabel = item.engine
        ? [
            engineName,
            engineCode && !engineName?.toUpperCase().includes(engineCode.toUpperCase())
              ? engineCode : null,
            item.engine.displacementCc ? `${item.engine.displacementCc}cc` : null,
            item.engine.fuelType,
          ].filter(Boolean).join(' / ')
        : null;
      const transmissionLabel = item.transmission
        ? [
            item.transmission.code,
            item.transmission.transmissionType,
            item.transmission.gearCount ? `${item.transmission.gearCount}-speed` : null,
          ].filter(Boolean).join(' / ')
        : null;
      const productionPeriod = item.productionStartYear || item.productionEndYear
        ? `Built ${item.productionStartYear ?? '?'}–${
            item.productionEndYear ??
            (item.productionEndStatus === 'CURRENT' ? 'present' : '?')
          }`
        : null;

      return {
        value: item.id,
        label: [
          item.make.name,
          item.model.name,
          item.generation?.derivative?.name,
          item.generation?.name,
          item.trim?.name,
          engineLabel ? `Engine: ${engineLabel}` : null,
          transmissionLabel ? `Transmission: ${transmissionLabel}` : null,
          item.transmission?.driveType ? `Drive: ${item.transmission.driveType}` : null,
          item.bodyType?.name ? `Body: ${item.bodyType.name}` : null,
          item.steeringSide ? `Steering: ${item.steeringSide}` : null,
          item.market?.name ? `Market: ${item.market.name}` : null,
          item.modelYear ? `MY ${item.modelYear}` : null,
          productionPeriod,
          item.code ? `Code: ${item.code}` : null,
        ].filter(Boolean).join(' · '),
      };
    });
  }
}
