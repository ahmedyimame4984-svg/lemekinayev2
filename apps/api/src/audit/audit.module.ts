import { Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [AdminAuditController],
  providers: [AuditService],
})
export class AuditModule {}
