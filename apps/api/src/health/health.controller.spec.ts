import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  const database = { isHealthy: vi.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: DatabaseService,
          useValue: database,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns the Lemekinaye API status', () => {
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('lemekinaye-api');
    expect(result.version).toBe('0.1.0');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('reports liveness without checking dependencies', () => {
    expect(controller.getLiveness().status).toBe('ok');
  });

  it('reports readiness after checking PostgreSQL', async () => {
    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('reports unavailable when PostgreSQL cannot be queried', async () => {
    database.isHealthy.mockRejectedValueOnce(new Error('connection refused'));

    await expect(controller.getReadiness()).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', checks: { database: 'down' } },
    });
  });
});
