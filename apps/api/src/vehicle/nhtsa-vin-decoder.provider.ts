import { BadGatewayException, Injectable } from '@nestjs/common';
import type { NormalizedVinVehicleDto } from './dto/vin.dto.js';
import type {
  VinDecodeResult,
  VinDecoderProvider,
} from './vin-decoder.provider.js';

type NhtsaDecodeResult = {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Series?: string;
  Trim?: string;
  EngineModel?: string;
  TransmissionStyle?: string;
  BodyClass?: string;
  ErrorCode?: string;
  ErrorText?: string;
};

type NhtsaDecodeResponse = {
  Results?: NhtsaDecodeResult[];
};

const TRANSMISSION_ALIASES = new Map([
  ['Automatic', 'AUTOMATIC'],
  ['Manual', 'MANUAL'],
  ['Continuously Variable Transmission (CVT)', 'CVT'],
  ['Dual-Clutch Transmission (DCT)', 'DCT'],
]);

@Injectable()
export class NhtsaVinDecoderProvider implements VinDecoderProvider {
  readonly name = 'nhtsa-vpic';

  async decode(vin: string, modelYear?: number): Promise<VinDecodeResult> {
    const encodedVin = encodeURIComponent(vin);
    const query = new URLSearchParams({ format: 'json' });
    if (modelYear) query.set('modelyear', String(modelYear));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodedVin}?${query.toString()}`,
        {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new BadGatewayException({
          code: 'VIN_PROVIDER_UNAVAILABLE',
          message: 'The VIN decoder provider is currently unavailable',
        });
      }

      const body = (await response.json()) as NhtsaDecodeResponse;
      const result = body.Results?.[0];
      if (!result) {
        throw new BadGatewayException({
          code: 'VIN_PROVIDER_EMPTY_RESPONSE',
          message: 'The VIN decoder provider returned no vehicle data',
        });
      }

      const decoded: NormalizedVinVehicleDto = {
        make: this.clean(result.Make),
        model: this.clean(result.Model),
        // vPIC Series is descriptive evidence, not a verified generation code.
        series: this.clean(result.Series),
        trim: this.clean(result.Trim),
        modelYear: this.number(result.ModelYear),
        engine: this.clean(result.EngineModel),
        transmission: this.transmission(result.TransmissionStyle),
        bodyType: this.bodyType(result.BodyClass),
      };

      if (!Object.values(decoded).some((value) => value !== undefined)) {
        throw new BadGatewayException({
          code: 'VIN_PROVIDER_EMPTY_RESPONSE',
          message: 'The VIN decoder provider returned no usable vehicle data',
        });
      }

      const errorCodes = this.clean(result.ErrorCode)
        ?.split(',')
        .map((value) => value.trim());
      const warnings =
        errorCodes?.length && errorCodes.every((value) => value === '0')
          ? []
          : [
              'The decoder did not confirm a clean decode. Verify the VIN and model year before relying on these details.',
            ];

      return {
        provider: this.name,
        decoded,
        warnings,
        raw: {
          errorCode: this.clean(result.ErrorCode),
          errorText: this.clean(result.ErrorText),
        },
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException({
        code: 'VIN_PROVIDER_REQUEST_FAILED',
        message: 'The VIN decoder provider could not be reached',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private clean(value: string | undefined): string | undefined {
    const normalized = typeof value === 'string' ? value.trim() : undefined;
    return normalized ? normalized : undefined;
  }

  private transmission(value: string | undefined): string | undefined {
    const cleaned = this.clean(value);
    return cleaned ? (TRANSMISSION_ALIASES.get(cleaned) ?? cleaned) : undefined;
  }

  private bodyType(value: string | undefined): string | undefined {
    const cleaned = this.clean(value);
    return cleaned === 'Sedan/Saloon' ? 'SEDAN' : cleaned;
  }

  private number(value: string | undefined): number | undefined {
    const cleaned = this.clean(value);
    const parsed = cleaned ? Number(cleaned) : Number.NaN;
    return Number.isInteger(parsed) && parsed >= 1886 && parsed <= 2200
      ? parsed
      : undefined;
  }
}
