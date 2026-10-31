import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../src/app.setup.js';
import type { DatabaseService } from '../src/database/database.service.js';
import type { VinDecodeResponseDto } from '../src/vehicle/dto/vin.dto.js';
import type { NhtsaVinDecoderProvider } from '../src/vehicle/nhtsa-vin-decoder.provider.js';
import type { VehicleConfigurationService } from '../src/vehicle/vehicle-configuration.service.js';
import { VehicleIdentificationController } from '../src/vehicle/vehicle-identification.controller.js';
import { VehicleIdentificationService } from '../src/vehicle/vehicle-identification.service.js';
import { VinController } from '../src/vehicle/vin.controller.js';
import { VinService } from '../src/vehicle/vin.service.js';

describe('VIN decoder warning round trip (e2e)', () => {
  let app: INestApplication;
  const vin = 'JTDBU4EE9B9123456';
  const decoded = {
    make: 'Toyota',
    model: 'Corolla',
    modelYear: 2010,
    engine: '2ZR-FE',
    transmission: 'CVT',
  };
  const warning = 'Verify decoder evidence.';
  const candidate = {
    id: '00000000-0000-4000-8000-000000000010',
    code: 'TOYOTA_COROLLA_2010',
  };
  const database = {
    vehicleConfiguration: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([{ id: candidate.id }]),
    },
    vehicleIdentifierMapping: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
  const configurations = {
    getPublishedConfiguration: vi.fn().mockResolvedValue(candidate),
  };
  const provider = { name: 'nhtsa-vpic', decode: vi.fn() };

  beforeAll(async () => {
    const db = database as unknown as DatabaseService;
    const catalog = configurations as unknown as VehicleConfigurationService;
    const resolver = new VinService(
      db,
      catalog,
      provider as unknown as NhtsaVinDecoderProvider,
    );
    const module = await Test.createTestingModule({
      controllers: [VinController, VehicleIdentificationController],
      providers: [
        { provide: VinService, useValue: resolver },
        {
          provide: VehicleIdentificationService,
          useValue: new VehicleIdentificationService(db, catalog, resolver),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    provider.decode.mockResolvedValue({
      provider: provider.name,
      decoded,
      warnings: [warning],
    });
  });

  it.each(['vin/resolve', 'vehicle-identification/resolve'])(
    'keeps complete warned decoder output partial through %s',
    async (path) => {
      const decodeResponse = await request(app.getHttpServer())
        .post('/api/v1/vin/decode')
        .send({ vin })
        .expect(201);
      const output = decodeResponse.body as VinDecodeResponseDto;
      const identity = path === 'vin/resolve' ? { vin } : { identifier: vin };
      const response = await request(app.getHttpServer())
        .post(`/api/v1/${path}`)
        .send({
          ...identity,
          provider: output.provider,
          decoded: output.decoded,
          warnings: output.warnings,
        })
        .expect(path === 'vin/resolve' ? 201 : 200);

      expect(response.body).toMatchObject({
        status: 'PARTIAL_MATCH',
        provider: provider.name,
        decoded,
        warnings: [warning],
        candidateCount: 1,
        missingForExactMatch: [],
        candidates: [candidate],
      });
      expect(provider.decode).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps clean complete decoder output eligible for an exact match', async () => {
    provider.decode.mockResolvedValue({
      provider: provider.name,
      decoded,
      warnings: [],
    });
    const decodeResponse = await request(app.getHttpServer())
      .post('/api/v1/vin/decode')
      .send({ vin })
      .expect(201);
    const output = decodeResponse.body as VinDecodeResponseDto;
    const response = await request(app.getHttpServer())
      .post('/api/v1/vin/resolve')
      .send({
        vin,
        provider: output.provider,
        decoded: output.decoded,
        warnings: output.warnings,
      })
      .expect(201);

    expect(response.body.status).toBe('EXACT_MATCH');
    expect(response.body.warnings).toEqual([]);
    expect(provider.decode).toHaveBeenCalledTimes(1);
  });

  describe.each(['vin/resolve', 'vehicle-identification/resolve'])(
    '%s warning validation',
    (path) => {
      it.each([
        { label: 'non-array', warnings: warning },
        { label: 'non-string element', warnings: [1] },
        { label: 'too many warnings', warnings: Array(21).fill(warning) },
        { label: 'oversized warning', warnings: ['x'.repeat(501)] },
      ])('rejects $label before vehicle matching', async ({ warnings }) => {
        const identity = path === 'vin/resolve' ? { vin } : { identifier: vin };
        await request(app.getHttpServer())
          .post(`/api/v1/${path}`)
          .send({ ...identity, decoded, warnings })
          .expect(400);

        expect(provider.decode).not.toHaveBeenCalled();
        expect(database.vehicleConfiguration.count).not.toHaveBeenCalled();
      });
    },
  );
});
