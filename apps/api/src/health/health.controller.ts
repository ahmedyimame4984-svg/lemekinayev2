import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { HealthService } from './health.service.js';
import type { HealthStatus, ReadinessStatus } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getStatus();
  }

  @Get('live')
  getLiveness(): HealthStatus {
    return this.healthService.getStatus();
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessStatus> {
    try {
      return await this.healthService.getReadiness();
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'lemekinaye-api',
        checks: { database: 'down' },
      });
    }
  }
}
