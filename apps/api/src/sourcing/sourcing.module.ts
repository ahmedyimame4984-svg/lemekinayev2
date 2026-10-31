import { Module } from '@nestjs/common';
import { AdminSourcingController } from './admin-sourcing.controller.js';
import { SourcingService } from './sourcing.service.js';

@Module({
  controllers: [AdminSourcingController],
  providers: [SourcingService],
  exports: [SourcingService],
})
export class SourcingModule {}
