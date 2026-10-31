import { Module } from '@nestjs/common';
import { AdminCompatibilityController } from './admin-compatibility.controller.js';
import { CompatibilityController } from './compatibility.controller.js';
import { CompatibilityService } from './compatibility.service.js';

@Module({
  controllers: [CompatibilityController, AdminCompatibilityController],
  providers: [CompatibilityService],
  exports: [CompatibilityService],
})
export class CompatibilityModule {}
