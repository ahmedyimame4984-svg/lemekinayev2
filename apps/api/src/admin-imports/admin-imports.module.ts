import { Module } from '@nestjs/common';
import { AdminImportsController } from './admin-imports.controller.js';
import { AdminImportsService } from './admin-imports.service.js';

@Module({
  controllers: [AdminImportsController],
  providers: [AdminImportsService],
  exports: [AdminImportsService],
})
export class AdminImportsModule {}
