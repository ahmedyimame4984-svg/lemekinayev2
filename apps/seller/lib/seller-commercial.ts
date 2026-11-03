/** Seller-facing MVP form values; transport choices refer to ONE selling unit. */
export type RequirementLevel = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
export type SellerTransport = 'BICYCLE' | 'SCOOTER' | 'MOTORCYCLE' | 'CAR' | 'VAN_PICKUP';
export const SELLER_TRANSPORTS: ReadonlyArray<{ id: SellerTransport; label: string }> = [
  { id: 'BICYCLE', label: 'Bicycle' },
  { id: 'SCOOTER', label: 'Scooter / small motor' },
  { id: 'MOTORCYCLE', label: 'Motorcycle' },
  { id: 'CAR', label: 'Car' },
  { id: 'VAN_PICKUP', label: 'Van / pickup' },
];
export interface SellerCommercialDetails {
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  packageWeightKg?: number;
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  transportMethods?: SellerTransport[];
  specialHandling?: string;
}
export interface SellerCommercialPolicy {
  packageDimensions: RequirementLevel;
  packageWeight: RequirementLevel;
  discount: RequirementLevel;
  transport: RequirementLevel;
  specialHandling: RequirementLevel;
}
export const DEFAULT_SELLER_COMMERCIAL_POLICY: SellerCommercialPolicy = {
  packageDimensions: 'OPTIONAL', packageWeight: 'OPTIONAL', discount: 'OPTIONAL',
  transport: 'OPTIONAL', specialHandling: 'OPTIONAL',
};
export function validateSellerCommercial(
  value: SellerCommercialDetails, policy: SellerCommercialPolicy, sellingPrice: number,
): string | null {
  const dims = [value.packageLengthCm, value.packageWidthCm, value.packageHeightCm];
  if (dims.some(x => x !== undefined) && dims.some(x => x === undefined)) {
    return 'Enter package length, width and height together.';
  }
  for (const n of [...dims, value.packageWeightKg]) {
    if (n !== undefined && (!Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 0.000001)) {
      return 'Package measurements must be positive numbers with at most two decimal places.';
    }
  }
  if (value.discountType !== undefined || value.discountValue !== undefined) {
    if (!value.discountType || !value.discountValue || value.discountValue <= 0 ||
        !Number.isFinite(value.discountValue) ||
        (value.discountType === 'PERCENT' && value.discountValue >= 100) ||
        (value.discountType === 'FIXED' && value.discountValue >= sellingPrice)) {
      return 'Enter a valid discount below 100% or less than the selling price.';
    }
  }
  const checks: Array<[keyof SellerCommercialPolicy, boolean]> = [
    ['packageDimensions', dims.every(x => x !== undefined)],
    ['packageWeight', value.packageWeightKg !== undefined],
    ['discount', value.discountType !== undefined],
    ['transport', Boolean(value.transportMethods?.length)],
    ['specialHandling', Boolean(value.specialHandling?.trim())],
  ];
  for (const [key, present] of checks) {
    if (present && policy[key] === 'NOT_APPLICABLE') return key + ' is not applicable.';
    // Drafts are allowed incomplete; API validates required values on finish/submit.
  }
  return null;
}
