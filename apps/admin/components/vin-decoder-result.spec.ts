import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VehicleIdentifierResolution } from '@/lib/vehicle-identification-contracts';
import { VinDecoderResult } from './vin-decoder-result';

const result: VehicleIdentifierResolution = {
  status: 'NO_MATCH',
  identifierType: 'VIN',
  normalizedIdentifier: 'JTDBU4EE9B9123456',
  provider: 'nhtsa-vpic',
  resolutionSource: 'VIN_PROVIDER',
  candidateCount: 0,
  matchedFields: ['make', 'model'],
  missingForExactMatch: ['modelYear', 'engine', 'transmission'],
  candidates: [],
  decoded: { make: 'Toyota', model: 'Corolla', series: 'LE' },
};

describe('VIN decoder evidence in Admin lookup', () => {
  it('shows decoded details when there are no canonical matches and labels absent specifications', () => {
    const html = renderToStaticMarkup(
      createElement(VinDecoderResult, { result }),
    );
    expect(html).toContain('VIN decoder result');
    expect(html).toContain('Toyota');
    expect(html).toContain('Corolla');
    expect(html).toContain('Provider series');
    expect(html).toContain('LE');
    expect(html).toContain('Not returned');
    expect(html).not.toContain('2ZR-FE');
  });

  it('shows decoder warnings without promoting incomplete evidence to a canonical identity', () => {
    const html = renderToStaticMarkup(
      createElement(VinDecoderResult, {
        result: { ...result, warnings: ['Verify the VIN.'] },
      }),
    );
    expect(html).toContain('Decoder verification needed');
    expect(html).toContain('Verify the VIN.');
    expect(html).toContain('does not confirm parts fitment');
  });

  it.each(['VERIFIED_MAPPING', 'NONE'] as const)(
    'does not show external decoder details for %s',
    (resolutionSource) => {
      expect(
        renderToStaticMarkup(
          createElement(VinDecoderResult, {
            result: { ...result, resolutionSource },
          }),
        ),
      ).toBe('');
    },
  );

  it('does not render a decoder panel when a request failed without decoded data', () => {
    expect(
      renderToStaticMarkup(
        createElement(VinDecoderResult, {
          result: { ...result, status: 'DECODE_FAILED', decoded: undefined },
        }),
      ),
    ).toBe('');
  });

  it('escapes external decoder text', () => {
    const html = renderToStaticMarkup(
      createElement(VinDecoderResult, {
        result: { ...result, decoded: { make: '<script>external</script>' } },
      }),
    );
    expect(html).toContain('&lt;script&gt;external&lt;/script&gt;');
    expect(html).not.toContain('<script>external</script>');
  });
});
