import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface HealthStatus {
  status: 'ok';
  service: 'lemekinaye-api';
  version: string;
  timestamp: string;
}

export interface ReadinessStatus extends HealthStatus {
  checks: { database: 'up' };
}

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: 'lemekinaye-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    await this.database.isHealthy();
    return { ...this.getStatus(), checks: { database: 'up' } };
  }
}
