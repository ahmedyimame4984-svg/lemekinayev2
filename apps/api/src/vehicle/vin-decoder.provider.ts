import type { NormalizedVinVehicleDto } from './dto/vin.dto.js';

export type VinDecodeResult = {
  provider: string;
  decoded: NormalizedVinVehicleDto;
  warnings?: string[];
  raw?: unknown;
};

export interface VinDecoderProvider {
  readonly name: string;
  decode(vin: string, modelYear?: number): Promise<VinDecodeResult>;
}
