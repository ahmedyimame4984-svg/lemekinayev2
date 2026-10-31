import { BadGatewayException } from '@nestjs/common';
import { NhtsaVinDecoderProvider } from './nhtsa-vin-decoder.provider.js';

describe('NhtsaVinDecoderProvider', () => {
  const provider = new NhtsaVinDecoderProvider();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps vPIC flat output into Lemekinaye normalized fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          Results: [
            {
              Make: 'TOYOTA',
              Model: 'Corolla',
              ModelYear: '2011',
              Series: 'E140',
              Trim: 'GLI',
              EngineModel: '2ZR-FE',
              TransmissionStyle: 'Continuously Variable Transmission (CVT)',
              BodyClass: 'Sedan/Saloon',
              ErrorCode: '0',
              ErrorText: '0 - VIN decoded clean.',
            },
          ],
        }),
      } as unknown as Response),
    );

    const result = await provider.decode('JTDBU4EE9B9123456', 2011);

    expect(result.provider).toBe('nhtsa-vpic');
    expect(result.decoded).toEqual({
      make: 'TOYOTA',
      model: 'Corolla',
      series: 'E140',
      trim: 'GLI',
      modelYear: 2011,
      engine: '2ZR-FE',
      transmission: 'CVT',
      bodyType: 'SEDAN',
    });
    expect(result.decoded.generation).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/DecodeVinValues/JTDBU4EE9B9123456?'),
      expect.objectContaining({
        headers: { accept: 'application/json' },
      }),
    );
  });

  it('does not fabricate fields absent from the provider response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          Results: [{ Make: 'TOYOTA', Model: 'Corolla', ErrorCode: '0' }],
        }),
      } as unknown as Response),
    );

    const result = await provider.decode('JTDBU4EE9B9123456');

    expect(result.decoded).toEqual({
      make: 'TOYOTA',
      model: 'Corolla',
      series: undefined,
      trim: undefined,
      modelYear: undefined,
      engine: undefined,
      transmission: undefined,
      bodyType: undefined,
    });
  });

  it('surfaces provider outages as a controlled gateway error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      } as Response),
    );

    await expect(provider.decode('JTDBU4EE9B9123456')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('keeps partial data with a safe warning instead of leaking provider error text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          Results: [
            {
              Make: 'TOYOTA',
              Model: 'Corolla',
              ModelYear: '2011',
              ErrorCode: '1,14',
              ErrorText: 'Error for JTDBU4EE9B9123456',
            },
          ],
        }),
      }),
    );

    const result = await provider.decode('JTDBU4EE9B9123456');
    expect(result.decoded.make).toBe('TOYOTA');
    expect(result.warnings).toEqual([
      expect.stringContaining('did not confirm a clean decode'),
    ]);
    expect(JSON.stringify(result.warnings)).not.toContain('JTDBU4EE9B9123456');
  });

  it('rejects a successful HTTP response with no usable vehicle evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          Results: [
            {
              Make: '',
              Model: '',
              ModelYear: '0',
              ErrorCode: '7',
            },
          ],
        }),
      }),
    );

    await expect(provider.decode('JTDBU4EE9B9123456')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('bounds requests and converts network failures to a controlled gateway error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );
    await expect(provider.decode('JTDBU4EE9B9123456')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
