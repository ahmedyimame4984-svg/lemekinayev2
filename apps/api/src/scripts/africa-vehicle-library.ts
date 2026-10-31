/** LEGACY AUDIT INPUT ONLY. Never install this as Ethiopia LHD production data. */
export const LEGACY_VEHICLE_LIBRARY_POLICY = 'AUDIT_ONLY_DO_NOT_INSTALL' as const;

export type AfricaVehicleBodyType =
  | 'SEDAN'
  | 'SUV'
  | 'PICKUP'
  | 'MPV'
  | 'HATCHBACK'
  | 'COUPE'
  | 'VAN'
  | 'WAGON';

export type AfricaVehicleMarket =
  | 'ETHIOPIA'
  | 'EAST_AFRICA'
  | 'AFRICA'
  | 'SOUTHERN_AFRICA';

export type AfricaVehicleSteeringSide = 'LHD' | 'RHD';

export type AfricaVehicleEngineSpec = {
  key: string;
  code?: string;
  name: string;
  family?: string;
  displacementCc?: number;
  fuelType?: string;
  cylinderCount?: number;
  aspiration?: string;
  powerKw?: number;
  torqueNm?: number;
  startYear?: number;
  endYear?: number | null;
};

export type AfricaVehicleTransmissionSpec = {
  key: string;
  code?: string;
  transmissionType: string;
  gearCount?: number;
  driveType?: string;
  startYear?: number;
  endYear?: number | null;
};

export type AfricaVehicleConfigurationSpec = {
  code: string;
  modelYear?: number;
  productionStartYear?: number;
  productionStartMonth?: number;
  productionEndYear?: number | null;
  productionEndMonth?: number;
  productionEndStatus: 'ENDED' | 'CURRENT' | 'UNKNOWN';
  engine: AfricaVehicleEngineSpec;
  transmission: AfricaVehicleTransmissionSpec;
  market: AfricaVehicleMarket;
  steeringSide: AfricaVehicleSteeringSide;
  bodyType?: AfricaVehicleBodyType;
  source: string;
};

export type AfricaVehicleTrimSpec = {
  code: string;
  name: string;
  equipmentLevel?: string;
  startYear?: number;
  endYear?: number | null;
  configurations: readonly AfricaVehicleConfigurationSpec[];
};

export type AfricaVehicleDerivativeSpec = {
  code: string;
  name: string;
};

export type AfricaVehicleGenerationSpec = {
  code: string;
  name: string;
  startYear: number;
  endYear: number | null;
  derivative?: AfricaVehicleDerivativeSpec;
  trims: readonly AfricaVehicleTrimSpec[];
};

export function generationProductionEndStatus(
  generation: AfricaVehicleGenerationSpec,
): 'ENDED' | 'CURRENT' | 'UNKNOWN' {
  if (generation.endYear !== null) return 'ENDED';

  const hasCurrentConfiguration = generation.trims.some((trim) =>
    trim.configurations.some(
      (configuration) => configuration.productionEndStatus === 'CURRENT',
    ),
  );

  return hasCurrentConfiguration ? 'CURRENT' : 'UNKNOWN';
}

export type AfricaVehicleModelSpec = {
  code: string;
  name: string;
  bodyType: AfricaVehicleBodyType;
  generations: readonly AfricaVehicleGenerationSpec[];
};

export type AfricaVehicleMakeSpec = {
  code: string;
  name: string;
  models: readonly AfricaVehicleModelSpec[];
};

export const AFRICA_VEHICLE_DATA_SOURCES = {
  TOYOTA_ETHIOPIA_FLEET:
    'Ethiopia procurement/fleet specification: Toyota Hilux 2GD-FTV 2.4D 4x4 6MT; Land Cruiser 76/79 1HZ 4.2D 4WD 5MT; RAV4 hybrid A25A-FXS.',
  TOYOTA_SA_LC70_2026:
    'Toyota South Africa 2026 Land Cruiser 70 Series: 4.0 petrol, 4.2 diesel and 2.8 GD-6 diesel; 5MT/6AT; 76/78/79 body derivatives.',
  TOYOTA_SA_CURRENT:
    'Toyota South Africa current model/derivative specifications for Hilux, Fortuner, Prado, Corolla family and regional Toyota products.',
  NISSAN_ETHIOPIA:
    'Nissan Ethiopia current model pages and brochures: Almera, Sunny, Kicks, X-Trail, Patrol, Terra, Navara and NV350 Urvan.',
  NISSAN_SA_NAVARA:
    'Nissan South Africa Navara specifications: 2.5 DDTi 120/140 kW, 403/450 Nm, 6MT/7AT, 2WD/4WD, Single and Double Cab.',
  NISSAN_SA_NP200:
    'Nissan South Africa discontinued NP200 range: 1.6 petrol and historical 1.5 dCi variants for the South African light-commercial market.',
  MITSUBISHI_SA:
    'Mitsubishi Motors South Africa specifications for Triton, Pajero Sport, ASX, Outlander, Eclipse Cross and Xpander.',
  MITSUBISHI_ETHIOPIA:
    'Mitsubishi Motors global distributor network confirms official Ethiopia representation through Ethio-Nippon Technical Company.',
  ISUZU_AFRICA:
    'Isuzu regional Africa D-Max and mu-X specifications and LHD export variants.',
  SUZUKI_SA:
    'Suzuki Auto South Africa specifications for Swift, Ertiga and Jimny.',
  HYUNDAI_SA:
    'Hyundai South Africa specifications for Grand i10 and Creta.',
  FORD_SA:
    'Ford South Africa Ranger specifications.',
  KIA_SA_CURRENT:
    'Kia South Africa Picanto and Sportage specifications: Picanto 1.0/1.2 petrol with 5MT/4AT; Sportage 1.6 T-GDi and 1.6 CRDi with 7-speed DCT.',
  MERCEDES_SPRINTER_W906:
    'Mercedes-Benz Sprinter W906 316 CDI technical data: OM651 2.143L turbo diesel, 120 kW, 360 Nm, rear-wheel drive.',
  CHEVROLET_SA_SPARK:
    'General Motors South Africa Chevrolet Spark M300 1.2L petrol: 60 kW, 108 Nm, 5-speed manual.',
  CHEVROLET_SA_TRAILBLAZER:
    'Chevrolet Trailblazer South Africa 2.8 Duramax turbo diesel: 144 kW, 500 Nm with 6-speed automatic 4x4.',
  CURATED_HISTORICAL:
    'Curated historical OEM model/chassis/powertrain specification used for common African-market legacy vehicles; no placeholder powertrains.',
} as const;

const e = (
  key: string,
  code: string | undefined,
  name: string,
  displacementCc: number | undefined,
  fuelType: string,
  cylinderCount: number | undefined,
  aspiration: string | undefined,
  powerKw?: number,
  torqueNm?: number,
  startYear?: number,
  endYear?: number | null,
): AfricaVehicleEngineSpec => ({
  key,
  code,
  name,
  displacementCc,
  fuelType,
  cylinderCount,
  aspiration,
  powerKw,
  torqueNm,
  startYear,
  endYear,
});

const tx = (
  key: string,
  transmissionType: string,
  gearCount: number | undefined,
  driveType: string,
  code?: string,
  startYear?: number,
  endYear?: number | null,
): AfricaVehicleTransmissionSpec => ({
  key,
  code,
  transmissionType,
  gearCount,
  driveType,
  startYear,
  endYear,
});

const EXPLICITLY_CURRENT_CONFIGURATION_SOURCES = new Set<string>([
  'TOYOTA_SA_CURRENT',
  'TOYOTA_SA_LC70_2026',
  'NISSAN_ETHIOPIA',
  'NISSAN_SA_NAVARA',
  'MITSUBISHI_SA',
  'ISUZU_AFRICA',
  'SUZUKI_SA',
  'HYUNDAI_SA',
  'FORD_SA',
  'KIA_SA_CURRENT',
]);

const c = (
  code: string,
  engine: AfricaVehicleEngineSpec,
  transmission: AfricaVehicleTransmissionSpec,
  productionStartYear: number,
  productionEndYear: number | null,
  source: string,
  market: AfricaVehicleMarket = 'AFRICA',
  steeringSide: AfricaVehicleSteeringSide = 'LHD',
  bodyType?: AfricaVehicleBodyType,
): AfricaVehicleConfigurationSpec => ({
  code,
  engine,
  transmission,
  productionStartYear,
  productionEndYear,
  productionEndStatus:
    productionEndYear !== null
      ? 'ENDED'
      : EXPLICITLY_CURRENT_CONFIGURATION_SOURCES.has(source)
        ? 'CURRENT'
        : 'UNKNOWN',
  source,
  market,
  steeringSide,
  bodyType,
});

const t = (
  code: string,
  name: string,
  startYear: number,
  endYear: number | null,
  configurations: readonly AfricaVehicleConfigurationSpec[],
): AfricaVehicleTrimSpec => ({
  code,
  name,
  equipmentLevel: name,
  startYear,
  endYear,
  configurations,
});

