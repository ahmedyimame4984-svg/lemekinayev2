import { describe, it, expect } from 'vitest';
import { ProductTypeRequirementLevel as Level } from '@prisma/client';
import {
  DEFAULT_COMMERCIAL_POLICY, discountPrice, validateSellerCommercialDetails,
} from './seller-listing-commercial.js';

describe('seller-only commercial and one-unit transport rules', () => {
  it('keeps legacy listings valid until a strict transition', () => {
    expect(validateSellerCommercialDetails(null, DEFAULT_COMMERCIAL_POLICY, false)).toEqual({});
  });
  it('requires complete dimensions and positive measurements', () => {
    expect(() => validateSellerCommercialDetails({ packageLengthCm: 10 }, DEFAULT_COMMERCIAL_POLICY, false)).toThrow();
    expect(() => validateSellerCommercialDetails({ packageWeightKg: -2 }, DEFAULT_COMMERCIAL_POLICY, false)).toThrow();
  });
  it('rejects duplicate or unknown transports and disallowed fields', () => {
    expect(() => validateSellerCommercialDetails({ transportMethods: ['SCOOTER','SCOOTER'] }, DEFAULT_COMMERCIAL_POLICY, false)).toThrow();
    expect(() => validateSellerCommercialDetails({ transportMethods: ['HELICOPTER'] }, DEFAULT_COMMERCIAL_POLICY, false)).toThrow();
    expect(() => validateSellerCommercialDetails({ transportMethods: ['BICYCLE'] },
      { ...DEFAULT_COMMERCIAL_POLICY, transport: Level.NOT_APPLICABLE }, false)).toThrow();
  });
  it('enforces required only when submitting a listing', () => {
    const policy = { ...DEFAULT_COMMERCIAL_POLICY, transport: Level.REQUIRED, packageWeight: Level.REQUIRED };
    expect(() => validateSellerCommercialDetails({}, policy, true)).toThrow();
    expect(validateSellerCommercialDetails({ transportMethods: ['CAR'], packageWeightKg: 2.5 }, policy, true))
      .toMatchObject({ transportMethods: ['CAR'] });
  });
  it('derives fixed and percentage promotions from the seller price', () => {
    expect(discountPrice(5000, { discountType: 'PERCENT', discountValue: 10 })).toBe(4500);
    expect(discountPrice(5000, { discountType: 'FIXED', discountValue: 500 })).toBe(4500);
    expect(() => validateSellerCommercialDetails({discountType:'FIXED',discountValue:5000}, DEFAULT_COMMERCIAL_POLICY,false,5000)).toThrow();
    expect(() => discountPrice(100, {discountType:'PERCENT',discountValue:99.99})).toThrow();
  });
  it('rejects unknown JSON fields rather than persisting arbitrary input', () => {
    expect(() => validateSellerCommercialDetails({ shouldNotSave: true }, DEFAULT_COMMERCIAL_POLICY, false)).toThrow();
  });
});
