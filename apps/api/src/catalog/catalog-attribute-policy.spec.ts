import { describe, expect, it } from 'vitest';
import {
  NON_TECHNICAL_ATTRIBUTE_CODES,
  isNonTechnicalAttributeGroupCode,
  nonTechnicalAttributeGroupReason,
  nonTechnicalAttributeReason,
} from './catalog-attribute-policy.js';

describe('catalog attribute policy', () => {
  it('reserves article identity, fitment, media and commerce fields from generic attributes', () => {
    for (const code of NON_TECHNICAL_ATTRIBUTE_CODES) {
      expect(nonTechnicalAttributeReason(code), code).not.toBeNull();
    }
  });

  it('also blocks pricing and inventory-style attribute codes', () => {
    for (const code of [
      'ATTR_SELLING_PRICE',
      'ATTR_UNIT_COST',
      'ATTR_CURRENCY',
      'ATTR_STOCK_STATUS',
      'ATTR_INVENTORY_LEVEL',
      'ATTR_SELLER_SKU',
      'ATTR_OE_REFERENCE',
      'ATTR_ARTICLE_NUMBER',
      'ATTR_PART_NO',
    ]) {
      expect(nonTechnicalAttributeReason(code), code).not.toBeNull();
    }
  });

  it('blocks renamed commercial fields even when the code is generic', () => {
    expect(nonTechnicalAttributeReason('ATTR_AMOUNT', 'Selling Price')).not.toBeNull();
    expect(nonTechnicalAttributeReason('ATTR_REFERENCE', 'Manufacturer Part Number')).not.toBeNull();
    expect(nonTechnicalAttributeReason('ATTR_QTY', 'Available Quantity')).not.toBeNull();
  });

  it('allows genuine technical specification codes', () => {
    for (const code of [
      'ATTR_OUTER_DIAMETER',
      'ATTR_TERMINAL_COUNT',
      'ATTR_VOLTAGE',
      'ATTR_THREAD_PITCH',
      'ATTR_ITEM_WEIGHT',
    ]) {
      expect(nonTechnicalAttributeReason(code), code).toBeNull();
    }
  });

  it('reserves nontechnical attribute groups', () => {
    expect(isNonTechnicalAttributeGroupCode('IDENTITY')).toBe(true);
    expect(isNonTechnicalAttributeGroupCode('FITMENT')).toBe(true);
    expect(isNonTechnicalAttributeGroupCode('PRICING')).toBe(true);
    expect(isNonTechnicalAttributeGroupCode('INVENTORY')).toBe(true);
    expect(isNonTechnicalAttributeGroupCode('DIMENSIONS')).toBe(false);
    expect(nonTechnicalAttributeGroupReason('SELLER_DATA', 'Pricing & Inventory')).not.toBeNull();
  });
});
