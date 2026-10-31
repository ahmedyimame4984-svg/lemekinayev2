import { describe, expect, it } from 'vitest';
import { familyProductionError } from './generation-family-contracts';

describe('Generation Family production-period editor validation', () => {
  it('accepts Draft unknown and Current production with no end year', () => {
    expect(familyProductionError(null, null, 'UNKNOWN')).toBeNull();
    expect(familyProductionError(2006, null, 'CURRENT')).toBeNull();
  });
  it('accepts documented ended years, including unknown start year while Draft', () => {
    expect(familyProductionError(2006, 2013, 'ENDED')).toBeNull();
    expect(familyProductionError(null, 2013, 'ENDED')).toBeNull();
  });
  it('rejects reversed years, missing end year, and invalid end status', () => {
    expect(familyProductionError(2013, 2006, 'ENDED')).toMatch(/after/);
    expect(familyProductionError(2006, null, 'ENDED')).toMatch(/needs an end year/);
    expect(familyProductionError(2006, 2013, 'CURRENT')).toMatch(/Only ENDED/);
    expect(familyProductionError(2006, 2013, 'UNKNOWN')).toMatch(/Only ENDED/);
  });
  it('rejects out-of-range and fractional years', () => {
    expect(familyProductionError(1885, null, 'UNKNOWN')).toMatch(/between/);
    expect(familyProductionError(2201, null, 'UNKNOWN')).toMatch(/between/);
    expect(familyProductionError(2006.5, null, 'UNKNOWN')).toMatch(/between/);
  });
});
