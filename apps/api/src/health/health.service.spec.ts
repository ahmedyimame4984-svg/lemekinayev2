import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('HealthService', () => {
  let service: HealthService;
  const database = { isHealthy: vi.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('checks the database for readiness', async () => {
    await expect(service.getReadiness()).resolves.toMatchObject({
      checks: { database: 'up' },
    });
    expect(database.isHealthy).toHaveBeenCalledOnce();
  });
});
