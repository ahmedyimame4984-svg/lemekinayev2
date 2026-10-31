import { describe, expect, it } from 'vitest';
import {
  createAllowedValueCode,
  createAttributeCode,
  isStaticValueAttribute,
  supportsManagedValues,
} from './attribute-master-management';

describe('Attribute master UI helpers', () => {
  it('creates canonical ATTR_ codes without duplicating the prefix', () => {
    expect(createAttributeCode('Fuel Type')).toBe('ATTR_FUEL_TYPE');
    expect(createAttributeCode('ATTR_VOLTAGE')).toBe('ATTR_VOLTAGE');
  });

  it('normalizes static allowed-value codes', () => {
    expect(createAllowedValueCode('Diesel fuel')).toBe('DIESEL_FUEL');
    expect(createAllowedValueCode('12-V')).toBe('12-V');
  });

  it('allows managed values only for STATIC attributes', () => {
    expect(supportsManagedValues('STATIC')).toBe(true);
    expect(supportsManagedValues('REFERENCE')).toBe(false);
    expect(isStaticValueAttribute({ valueSource: 'STATIC' })).toBe(true);
    expect(isStaticValueAttribute(null)).toBe(false);
  });
});