const g = (
  code: string,
  name: string,
  startYear: number,
  endYear: number | null,
  trims: readonly AfricaVehicleTrimSpec[],
  derivative?: AfricaVehicleDerivativeSpec,
): AfricaVehicleGenerationSpec => ({
  code,
  name,
  startYear,
  endYear,
  trims,
  derivative,
});

const d = (code: string, name: string): AfricaVehicleDerivativeSpec => ({
  code,
  name,
});

const m = (
  code: string,
  name: string,
  bodyType: AfricaVehicleBodyType,
  generations: readonly AfricaVehicleGenerationSpec[],
): AfricaVehicleModelSpec => ({ code, name, bodyType, generations });

const make = (
  code: string,
  name: string,
  models: readonly AfricaVehicleModelSpec[],
): AfricaVehicleMakeSpec => ({ code, name, models });

// Real technical masters reused across multiple model/trim configurations.
const ENGINES = {
  TOYOTA_1ZR_FE: e('TOYOTA_1ZR_FE', '1ZR-FE', '1ZR-FE 1.6L petrol', 1598, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2006, null),
  TOYOTA_2ZR_FE: e('TOYOTA_2ZR_FE', '2ZR-FE', '2ZR-FE 1.8L petrol', 1798, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2006, null),
  TOYOTA_2ZR_FXE: e('TOYOTA_2ZR_FXE', '2ZR-FXE', '2ZR-FXE 1.8L hybrid petrol', 1798, 'HYBRID_PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2010, null),
  TOYOTA_M20A_FKS: e('TOYOTA_M20A_FKS', 'M20A-FKS', 'M20A-FKS 2.0L petrol', 1987, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2018, null),
  TOYOTA_2KD_FTV: e('TOYOTA_2KD_FTV', '2KD-FTV', '2KD-FTV 2.5L D-4D turbo diesel', 2494, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2001, null),
  TOYOTA_1KD_FTV: e('TOYOTA_1KD_FTV', '1KD-FTV', '1KD-FTV 3.0L D-4D turbo diesel', 2982, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2000, null),
  TOYOTA_2GD_FTV: e('TOYOTA_2GD_FTV', '2GD-FTV', '2GD-FTV 2.4L GD turbo diesel', 2393, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2015, null),
  TOYOTA_1GD_FTV: e('TOYOTA_1GD_FTV', '1GD-FTV', '1GD-FTV 2.8L GD turbo diesel', 2755, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2015, null),
  TOYOTA_1GD_FTV_150_450: e('TOYOTA_1GD_FTV_150_450', '1GD-FTV', '1GD-FTV 2.8L GD turbo diesel · 150 kW / 450 Nm', 2755, 'DIESEL', 4, 'TURBOCHARGED', 150, 450, 2024, null),
  TOYOTA_1GD_FTV_150_500: e('TOYOTA_1GD_FTV_150_500', '1GD-FTV', '1GD-FTV 2.8L GD turbo diesel · 150 kW / 500 Nm', 2755, 'DIESEL', 4, 'TURBOCHARGED', 150, 500, 2024, null),
  TOYOTA_1GD_FTV_165_550: e('TOYOTA_1GD_FTV_165_550', '1GD-FTV', '1GD-FTV 2.8L GD turbo diesel · 165 kW / 550 Nm', 2755, 'DIESEL', 4, 'TURBOCHARGED', 165, 550, 2022, null),
  TOYOTA_1HZ: e('TOYOTA_1HZ', '1HZ', '1HZ 4.2L naturally aspirated diesel', 4164, 'DIESEL', 6, 'NATURALLY_ASPIRATED', undefined, undefined, 1990, null),
  TOYOTA_1GR_FE: e('TOYOTA_1GR_FE', '1GR-FE', '1GR-FE 4.0L V6 petrol', 3956, 'PETROL', 6, 'NATURALLY_ASPIRATED', undefined, undefined, 2002, null),
  TOYOTA_1VD_FTV: e('TOYOTA_1VD_FTV', '1VD-FTV', '1VD-FTV 4.5L V8 twin-turbo diesel', 4461, 'DIESEL', 8, 'TWIN_TURBO', undefined, undefined, 2007, 2021),
  TOYOTA_F33A_FTV: e('TOYOTA_F33A_FTV', 'F33A-FTV', 'F33A-FTV 3.3L V6 twin-turbo diesel', 3346, 'DIESEL', 6, 'TWIN_TURBO', undefined, undefined, 2021, null),
  TOYOTA_2AZ_FE: e('TOYOTA_2AZ_FE', '2AZ-FE', '2AZ-FE 2.4L petrol', 2362, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2000, 2012),
  TOYOTA_2AR_FE: e('TOYOTA_2AR_FE', '2AR-FE', '2AR-FE 2.5L petrol', 2494, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2008, 2018),
  TOYOTA_A25A_FKS: e('TOYOTA_A25A_FKS', 'A25A-FKS', 'A25A-FKS 2.5L petrol', 2487, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2017, null),
  TOYOTA_A25A_FXS: e('TOYOTA_A25A_FXS', 'A25A-FXS', 'A25A-FXS 2.5L hybrid petrol', 2487, 'HYBRID_PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2017, null),
  TOYOTA_2NR_FE: e('TOYOTA_2NR_FE', '2NR-FE', '2NR-FE 1.5L petrol', 1496, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2013, null),
  TOYOTA_2NR_VE: e('TOYOTA_2NR_VE', '2NR-VE', '2NR-VE 1.5L petrol', 1496, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2015, null),

  NISSAN_HR15DE: e('NISSAN_HR15DE', 'HR15DE', 'HR15DE 1.5L petrol', 1498, 'PETROL', 4, 'NATURALLY_ASPIRATED', 73, 134, 2004, null),
  NISSAN_HR16DE: e('NISSAN_HR16DE', 'HR16DE', 'HR16DE 1.6L petrol', 1598, 'PETROL', 4, 'NATURALLY_ASPIRATED', 88, 149, 2005, null),
  NISSAN_QR25DE: e('NISSAN_QR25DE', 'QR25DE', 'QR25DE 2.5L petrol', 2488, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2001, null),
  NISSAN_YD25_120: e('NISSAN_YD25_120', 'YD25DDTi', 'YD25DDTi 2.5L turbo diesel · 120 kW', 2488, 'DIESEL', 4, 'TURBOCHARGED_INTERCOOLED', 120, 403, 2014, null),
  NISSAN_YD25_140: e('NISSAN_YD25_140', 'YD25DDTi', 'YD25DDTi 2.5L turbo diesel · 140 kW', 2488, 'DIESEL', 4, 'TURBOCHARGED_INTERCOOLED', 140, 450, 2014, null),
  NISSAN_YD25_95: e('NISSAN_YD25_95', 'YD25DDTi', 'YD25 2.5L turbo diesel · 95 kW', 2488, 'DIESEL', 4, 'TURBOCHARGED', 95, 356, 2012, null),
  NISSAN_QR25_URVAN: e('NISSAN_QR25_URVAN', 'QR25DE', 'QR25 2.5L petrol · 108 kW', 2488, 'PETROL', 4, 'NATURALLY_ASPIRATED', 108, 214, 2012, null),
  NISSAN_R9M: e('NISSAN_R9M', 'R9M', 'R9M 1.6 dCi turbo diesel', 1598, 'DIESEL', 4, 'TURBOCHARGED', undefined, 320, 2013, 2022),
  NISSAN_VK56VD: e('NISSAN_VK56VD', 'VK56VD', 'VK56VD 5.6L V8 petrol', 5552, 'PETROL', 8, 'NATURALLY_ASPIRATED', undefined, undefined, 2010, null),
  NISSAN_K9K: e('NISSAN_K9K', 'K9K', 'K9K 1.5 dCi turbo diesel', 1461, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2008, 2024),
  NISSAN_K7M: e('NISSAN_K7M', 'K7M', 'K7M 1.6L petrol', 1598, 'PETROL', 4, 'NATURALLY_ASPIRATED', undefined, undefined, 2008, 2024),

  MITSUBISHI_4D56: e('MITSUBISHI_4D56', '4D56', '4D56 2.5L DI-D turbo diesel', 2477, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2005, 2015),
  MITSUBISHI_4N15_133: e('MITSUBISHI_4N15_133', '4N15', '4N15 2.4L MIVEC turbo diesel · 133 kW', 2442, 'DIESEL', 4, 'TURBOCHARGED_INTERCOOLED', 133, 430, 2015, null),
  MITSUBISHI_4B11: e('MITSUBISHI_4B11', '4B11', '4B11 2.0L MIVEC petrol', 1998, 'PETROL', 4, 'NATURALLY_ASPIRATED', 110, 197, 2010, null),
  MITSUBISHI_4B40: e('MITSUBISHI_4B40', '4B40', '4B40 1.5L MIVEC turbo petrol', 1499, 'PETROL', 4, 'TURBOCHARGED', 110, 250, 2017, null),
  MITSUBISHI_4A91: e('MITSUBISHI_4A91', '4A91', '4A91 1.5L MIVEC petrol', 1499, 'PETROL', 4, 'NATURALLY_ASPIRATED', 77, 141, 2017, null),
  MITSUBISHI_PR25: e('MITSUBISHI_PR25', 'PR25DD', '2.5L direct-injection petrol', 2488, 'PETROL', 4, 'NATURALLY_ASPIRATED', 135, 245, 2021, null),
  MITSUBISHI_4M41: e('MITSUBISHI_4M41', '4M41', '4M41 3.2L DI-D turbo diesel', 3200, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2006, 2021),
  MITSUBISHI_6G75: e('MITSUBISHI_6G75', '6G75', '6G75 3.8L V6 petrol', 3828, 'PETROL', 6, 'NATURALLY_ASPIRATED', undefined, undefined, 2006, 2021),

  ISUZU_4JK1: e('ISUZU_4JK1', '4JK1-TCX', '4JK1-TCX 2.5L turbo diesel', 2499, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2012, 2021),
  ISUZU_4JJ3: e('ISUZU_4JJ3', '4JJ3-TCX', '4JJ3-TCX 3.0L turbo diesel', 2999, 'DIESEL', 4, 'TURBOCHARGED', undefined, undefined, 2021, null),

  SUZUKI_Z12E: e('SUZUKI_Z12E', 'Z12E', 'Z12E 1.2L petrol', 1197, 'PETROL', 3, 'NATURALLY_ASPIRATED', 60, 112, 2024, null),
  SUZUKI_K15B: e('SUZUKI_K15B', 'K15B', 'K15B 1.5L petrol', 1462, 'PETROL', 4, 'NATURALLY_ASPIRATED', 75, 130, 2018, null),
  SUZUKI_K15B_ERTIGA: e('SUZUKI_K15B_ERTIGA', 'K15B', 'K15B 1.5L petrol', 1462, 'PETROL', 4, 'NATURALLY_ASPIRATED', 77, 138, 2018, null),

  HYUNDAI_GI10_10: e('HYUNDAI_GI10_10', undefined, '1.0L MPi petrol', 998, 'PETROL', 3, 'NATURALLY_ASPIRATED', 48.5, 94, 2020, null),
  HYUNDAI_GI10_12: e('HYUNDAI_GI10_12', undefined, '1.2L MPi petrol', 1197, 'PETROL', 4, 'NATURALLY_ASPIRATED', 61, 114, 2020, null),
  HYUNDAI_CRETA_15: e('HYUNDAI_CRETA_15', undefined, '1.5L MPi petrol', 1497, 'PETROL', 4, 'NATURALLY_ASPIRATED', 84, 144, 2020, null),

  FORD_RANGER_20ST: e('FORD_RANGER_20ST', undefined, '2.0L Single-Turbo diesel', 1996, 'DIESEL', 4, 'TURBOCHARGED', 125, 405, 2022, null),
  FORD_RANGER_20BI: e('FORD_RANGER_20BI', undefined, '2.0L Bi-Turbo diesel', 1996, 'DIESEL', 4, 'TWIN_TURBO', 154, 500, 2022, null),

  KIA_PICANTO_10_MPI: e('KIA_PICANTO_10_MPI', undefined, '1.0L MPI petrol', 998, 'PETROL', 3, 'NATURALLY_ASPIRATED', 49, 95, 2024, null),
  KIA_PICANTO_12_MPI: e('KIA_PICANTO_12_MPI', undefined, '1.25L MPI petrol', 1248, 'PETROL', 4, 'NATURALLY_ASPIRATED', 62, 122, 2024, null),
  KIA_SPORTAGE_16_TGDI: e('KIA_SPORTAGE_16_TGDI', undefined, '1.6L T-GDi turbo petrol', 1598, 'PETROL', 4, 'TURBOCHARGED', 132, 265, 2022, null),
  KIA_SPORTAGE_16_CRDI: e('KIA_SPORTAGE_16_CRDI', undefined, '1.6L CRDi turbo diesel', 1582, 'DIESEL', 4, 'TURBOCHARGED', 100, 320, 2024, null),

  MERCEDES_OM651_316: e('MERCEDES_OM651_316', 'OM651', 'OM651 2.143L CDI turbo diesel · 120 kW / 360 Nm', 2143, 'DIESEL', 4, 'TURBOCHARGED', 120, 360, 2009, 2018),

  CHEVROLET_SPARK_12: e('CHEVROLET_SPARK_12', 'B12D1', '1.2L 16V petrol · 60 kW / 108 Nm', 1206, 'PETROL', 4, 'NATURALLY_ASPIRATED', 60, 108, 2010, 2015),
  CHEVROLET_TRAILBLAZER_28D: e('CHEVROLET_TRAILBLAZER_28D', undefined, '2.8L Duramax turbo diesel · 144 kW / 500 Nm', 2776, 'DIESEL', 4, 'TURBOCHARGED', 144, 500, 2014, 2017),
} as const;

const TRANSMISSIONS = {
  MT4X2_5: tx('MT4X2_5', 'MANUAL', 5, '2WD'),
  MT4X4_5: tx('MT4X4_5', 'MANUAL', 5, '4WD'),
  MT4X2_6: tx('MT4X2_6', 'MANUAL', 6, '2WD'),
  MT4X4_6: tx('MT4X4_6', 'MANUAL', 6, '4WD'),
  AT4X2_4: tx('AT4X2_4', 'AUTOMATIC', 4, '2WD'),
  AT4X4_4: tx('AT4X4_4', 'AUTOMATIC', 4, '4WD'),
  AT4X2_5: tx('AT4X2_5', 'AUTOMATIC', 5, '2WD'),
  AT4X4_5: tx('AT4X4_5', 'AUTOMATIC', 5, '4WD'),
  AT4X2_6: tx('AT4X2_6', 'AUTOMATIC', 6, '2WD'),
  AT4X4_6: tx('AT4X4_6', 'AUTOMATIC', 6, '4WD'),
  AT4X2_7: tx('AT4X2_7', 'AUTOMATIC', 7, '2WD'),
  AT4X4_7: tx('AT4X4_7', 'AUTOMATIC', 7, '4WD'),
  AT4X4_8: tx('AT4X4_8', 'AUTOMATIC', 8, '4WD'),
  AT4X2_8: tx('AT4X2_8', 'AUTOMATIC', 8, '2WD'),
  AT4X4_10: tx('AT4X4_10', 'AUTOMATIC', 10, '4WD'),
  CVT_FWD: tx('CVT_FWD', 'CVT', undefined, 'FWD'),
  CVT_4WD: tx('CVT_4WD', 'CVT', undefined, '4WD'),
  IVT_FWD: tx('IVT_FWD', 'IVT', undefined, 'FWD'),
  ECVT_FWD: tx('ECVT_FWD', 'E-CVT', undefined, 'FWD'),
  ECVT_AWD: tx('ECVT_AWD', 'E-CVT', undefined, 'AWD'),
  DCT_FWD_7: tx('DCT_FWD_7', 'DCT', 7, 'FWD'),
  MT_RWD_6: tx('MT_RWD_6', 'MANUAL', 6, 'RWD'),
} as const;

const D = TRANSMISSIONS;
const E = ENGINES;

const toyota = make('TOYOTA', 'Toyota', [
  m('COROLLA', 'Corolla', 'SEDAN', [
    g('E140_E150', 'E140 / E150', 2006, 2013, [
      t('XLI', 'XLi', 2007, 2013, [
        c('TOY_COR_E140_XLI_16_5MT', E.TOYOTA_1ZR_FE, D.MT4X2_5, 2007, 2013, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('GLI', 'GLi', 2007, 2013, [
        c('TOY_COR_E140_GLI_18_4AT', E.TOYOTA_2ZR_FE, D.AT4X2_4, 2007, 2013, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('SEDAN', 'Sedan')),
    g('E170_E180', 'E170 / E180', 2013, 2019, [
      t('XLI', 'XLi', 2013, 2019, [
        c('TOY_COR_E170_XLI_16_CVT', E.TOYOTA_1ZR_FE, D.CVT_FWD, 2013, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('GLI', 'GLi', 2013, 2019, [
        c('TOY_COR_E170_GLI_18_CVT', E.TOYOTA_2ZR_FE, D.CVT_FWD, 2013, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('SEDAN', 'Sedan')),
    g('E210_SEDAN', 'E210', 2019, null, [
      t('XS', 'XS', 2019, 2024, [
        c('TOY_COR_E210_XS_20_CVT', E.TOYOTA_M20A_FKS, D.CVT_FWD, 2019, 2024, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('XR_HYBRID', 'XR Hybrid', 2023, null, [
        c('TOY_COR_E210_XR_18_HEV', E.TOYOTA_2ZR_FXE, D.ECVT_FWD, 2023, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('SEDAN', 'Sedan')),
    g('E210_HATCH', 'E210', 2019, null, [
      t('XS', 'XS', 2019, 2024, [
        c('TOY_COR_E210_HATCH_XS_20_CVT', E.TOYOTA_M20A_FKS, D.CVT_FWD, 2019, 2024, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD', 'HATCHBACK'),
      ]),
      t('XR_HYBRID', 'XR Hybrid', 2025, null, [
        c('TOY_COR_E210_HATCH_XR_HEV', E.TOYOTA_2ZR_FXE, D.ECVT_FWD, 2025, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD', 'HATCHBACK'),
      ]),
    ], d('HATCHBACK', 'Hatchback')),
  ]),
  m('HILUX', 'Hilux', 'PICKUP', [
    g('AN10_20_30_SC', 'AN10 / AN20 / AN30', 2005, 2015, [
      t('WORKMATE_25D', '2.5 D-4D', 2005, 2015, [
        c('TOY_HILUX_OLD_SC_25D_5MT', E.TOYOTA_2KD_FTV, D.MT4X2_5, 2005, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('SINGLE_CAB', 'Single Cab')),
    g('AN10_20_30_DC', 'AN10 / AN20 / AN30', 2005, 2015, [
      t('D4D_30', '3.0 D-4D', 2005, 2015, [
        c('TOY_HILUX_OLD_DC_30D_4X4_5MT', E.TOYOTA_1KD_FTV, D.MT4X4_5, 2005, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
    g('AN120_130_SC', 'AN120 / AN130', 2015, null, [
      t('GD6_24', '2.4 GD-6', 2016, null, [
        c('TOY_HILUX_SC_24D_4X4_6MT', E.TOYOTA_2GD_FTV, D.MT4X4_6, 2016, null, 'TOYOTA_ETHIOPIA_FLEET', 'ETHIOPIA'),
      ]),
    ], d('SINGLE_CAB', 'Single Cab')),
    g('AN120_130_XC', 'AN120 / AN130', 2015, null, [
      t('RAIDER_24', '2.4 GD-6 Raider', 2016, null, [
        c('TOY_HILUX_XC_24D_6MT', E.TOYOTA_2GD_FTV, D.MT4X2_6, 2016, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('XTRA_CAB', 'Xtra Cab')),
    g('AN120_130_DC', 'AN120 / AN130', 2015, null, [
      t('RAIDER_24', '2.4 GD-6 Raider', 2016, null, [
        c('TOY_HILUX_DC_24D_4X4_6MT', E.TOYOTA_2GD_FTV, D.MT4X4_6, 2016, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('GRS_28', '2.8 GD-6 GR-S', 2022, null, [
        c('TOY_HILUX_DC_GRS_28D_6AT', E.TOYOTA_1GD_FTV_165_550, D.AT4X4_6, 2022, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
  ]),
  m('LAND_CRUISER_70', 'Land Cruiser 70', 'SUV', [
    g('J70_76', 'J70', 2007, null, [
      t('76_42D', '76 4.2 Diesel', 2007, null, [
        c('TOY_LC76_1HZ_5MT', E.TOYOTA_1HZ, D.MT4X4_5, 2007, null, 'TOYOTA_ETHIOPIA_FLEET', 'ETHIOPIA'),
      ]),
      t('76_28GD', '76 2.8 GD-6', 2024, null, [
        c('TOY_LC76_28GD_5MT', E.TOYOTA_1GD_FTV_150_450, D.MT4X4_5, 2026, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD'),
        c('TOY_LC76_28GD_6AT', E.TOYOTA_1GD_FTV_150_500, D.AT4X4_6, 2024, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('LC76_WAGON', '76 Station Wagon')),
    g('J70_78', 'J70', 2007, null, [
      t('78_42D', '78 4.2 Diesel', 2007, null, [
        c('TOY_LC78_1HZ_5MT', E.TOYOTA_1HZ, D.MT4X4_5, 2007, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('LC78_TROOP', '78 Troop Carrier')),
    g('J70_79_SC', 'J70', 2007, null, [
      t('79_42D', '79 4.2 Diesel', 2007, null, [
        c('TOY_LC79_SC_1HZ_5MT', E.TOYOTA_1HZ, D.MT4X4_5, 2007, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD', 'PICKUP'),
      ]),
      t('79_40P', '79 4.0 Petrol', 2007, null, [
        c('TOY_LC79_SC_1GR_5MT', E.TOYOTA_1GR_FE, D.MT4X4_5, 2007, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD', 'PICKUP'),
      ]),
    ], d('LC79_SINGLE_CAB', '79 Single Cab')),
    g('J70_79_DC', 'J70', 2007, null, [
      t('79_42D', '79 4.2 Diesel', 2007, null, [
        c('TOY_LC79_DC_1HZ_5MT', E.TOYOTA_1HZ, D.MT4X4_5, 2007, null, 'TOYOTA_ETHIOPIA_FLEET', 'ETHIOPIA', 'LHD', 'PICKUP'),
      ]),
      t('79_28GD', '79 2.8 GD-6', 2024, null, [
        c('TOY_LC79_DC_28GD_5MT', E.TOYOTA_1GD_FTV_150_450, D.MT4X4_5, 2026, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD', 'PICKUP'),
        c('TOY_LC79_DC_28GD_6AT', E.TOYOTA_1GD_FTV_150_500, D.AT4X4_6, 2024, null, 'TOYOTA_SA_LC70_2026', 'SOUTHERN_AFRICA', 'RHD', 'PICKUP'),
      ]),
    ], d('LC79_DOUBLE_CAB', '79 Double Cab')),
  ]),
  m('LAND_CRUISER_PRADO', 'Land Cruiser Prado', 'SUV', [
    g('J120', 'J120', 2002, 2009, [
      t('TX_30D', 'TX 3.0 D-4D', 2003, 2009, [
        c('TOY_PRADO_J120_1KD_5AT', E.TOYOTA_1KD_FTV, D.AT4X4_5, 2003, 2009, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('VX_40', 'VX 4.0 V6', 2003, 2009, [
        c('TOY_PRADO_J120_1GR_5AT', E.TOYOTA_1GR_FE, D.AT4X4_5, 2003, 2009, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('J150', 'J150', 2009, 2023, [
      t('TX_30D', 'TX 3.0 D-4D', 2009, 2015, [
        c('TOY_PRADO_J150_1KD_5AT', E.TOYOTA_1KD_FTV, D.AT4X4_5, 2009, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('VX_28GD', 'VX 2.8 GD-6', 2015, 2023, [
        c('TOY_PRADO_J150_1GD_6AT', E.TOYOTA_1GD_FTV, D.AT4X4_6, 2015, 2023, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('J250', 'J250', 2024, null, [
      t('VX_L', 'VX-L 2.8 GD-6', 2024, null, [
        c('TOY_PRADO_J250_1GD_8AT', E.TOYOTA_1GD_FTV_150_500, D.AT4X4_8, 2024, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('RAV4', 'RAV4', 'SUV', [
    g('XA30', 'XA30', 2005, 2012, [
      t('24_4X4', '2.4 4x4', 2006, 2012, [
        c('TOY_RAV4_XA30_24_4AT', E.TOYOTA_2AZ_FE, D.AT4X4_4, 2009, 2012, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('XA40', 'XA40', 2013, 2018, [
      t('25_AWD', '2.5 AWD', 2013, 2018, [
        c('TOY_RAV4_XA40_25_6AT', E.TOYOTA_2AR_FE, D.AT4X4_6, 2013, 2018, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('XA50', 'XA50', 2019, null, [
      t('25_HYBRID_AWD', '2.5 Hybrid AWD', 2019, null, [
        c('TOY_RAV4_XA50_HEV_AWD', E.TOYOTA_A25A_FXS, D.ECVT_AWD, 2019, null, 'TOYOTA_ETHIOPIA_FLEET', 'ETHIOPIA'),
      ]),
      t('25_PETROL_AWD', '2.5 Petrol AWD', 2019, null, [
        c('TOY_RAV4_XA50_25_8AT', E.TOYOTA_A25A_FKS, D.AT4X4_8, 2019, null, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('FORTUNER', 'Fortuner', 'SUV', [
    g('AN50_AN60', 'AN50 / AN60', 2005, 2015, [
      t('25_D4D', '2.5 D-4D', 2005, 2015, [
        c('TOY_FORTUNER_25D_5MT', E.TOYOTA_2KD_FTV, D.MT4X2_5, 2005, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('30_D4D_4X4', '3.0 D-4D 4x4', 2005, 2015, [
        c('TOY_FORTUNER_30D_4X4_5AT', E.TOYOTA_1KD_FTV, D.AT4X4_5, 2005, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('AN160', 'AN160', 2015, null, [
      t('24_GD6', '2.4 GD-6', 2016, null, [
        c('TOY_FORTUNER_24D_6AT', E.TOYOTA_2GD_FTV, D.AT4X2_6, 2016, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('28_GD6_4X4', '2.8 GD-6 4x4', 2016, null, [
        c('TOY_FORTUNER_28D_4X4_6AT', E.TOYOTA_1GD_FTV, D.AT4X4_6, 2016, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('HIACE', 'Hiace', 'VAN', [
    g('H200_PANEL', 'H200', 2004, 2019, [
      t('25_D4D', '2.5 D-4D', 2005, 2019, [
        c('TOY_HIACE_H200_PANEL_25D_5MT', E.TOYOTA_2KD_FTV, D.MT4X2_5, 2005, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('PANEL_VAN', 'Panel Van')),
    g('H200_COMMUTER', 'H200', 2004, 2019, [
      t('30_D4D', '3.0 D-4D', 2005, 2019, [
        c('TOY_HIACE_H200_BUS_30D_5MT', E.TOYOTA_1KD_FTV, D.MT4X2_5, 2005, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('COMMUTER', 'Commuter / Minibus')),
    g('H300_COMMUTER', 'H300', 2019, null, [
      t('28_GD6', '2.8 GD-6', 2019, null, [
        c('TOY_HIACE_H300_28D_6MT', E.TOYOTA_1GD_FTV, D.MT4X2_6, 2019, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('COMMUTER', 'Commuter / Minibus')),
  ]),
  m('CAMRY', 'Camry', 'SEDAN', [
    g('XV50', 'XV50', 2011, 2017, [
      t('25', '2.5', 2011, 2017, [
        c('TOY_CAMRY_XV50_25_6AT', E.TOYOTA_2AR_FE, D.AT4X2_6, 2011, 2017, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('XV70', 'XV70', 2017, 2024, [
      t('25', '2.5', 2018, 2024, [
        c('TOY_CAMRY_XV70_25_8AT', E.TOYOTA_A25A_FKS, D.AT4X2_8, 2018, 2024, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('25_HYBRID', '2.5 Hybrid', 2018, 2024, [
        c('TOY_CAMRY_XV70_HEV', E.TOYOTA_A25A_FXS, D.ECVT_FWD, 2018, 2024, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('XV80', 'XV80', 2024, null, [
      t('25_HYBRID', '2.5 Hybrid', 2024, null, [
        c('TOY_CAMRY_XV80_HEV', E.TOYOTA_A25A_FXS, D.ECVT_FWD, 2024, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('YARIS', 'Yaris', 'SEDAN', [
    g('XP150_SEDAN', 'XP150', 2013, 2020, [
      t('15', '1.5', 2013, 2020, [
        c('TOY_YARIS_XP150_15_CVT', E.TOYOTA_2NR_FE, D.CVT_FWD, 2013, 2020, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('SEDAN', 'Sedan')),
    g('XP150_HATCH', 'XP150', 2013, 2020, [
      t('15', '1.5', 2013, 2020, [
        c('TOY_YARIS_XP150_HATCH_15_CVT', E.TOYOTA_2NR_FE, D.CVT_FWD, 2013, 2020, 'CURATED_HISTORICAL', 'ETHIOPIA', 'LHD', 'HATCHBACK'),
      ]),
    ], d('HATCHBACK', 'Hatchback')),
  ]),
  m('COROLLA_CROSS', 'Corolla Cross', 'SUV', [
    g('XG10', 'XG10', 2020, null, [
      t('18_XS', '1.8 XS', 2021, null, [
        c('TOY_CORCROSS_18_CVT', E.TOYOTA_2ZR_FE, D.CVT_FWD, 2021, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('18_HEV_XR', '1.8 Hybrid XR', 2021, null, [
        c('TOY_CORCROSS_HEV_ECVT', E.TOYOTA_2ZR_FXE, D.ECVT_FWD, 2021, null, 'TOYOTA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('AVANZA', 'Avanza', 'MPV', [
    g('F650', 'F650', 2011, 2021, [
      t('15', '1.5', 2011, 2021, [
        c('TOY_AVANZA_F650_15_5MT', E.TOYOTA_2NR_VE, D.MT4X2_5, 2015, 2021, 'CURATED_HISTORICAL', 'AFRICA'),
      ]),
    ]),
    g('W100', 'W100', 2021, null, [
      t('15', '1.5', 2021, null, [
        c('TOY_AVANZA_W100_15_CVT', E.TOYOTA_2NR_VE, D.CVT_FWD, 2021, null, 'CURATED_HISTORICAL', 'AFRICA'),
      ]),
    ]),
  ]),
  m('RUSH', 'Rush', 'SUV', [
    g('F800', 'F800', 2017, null, [
      t('15_MT', '1.5 Manual', 2017, null, [
        c('TOY_RUSH_15_5MT', E.TOYOTA_2NR_VE, D.MT4X2_5, 2017, null, 'CURATED_HISTORICAL', 'AFRICA'),
      ]),
      t('15_AT', '1.5 Automatic', 2017, null, [
        c('TOY_RUSH_15_4AT', E.TOYOTA_2NR_VE, D.AT4X2_4, 2017, null, 'CURATED_HISTORICAL', 'AFRICA'),
      ]),
    ]),
  ]),
  m('LAND_CRUISER_200', 'Land Cruiser 200', 'SUV', [
    g('J200', 'J200', 2007, 2021, [
      t('VX_45D', 'VX 4.5 V8 Diesel', 2008, 2021, [
        c('TOY_LC200_45D_6AT', E.TOYOTA_1VD_FTV, D.AT4X4_6, 2008, 2021, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('LAND_CRUISER_300', 'Land Cruiser 300', 'SUV', [
    g('J300', 'J300', 2021, null, [
      t('VX_33D', 'VX 3.3 V6 Diesel', 2021, null, [
        c('TOY_LC300_33D_10AT', E.TOYOTA_F33A_FTV, D.AT4X4_10, 2021, null, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
  ]),
]);

const nissan = make('NISSAN', 'Nissan', [
  m('SUNNY', 'Sunny', 'SEDAN', [
    g('N17', 'N17', 2011, 2019, [
      t('BASE_MT', 'Base 5MT', 2011, 2019, [
        c('NIS_SUNNY_N17_15_5MT', E.NISSAN_HR15DE, D.MT4X2_5, 2011, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('SV_CVT', 'SV CVT', 2011, 2019, [
        c('NIS_SUNNY_N17_15_CVT', E.NISSAN_HR15DE, D.CVT_FWD, 2011, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('N18', 'N18', 2020, null, [
      t('BASE_5MT', 'Base 5MT', 2020, null, [
        c('NIS_SUNNY_N18_BASE_5MT', E.NISSAN_HR16DE, D.MT4X2_5, 2020, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('HIGH_CVT', 'High CVT', 2020, null, [
        c('NIS_SUNNY_N18_HIGH_CVT', E.NISSAN_HR16DE, D.CVT_FWD, 2020, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('ALMERA', 'Almera', 'SEDAN', [
    g('N17', 'N17', 2011, 2019, [
      t('ACENTA_15', 'Acenta 1.5', 2011, 2019, [
        c('NIS_ALMERA_N17_15_4AT', E.NISSAN_HR15DE, D.AT4X2_4, 2011, 2019, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
    g('N18', 'N18', 2020, null, [
      t('ACENTA_AT', 'Acenta AT', 2020, null, [
        c('NIS_ALMERA_N18_ACENTA_AT', E.NISSAN_HR15DE, D.AT4X2_4, 2020, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('TEKNA_AT', 'Tekna AT', 2020, null, [
        c('NIS_ALMERA_N18_TEKNA_AT', E.NISSAN_HR15DE, D.AT4X2_4, 2020, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('KICKS', 'Kicks', 'SUV', [
    g('P15', 'P15', 2016, null, [
      t('VISIA_5MT', 'Visia 5MT', 2016, null, [
        c('NIS_KICKS_VISIA_16_5MT', E.NISSAN_HR16DE, D.MT4X2_5, 2016, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('ACENTA_CVT', 'Acenta CVT', 2016, null, [
        c('NIS_KICKS_ACENTA_16_CVT', E.NISSAN_HR16DE, D.CVT_FWD, 2016, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('X_TRAIL', 'X-Trail', 'SUV', [
    g('T32', 'T32', 2013, 2022, [
      t('ACENTA_16_DCI', 'Acenta 1.6 dCi', 2014, 2022, [
        c('NIS_XTRAIL_T32_16DCI_6MT', E.NISSAN_R9M, D.MT4X2_6, 2014, 2022, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('TEKNA_25_4WD', 'Tekna 2.5 4WD', 2014, 2022, [
        c('NIS_XTRAIL_T32_25_CVT_4WD', E.NISSAN_QR25DE, D.CVT_4WD, 2014, 2022, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('PATROL', 'Patrol', 'SUV', [
    g('Y62', 'Y62', 2010, null, [
      t('LE_56', 'LE 5.6 V8', 2010, null, [
        c('NIS_PATROL_Y62_56_7AT', E.NISSAN_VK56VD, D.AT4X4_7, 2010, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('TERRA', 'Terra', 'SUV', [
    g('D23', 'D23', 2018, null, [
      t('SE_DIESEL_4X4_MT', 'SE 2.5 Diesel 4x4 MT', 2018, null, [
        c('NIS_TERRA_SE_D_6MT', E.NISSAN_YD25_140, D.MT4X4_6, 2018, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('LE_DIESEL_4X4_AT', 'LE 2.5 Diesel 4x4 AT', 2018, null, [
        c('NIS_TERRA_LE_D_7AT', E.NISSAN_YD25_140, D.AT4X4_7, 2018, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('NAVARA', 'Navara', 'PICKUP', [
    g('D23_SC', 'D23', 2015, null, [
      t('XE_4X2_MT', 'XE 4x2 MT', 2015, null, [
        c('NIS_NAVARA_SC_XE_120_6MT', E.NISSAN_YD25_120, D.MT4X2_6, 2015, null, 'NISSAN_SA_NAVARA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('SE_4X4_MT', 'SE 4x4 MT', 2015, null, [
        c('NIS_NAVARA_SC_SE_120_6MT_4X4', E.NISSAN_YD25_120, D.MT4X4_6, 2015, null, 'NISSAN_SA_NAVARA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('SINGLE_CAB', 'Single Cab')),
    g('D23_DC', 'D23', 2015, null, [
      t('XE_4X4_MT', 'XE 4x4 MT', 2015, null, [
        c('NIS_NAVARA_DC_XE_120_6MT_4X4', E.NISSAN_YD25_120, D.MT4X4_6, 2015, null, 'NISSAN_SA_NAVARA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('LE_4X4_AT', 'LE 4x4 AT', 2015, null, [
        c('NIS_NAVARA_DC_LE_140_7AT_4X4', E.NISSAN_YD25_140, D.AT4X4_7, 2015, null, 'NISSAN_SA_NAVARA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
  ]),
  m('NV350_URVAN', 'NV350 Urvan', 'VAN', [
    g('E26_PANEL', 'E26', 2012, null, [
      t('QR25_PETROL', '2.5 Petrol', 2012, null, [
        c('NIS_URVAN_PANEL_QR25_5MT', E.NISSAN_QR25_URVAN, D.MT4X2_5, 2012, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('YD25_DIESEL', '2.5 Diesel', 2012, null, [
        c('NIS_URVAN_PANEL_YD25_5MT', E.NISSAN_YD25_95, D.MT4X2_5, 2012, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ], d('PANEL_VAN', 'Panel Van')),
    g('E26_MINIBUS', 'E26', 2012, null, [
      t('QR25_PETROL', '2.5 Petrol', 2012, null, [
        c('NIS_URVAN_BUS_QR25_5MT', E.NISSAN_QR25_URVAN, D.MT4X2_5, 2012, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
      t('YD25_DIESEL', '2.5 Diesel', 2012, null, [
        c('NIS_URVAN_BUS_YD25_5MT', E.NISSAN_YD25_95, D.MT4X2_5, 2012, null, 'NISSAN_ETHIOPIA', 'ETHIOPIA'),
      ]),
    ], d('MINIBUS', 'Minibus')),
  ]),
  m('NP200', 'NP200', 'PICKUP', [
    g('X90', 'X90', 2008, 2024, [
      t('16_PETROL', '1.6 Petrol', 2008, 2024, [
        c('NIS_NP200_16_5MT', E.NISSAN_K7M, D.MT4X2_5, 2008, 2024, 'NISSAN_SA_NP200', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('15_DCI', '1.5 dCi', 2008, 2024, [
        c('NIS_NP200_15DCI_5MT', E.NISSAN_K9K, D.MT4X2_5, 2008, 2024, 'NISSAN_SA_NP200', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
]);

const mitsubishi = make('MITSUBISHI', 'Mitsubishi', [
  m('L200_TRITON', 'L200 / Triton', 'PICKUP', [
    g('KB_SC', 'KB / KA', 2005, 2015, [
      t('25_DID_4X2', '2.5 DI-D 4x2', 2005, 2015, [
        c('MIT_L200_KB_SC_25D_5MT', E.MITSUBISHI_4D56, D.MT4X2_5, 2005, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('SINGLE_CAB', 'Single Cab')),
    g('KB_DC', 'KB / KA', 2005, 2015, [
      t('25_DID_4X4', '2.5 DI-D 4x4', 2005, 2015, [
        c('MIT_L200_KB_DC_25D_5MT', E.MITSUBISHI_4D56, D.MT4X4_5, 2005, 2015, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
    g('MQ_MR_SC', 'MQ / MR', 2015, 2023, [
      t('GL_24D_4X2', 'GL 2.4 DI-D 4x2', 2015, 2023, [
        c('MIT_TRITON_SC_24D_6MT', E.MITSUBISHI_4N15_133, D.MT4X2_6, 2015, 2023, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('SINGLE_CAB', 'Single Cab')),
    g('MQ_MR_DC', 'MQ / MR', 2015, 2023, [
      t('GLS_24D_4X4_MT', 'GLS 2.4 DI-D 4x4 MT', 2015, 2023, [
        c('MIT_TRITON_DC_24D_6MT_4X4', E.MITSUBISHI_4N15_133, D.MT4X4_6, 2015, 2023, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('ATHLETE_24D_4X4_AT', 'Athlete 2.4 DI-D 4x4 AT', 2018, 2023, [
        c('MIT_TRITON_ATHLETE_24D_6AT', E.MITSUBISHI_4N15_133, D.AT4X4_6, 2018, 2023, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
  ]),
  m('PAJERO_SPORT', 'Pajero Sport', 'SUV', [
    g('QE', 'QE', 2016, null, [
      t('ASPIRE_4X2', 'Aspire 2.4 DI-D 4x2', 2020, null, [
        c('MIT_PAJS_24D_8AT_4X2', E.MITSUBISHI_4N15_133, D.AT4X2_8, 2020, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('ASPIRE_4X4', 'Aspire 2.4 DI-D 4x4', 2020, null, [
        c('MIT_PAJS_24D_8AT_4X4', E.MITSUBISHI_4N15_133, D.AT4X4_8, 2020, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('ASX', 'ASX', 'SUV', [
    g('GA', 'GA', 2010, null, [
      t('ES_MT', '2.0 ES Manual', 2020, null, [
        c('MIT_ASX_20_5MT', E.MITSUBISHI_4B11, D.MT4X2_5, 2020, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('LS_CVT', '2.0 LS CVT', 2020, null, [
        c('MIT_ASX_20_CVT', E.MITSUBISHI_4B11, D.CVT_FWD, 2020, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('OUTLANDER', 'Outlander', 'SUV', [
    g('GN', 'GN', 2021, null, [
      t('GLS_25', 'GLS 2.5 AWD', 2022, null, [
        c('MIT_OUT_GN_25_CVT_AWD', E.MITSUBISHI_PR25, D.CVT_4WD, 2022, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('ASPIRE_25', 'Aspire 2.5 AWD', 2022, null, [
        c('MIT_OUT_GN_ASPIRE_25_CVT', E.MITSUBISHI_PR25, D.CVT_4WD, 2022, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('ECLIPSE_CROSS', 'Eclipse Cross', 'SUV', [
    g('GK', 'GK', 2017, null, [
      t('GLS_15T', '1.5T GLS', 2018, null, [
        c('MIT_ECLIPSE_15T_CVT', E.MITSUBISHI_4B40, D.CVT_FWD, 2018, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('XPANDER', 'Xpander', 'MPV', [
    g('NC', 'NC', 2017, null, [
      t('15_MT', '1.5 Manual', 2018, null, [
        c('MIT_XPANDER_15_5MT', E.MITSUBISHI_4A91, D.MT4X2_5, 2018, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('15_AT', '1.5 Automatic', 2018, null, [
        c('MIT_XPANDER_15_4AT', E.MITSUBISHI_4A91, D.AT4X2_4, 2018, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('PAJERO', 'Pajero', 'SUV', [
    g('V80', 'V80', 2006, 2021, [
      t('32_DID', '3.2 DI-D', 2006, 2021, [
        c('MIT_PAJERO_V80_32D_5AT', E.MITSUBISHI_4M41, D.AT4X4_5, 2006, 2021, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
      t('38_V6', '3.8 V6', 2006, 2021, [
        c('MIT_PAJERO_V80_38_5AT', E.MITSUBISHI_6G75, D.AT4X4_5, 2006, 2021, 'CURATED_HISTORICAL', 'ETHIOPIA'),
      ]),
    ]),
  ]),
  m('OUTLANDER_SPORT', 'Outlander Sport', 'SUV', [
    g('A2', 'A2', 2024, null, [
      t('GL_15', 'GL 1.5', 2024, null, [
        c('MIT_OUTSPORT_15_CVT', E.MITSUBISHI_4A91, D.CVT_FWD, 2024, null, 'MITSUBISHI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
]);

const isuzu = make('ISUZU', 'Isuzu', [
  m('D_MAX', 'D-Max', 'PICKUP', [
    g('RT_SC', '6th Generation', 2012, 2021, [
      t('250_HO_4X4', '250 HO 4x4 Standard', 2012, 2021, [
        c('ISU_DMAX_SC_25D_5MT_4X4', E.ISUZU_4JK1, D.MT4X4_5, 2012, 2021, 'ISUZU_AFRICA', 'AFRICA'),
      ]),
    ], d('SINGLE_CAB', 'Single Cab')),
    g('RT_DC', '6th Generation', 2012, 2021, [
      t('250_HO_4X4', '250 HO 4x4', 2012, 2021, [
        c('ISU_DMAX_DC_25D_5MT_4X4', E.ISUZU_4JK1, D.MT4X4_5, 2012, 2021, 'ISUZU_AFRICA', 'AFRICA'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
    g('RG_DC', '7th Generation', 2021, null, [
      t('30_TD_4X4', '3.0 TD 4x4', 2022, null, [
        c('ISU_DMAX_RG_30D_6AT_4X4', E.ISUZU_4JJ3, D.AT4X4_6, 2022, null, 'ISUZU_AFRICA', 'AFRICA'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
  ]),
  m('MU_X', 'mu-X', 'SUV', [
    g('RJ', '2nd Generation', 2021, null, [
      t('30_TD_4X4', '3.0 TD 4x4', 2021, null, [
        c('ISU_MUX_30D_6AT_4X4', E.ISUZU_4JJ3, D.AT4X4_6, 2021, null, 'ISUZU_AFRICA', 'AFRICA'),
      ]),
    ]),
  ]),
]);

const suzuki = make('SUZUKI', 'Suzuki', [
  m('SWIFT', 'Swift', 'HATCHBACK', [
    g('A2L', '4th Generation', 2024, null, [
      t('GL_5MT', '1.2 GL 5MT', 2024, null, [
        c('SUZ_SWIFT_12_GL_5MT', E.SUZUKI_Z12E, D.MT4X2_5, 2024, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('GLX_CVT', '1.2 GLX CVT', 2024, null, [
        c('SUZ_SWIFT_12_GLX_CVT', E.SUZUKI_Z12E, D.CVT_FWD, 2024, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('ERTIGA', 'Ertiga', 'MPV', [
    g('NC', '2nd Generation', 2018, null, [
      t('GL_5MT', '1.5 GL 5MT', 2018, null, [
        c('SUZ_ERTIGA_15_GL_5MT', E.SUZUKI_K15B_ERTIGA, D.MT4X2_5, 2018, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('GL_4AT', '1.5 GL 4AT', 2018, null, [
        c('SUZ_ERTIGA_15_GL_4AT', E.SUZUKI_K15B_ERTIGA, D.AT4X2_4, 2018, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('JIMNY', 'Jimny', 'SUV', [
    g('JB74_3D', 'JB74', 2018, null, [
      t('GLX_5MT', '1.5 GLX 5MT', 2018, null, [
        c('SUZ_JIMNY_3D_15_5MT', E.SUZUKI_K15B, D.MT4X4_5, 2018, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('GLX_4AT', '1.5 GLX 4AT', 2018, null, [
        c('SUZ_JIMNY_3D_15_4AT', E.SUZUKI_K15B, D.AT4X4_4, 2018, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('THREE_DOOR', '3-Door')),
    g('JC74_5D', 'JC74', 2023, null, [
      t('GL_5MT', '1.5 GL 5MT', 2023, null, [
        c('SUZ_JIMNY_5D_15_5MT', E.SUZUKI_K15B, D.MT4X4_5, 2023, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('GLX_4AT', '1.5 GLX 4AT', 2023, null, [
        c('SUZ_JIMNY_5D_15_4AT', E.SUZUKI_K15B, D.AT4X4_4, 2023, null, 'SUZUKI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('FIVE_DOOR', '5-Door')),
  ]),
]);

const hyundai = make('HYUNDAI', 'Hyundai', [
  m('GRAND_I10', 'Grand i10', 'HATCHBACK', [
    g('AC3_HATCH', 'AC3', 2020, null, [
      t('PREMIUM_10_MT', '1.0 Premium MT', 2020, null, [
        c('HYU_GI10_10_5MT', E.HYUNDAI_GI10_10, D.MT4X2_5, 2020, null, 'HYUNDAI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('EXEC_12_AT', '1.2 Executive AT', 2020, null, [
        c('HYU_GI10_12_4AT', E.HYUNDAI_GI10_12, D.AT4X2_4, 2020, null, 'HYUNDAI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('HATCHBACK', 'Hatchback')),
    g('AC3_SEDAN', 'AC3', 2023, null, [
      t('EXEC_12_MT', '1.2 Executive MT', 2023, null, [
        c('HYU_GI10_SEDAN_12_5MT', E.HYUNDAI_GI10_12, D.MT4X2_5, 2023, null, 'HYUNDAI_SA', 'SOUTHERN_AFRICA', 'RHD', 'SEDAN'),
      ]),
      t('EXEC_12_AT', '1.2 Executive AT', 2023, null, [
        c('HYU_GI10_SEDAN_12_4AT', E.HYUNDAI_GI10_12, D.AT4X2_4, 2023, null, 'HYUNDAI_SA', 'SOUTHERN_AFRICA', 'RHD', 'SEDAN'),
      ]),
    ], d('SEDAN', 'Sedan')),
  ]),
  m('CRETA', 'Creta', 'SUV', [
    g('SU2', 'SU2', 2020, null, [
      t('PREMIUM_MT', '1.5 Premium MT', 2020, null, [
        c('HYU_CRETA_15_6MT', E.HYUNDAI_CRETA_15, D.MT4X2_6, 2020, null, 'HYUNDAI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('EXEC_IVT', '1.5 Executive IVT', 2020, null, [
        c('HYU_CRETA_15_IVT', E.HYUNDAI_CRETA_15, D.IVT_FWD, 2020, null, 'HYUNDAI_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
]);

const ford = make('FORD', 'Ford', [
  m('RANGER', 'Ranger', 'PICKUP', [
    g('P703_DC', 'P703', 2022, null, [
      t('BASE_20_ST', 'Base 2.0 Single-Turbo', 2022, null, [
        c('FORD_RANGER_BASE_20D_6MT', E.FORD_RANGER_20ST, D.MT4X4_6, 2022, null, 'FORD_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('XLT_20_BITURBO', 'XLT 2.0 Bi-Turbo', 2022, null, [
        c('FORD_RANGER_XLT_20BI_10AT', E.FORD_RANGER_20BI, D.AT4X4_10, 2022, null, 'FORD_SA', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ], d('DOUBLE_CAB', 'Double Cab')),
  ]),
]);

const kia = make('KIA', 'Kia', [
  m('PICANTO', 'Picanto', 'HATCHBACK', [
    g('JA', 'JA', 2017, null, [
      t('LX_10', 'LX 1.0', 2024, null, [
        c('KIA_PICANTO_JA_LX_10_5MT', E.KIA_PICANTO_10_MPI, D.MT4X2_5, 2024, null, 'KIA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
        c('KIA_PICANTO_JA_LX_10_4AT', E.KIA_PICANTO_10_MPI, D.AT4X2_4, 2024, null, 'KIA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('EX_12', 'EX 1.2', 2024, null, [
        c('KIA_PICANTO_JA_EX_12_5MT', E.KIA_PICANTO_12_MPI, D.MT4X2_5, 2024, null, 'KIA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
        c('KIA_PICANTO_JA_EX_12_4AT', E.KIA_PICANTO_12_MPI, D.AT4X2_4, 2024, null, 'KIA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('SPORTAGE', 'Sportage', 'SUV', [
    g('NQ5', 'NQ5', 2022, null, [
      t('GT_LINE_16T', 'GT-Line 1.6 T-GDi', 2022, null, [
        c('KIA_SPORTAGE_NQ5_GT_16T_7DCT', E.KIA_SPORTAGE_16_TGDI, D.DCT_FWD_7, 2022, null, 'KIA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
      t('EX_16D', 'EX 1.6 CRDi', 2024, null, [
        c('KIA_SPORTAGE_NQ5_EX_16D_7DCT', E.KIA_SPORTAGE_16_CRDI, D.DCT_FWD_7, 2024, null, 'KIA_SA_CURRENT', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
]);

const mercedesBenz = make('MERCEDES_BENZ', 'Mercedes-Benz', [
  m('SPRINTER', 'Sprinter', 'VAN', [
    g('W906', 'W906', 2006, 2018, [
      t('316_CDI', '316 CDI', 2009, 2018, [
        c('MB_SPRINTER_W906_316CDI_6MT_RWD', E.MERCEDES_OM651_316, D.MT_RWD_6, 2009, 2018, 'MERCEDES_SPRINTER_W906', 'AFRICA', 'LHD'),
      ]),
    ], d('PANEL_VAN', 'Panel Van')),
  ]),
]);

const chevrolet = make('CHEVROLET', 'Chevrolet', [
  m('SPARK', 'Spark', 'HATCHBACK', [
    g('M300', 'M300', 2010, 2015, [
      t('L_12', 'L 1.2', 2012, 2015, [
        c('CHEV_SPARK_M300_L_12_5MT', E.CHEVROLET_SPARK_12, D.MT4X2_5, 2012, 2015, 'CHEVROLET_SA_SPARK', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
  m('TRAILBLAZER', 'Trailblazer', 'SUV', [
    g('RG', 'RG', 2012, 2017, [
      t('LTZ_28D_4X4', 'LTZ 2.8D 4x4', 2014, 2017, [
        c('CHEV_TRAILBLAZER_RG_LTZ_28D_6AT_4X4', E.CHEVROLET_TRAILBLAZER_28D, D.AT4X4_6, 2014, 2017, 'CHEVROLET_SA_TRAILBLAZER', 'SOUTHERN_AFRICA', 'RHD'),
      ]),
    ]),
  ]),
]);

export const VEHICLE_LIBRARY: readonly AfricaVehicleMakeSpec[] = [
  toyota,
  nissan,
  mitsubishi,
  isuzu,
  suzuki,
  hyundai,
  kia,
  ford,
  mercedesBenz,
  chevrolet,
] as const;

export type VehicleLibraryStats = {
  makes: number;
  models: number;
  derivatives: number;
  generations: number;
  trims: number;
  configurations: number;
  engines: number;
  transmissions: number;
};

export function vehicleLibraryStats(
  library: readonly AfricaVehicleMakeSpec[] = VEHICLE_LIBRARY,
): VehicleLibraryStats {
  const derivativeKeys = new Set<string>();
  const engineKeys = new Set<string>();
  const transmissionKeys = new Set<string>();
  let models = 0;
  let generations = 0;
  let trims = 0;
  let configurations = 0;

  for (const makeSpec of library) {
    for (const model of makeSpec.models) {
      models += 1;
      for (const generation of model.generations) {
        generations += 1;
        if (generation.derivative) {
          derivativeKeys.add(`${makeSpec.code}:${model.code}:${generation.derivative.code}`);
        }
        for (const trim of generation.trims) {
          trims += 1;
          for (const configuration of trim.configurations) {
            configurations += 1;
            engineKeys.add(configuration.engine.key);
            transmissionKeys.add(configuration.transmission.key);
          }
        }
      }
    }
  }

  return {
    makes: library.length,
    models,
    derivatives: derivativeKeys.size,
    generations,
    trims,
    configurations,
    engines: engineKeys.size,
    transmissions: transmissionKeys.size,
  };
}

export function validateVehicleLibrary(
  library: readonly AfricaVehicleMakeSpec[] = VEHICLE_LIBRARY,
): string[] {
  const errors: string[] = [];
  const makeCodes = new Set<string>();
  const configurationCodes = new Set<string>();
  const configurationIdentityIntervals = new Map<
    string,
    Array<{ code: string; start: number; end: number }>
  >();

  const inside = (
    value: number | null | undefined,
    start: number,
    end: number | null,
  ) =>
    value === null ||
    value === undefined ||
    (value >= start && (end === null || value <= end));

  const insideTechnicalMaster = (
    value: number | null | undefined,
    start: number | undefined,
    end: number | null | undefined,
  ) =>
    value === null ||
    value === undefined ||
    ((start === undefined || value >= start) &&
      (end === null || end === undefined || value <= end));

  const configurationInterval = (
    configuration: AfricaVehicleConfigurationSpec,
  ): { start: number; end: number } => {
    if (configuration.modelYear !== undefined) {
      return {
        start: configuration.modelYear * 12,
        end: configuration.modelYear * 12 + 11,
      };
    }
    const startYear = configuration.productionStartYear ?? 0;
    const start =
      startYear * 12 + ((configuration.productionStartMonth ?? 1) - 1);
    const end =
      configuration.productionEndYear === null ||
      configuration.productionEndYear === undefined
        ? Number.POSITIVE_INFINITY
        : configuration.productionEndYear * 12 +
          ((configuration.productionEndMonth ?? 12) - 1);
    return { start, end };
  };

  for (const makeSpec of library) {
    if (makeCodes.has(makeSpec.code)) errors.push(`Duplicate make code ${makeSpec.code}`);
    makeCodes.add(makeSpec.code);
    const modelCodes = new Set<string>();

    for (const model of makeSpec.models) {
      if (modelCodes.has(model.code)) {
        errors.push(`Duplicate model code ${makeSpec.code}/${model.code}`);
      }
      modelCodes.add(model.code);
      const generationKeys = new Set<string>();

      for (const generation of model.generations) {
        if (generation.endYear !== null && generation.startYear > generation.endYear) {
          errors.push(`Invalid generation range ${makeSpec.code}/${model.code}/${generation.code}`);
        }
        const generationKey = `${generation.derivative?.code ?? 'DIRECT'}:${generation.code}`;
        if (generationKeys.has(generationKey)) {
          errors.push(`Duplicate generation ${makeSpec.code}/${model.code}/${generationKey}`);
        }
        generationKeys.add(generationKey);
        const trimCodes = new Set<string>();

        for (const trim of generation.trims) {
          if (trimCodes.has(trim.code)) {
            errors.push(`Duplicate trim ${makeSpec.code}/${model.code}/${generationKey}/${trim.code}`);
          }
          trimCodes.add(trim.code);
          const trimStart = trim.startYear ?? generation.startYear;
          const trimEnd = trim.endYear === undefined ? generation.endYear : trim.endYear;

          if (!inside(trimStart, generation.startYear, generation.endYear)) {
            errors.push(`Trim start outside generation: ${makeSpec.code}/${model.code}/${trim.code}`);
          }
          if (!inside(trimEnd, generation.startYear, generation.endYear)) {
            errors.push(`Trim end outside generation: ${makeSpec.code}/${model.code}/${trim.code}`);
          }

          for (const configuration of trim.configurations) {
            if (configurationCodes.has(configuration.code)) {
              errors.push(`Duplicate configuration code ${configuration.code}`);
            }
            configurationCodes.add(configuration.code);

            const bodyType = configuration.bodyType ?? model.bodyType;
            const identityKey = [
              makeSpec.code,
              model.code,
              generationKey,
              trim.code,
              configuration.engine.key,
              configuration.transmission.key,
              bodyType,
              configuration.market,
              configuration.steeringSide,
            ].join(':');
            const interval = configurationInterval(configuration);
            const existingIntervals =
              configurationIdentityIntervals.get(identityKey) ?? [];
            const overlapping = existingIntervals.find(
              (existing) =>
                interval.start <= existing.end &&
                existing.start <= interval.end,
            );
            if (overlapping) {
              errors.push(
                `Overlapping duplicate configuration identity ${configuration.code} conflicts with ${overlapping.code}`,
              );
            }
            existingIntervals.push({
              code: configuration.code,
              ...interval,
            });
            configurationIdentityIntervals.set(identityKey, existingIntervals);

            if (
              configuration.productionStartYear !== undefined &&
              configuration.productionEndYear !== undefined &&
              configuration.productionEndYear !== null &&
              configuration.productionStartYear > configuration.productionEndYear
            ) {
              errors.push(`Invalid configuration range ${configuration.code}`);
            }

            if (configuration.productionStartYear === undefined) {
              errors.push(
                `Missing configuration production start: ${configuration.code}`,
              );
            }
            if (
              configuration.productionEndStatus === 'ENDED' &&
              (configuration.productionEndYear === undefined ||
                configuration.productionEndYear === null)
            ) {
              errors.push(
                `ENDED configuration missing production end: ${configuration.code}`,
              );
            }
            if (
              configuration.productionEndStatus !== 'ENDED' &&
              configuration.productionEndYear !== undefined &&
              configuration.productionEndYear !== null
            ) {
              errors.push(
                `Open configuration carries production end: ${configuration.code}`,
              );
            }
            if (
              configuration.modelYear !== undefined &&
              configuration.productionStartYear !== undefined &&
              configuration.modelYear < configuration.productionStartYear
            ) {
              errors.push(
                `Model year outside configuration production: ${configuration.code}`,
              );
            }
            if (
              configuration.modelYear !== undefined &&
              configuration.productionEndYear !== undefined &&
              configuration.productionEndYear !== null &&
              configuration.modelYear > configuration.productionEndYear
            ) {
              errors.push(
                `Model year outside configuration production: ${configuration.code}`,
              );
            }

            for (const [label, value] of [
              ['model year', configuration.modelYear],
              ['configuration start', configuration.productionStartYear],
              ['configuration end', configuration.productionEndYear],
            ] as const) {
              if (!inside(value, generation.startYear, generation.endYear)) {
                errors.push(`${label} outside generation: ${configuration.code}`);
              }
              if (!inside(value, trimStart, trimEnd)) {
                errors.push(`${label} outside trim: ${configuration.code}`);
              }
              if (
                !insideTechnicalMaster(
                  value,
                  configuration.engine.startYear,
                  configuration.engine.endYear,
                )
              ) {
                errors.push(`${label} outside engine: ${configuration.code}`);
              }
              if (
                !insideTechnicalMaster(
                  value,
                  configuration.transmission.startYear,
                  configuration.transmission.endYear,
                )
              ) {
                errors.push(
                  `${label} outside transmission: ${configuration.code}`,
                );
              }
            }

            if (
              configuration.productionEndStatus === 'CURRENT' &&
              configuration.engine.endYear !== null &&
              configuration.engine.endYear !== undefined
            ) {
              errors.push(
                `CURRENT configuration uses ended engine: ${configuration.code}`,
              );
            }
            if (
              configuration.productionEndStatus === 'CURRENT' &&
              configuration.transmission.endYear !== null &&
              configuration.transmission.endYear !== undefined
            ) {
              errors.push(
                `CURRENT configuration uses ended transmission: ${configuration.code}`,
              );
            }
          }
        }
      }
    }
  }

  return errors;
}
