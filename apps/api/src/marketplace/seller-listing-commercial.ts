import { BadRequestException } from '@nestjs/common';
import { ProductTypeRequirementLevel } from '@prisma/client';

/** Seller commercial metadata is local to a Listing; not canonical Article data. */
export const TRANSPORT_METHODS = ['BICYCLE', 'SCOOTER', 'MOTORCYCLE', 'CAR', 'VAN_PICKUP'] as const;
export type TransportMethod = typeof TRANSPORT_METHODS[number];
export type Requirement = ProductTypeRequirementLevel;
export type CommercialPolicy = {
  packageDimensions: Requirement;
  packageWeight: Requirement;
  discount: Requirement;
  transport: Requirement;
  specialHandling: Requirement;
};

export type SellerCommercialDetails = {
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  packageWeightKg?: number;
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  transportMethods?: TransportMethod[];
  specialHandling?: string;
};

export const DEFAULT_COMMERCIAL_POLICY: CommercialPolicy = {
  packageDimensions: ProductTypeRequirementLevel.OPTIONAL,
  packageWeight: ProductTypeRequirementLevel.OPTIONAL,
  discount: ProductTypeRequirementLevel.OPTIONAL,
  transport: ProductTypeRequirementLevel.OPTIONAL,
  specialHandling: ProductTypeRequirementLevel.OPTIONAL,
};

export function commercialPolicyForProductType(type: {
  packageDimensionsRequirement: Requirement;
  packageWeightRequirement: Requirement;
  discountRequirement: Requirement;
  transportRequirement: Requirement;
  specialHandlingRequirement: Requirement;
}): CommercialPolicy {
  return {
    packageDimensions: type.packageDimensionsRequirement,
    packageWeight: type.packageWeightRequirement,
    discount: type.discountRequirement,
    transport: type.transportRequirement,
    specialHandling: type.specialHandlingRequirement,
  };
}

function badField(message: string): never {
  throw new BadRequestException({ code: 'LISTING_COMMERCIAL_DETAILS_INVALID', message });
}

function isPositiveMeasurement(x: unknown, max: number): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= max &&
    Math.abs(x * 100 - Math.round(x * 100)) <= 0.000001;
}

/**
 * Reject invalid and disallowed input before saving. Required fields are checked at
 * submission/approval, not draft creation. A Listing's transport choices describe
 * exactly ONE selling unit; there is intentionally no multi-quantity allocation.
 */
export function validateSellerCommercialDetails(
  value: unknown, policy: CommercialPolicy, required: boolean,
  sellingPrice?: number | null,
): SellerCommercialDetails {
  if (value !== null && value !== undefined &&
      (typeof value !== 'object' || Array.isArray(value))) {
    badField('Commercial details must be an object.');
  }
  const v = (value ?? {}) as Record<string, unknown>;
  const keys = [
    'packageLengthCm','packageWidthCm','packageHeightCm','packageWeightKg',
    'discountType','discountValue','transportMethods','specialHandling',
  ];
  if (Object.keys(v).some(key => !keys.includes(key))) {
    badField('Commercial details contain an unknown field.');
  }
  const result: SellerCommercialDetails = {};
  for (const key of ['packageLengthCm','packageWidthCm','packageHeightCm','packageWeightKg'] as const) {
    const x = v[key];
    if (x !== undefined && x !== null) {
      if (!isPositiveMeasurement(x, key === 'packageWeightKg' ? 100000 : 100000)) {
        badField('Package dimensions and gross weight must be positive numbers with at most two decimal places.');
      }
      result[key] = x;
    }
  }
  const dimensions = [result.packageLengthCm, result.packageWidthCm, result.packageHeightCm];
  const hasDims = dimensions.some(x => x !== undefined);
  if (hasDims && dimensions.some(x => x === undefined)) {
    badField('Package length, width, and height must be provided together.');
  }
  if (v.discountType != null || v.discountValue != null) {
    if (v.discountType !== 'PERCENT' && v.discountType !== 'FIXED') {
      badField('Discount type must be PERCENT or FIXED.');
    }
    if (!isPositiveMeasurement(v.discountValue, 100000000)) badField('Enter a positive discount amount.');
    const amount = v.discountValue as number;
    if (v.discountType === 'PERCENT' && amount >= 100) {
      badField('Percentage discount must be below 100%.');
    }
    if (v.discountType === 'FIXED' && sellingPrice != null && amount >= sellingPrice) {
      badField('Fixed discount must be less than the selling price.');
    }
    result.discountType = v.discountType as 'PERCENT' | 'FIXED';
    result.discountValue = amount;
  }
  if (v.transportMethods != null) {
    if (!Array.isArray(v.transportMethods) || v.transportMethods.length > TRANSPORT_METHODS.length ||
        v.transportMethods.some(item => typeof item !== 'string' ||
          !TRANSPORT_METHODS.includes(item as TransportMethod)) ||
        new Set(v.transportMethods).size !== v.transportMethods.length) {
      badField('Select only supported, unique transportation methods.');
    }
    result.transportMethods = v.transportMethods as TransportMethod[];
  }
  if (v.specialHandling != null) {
    if (typeof v.specialHandling !== 'string' || v.specialHandling.length > 500) {
      badField('Special handling notes must be at most 500 characters.');
    }
    if (v.specialHandling.trim()) result.specialHandling = v.specialHandling.trim();
  }
  const checks: [keyof CommercialPolicy, boolean, string][] = [
    ['packageDimensions', hasDims, 'package dimensions'],
    ['packageWeight', result.packageWeightKg !== undefined, 'package gross weight'],
    ['discount', result.discountType !== undefined, 'discount'],
    ['transport', Boolean(result.transportMethods?.length), 'one-unit transport methods'],
    ['specialHandling', Boolean(result.specialHandling), 'special handling notes'],
  ];
  for (const [key, present, label] of checks) {
    if (policy[key] === 'NOT_APPLICABLE' && present) badField(label + ' is not applicable to this Product Type.');
    if (required && policy[key] === 'REQUIRED' && !present) badField(label + ' is required for this Product Type.');
  }
  // Empty transport array is not a fulfillment guarantee.
  return result;
}

/** The seller's declared discount is converted server-side, never trusted as a submitted promotional price. */
export function discountPrice(sellingPrice: number, details: SellerCommercialDetails): number | null {
  if (!details.discountType || details.discountValue === undefined) return null;
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0 ||
      details.discountValue <= 0 || !Number.isFinite(details.discountValue) ||
      (details.discountType === 'PERCENT' && details.discountValue >= 100) ||
      (details.discountType === 'FIXED' && details.discountValue >= sellingPrice)) {
    badField('Discount must be positive and below the selling price.');
  }
  const priceCents = Math.round(sellingPrice * 100);
  const reductionCents = details.discountType === 'PERCENT'
    ? Math.round(priceCents * details.discountValue / 100)
    : Math.round(details.discountValue * 100);
  const result = (priceCents - reductionCents) / 100;
  if (!Number.isFinite(result) || result < 0.01) badField('Discount leaves no valid payable price.');
  return result;
}
