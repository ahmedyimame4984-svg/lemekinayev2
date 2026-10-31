import { Module } from '@nestjs/common';
import { AdminSavedViewController } from './admin-saved-view.controller.js';
import { AdminSavedViewService } from './admin-saved-view.service.js';

@Module({
  controllers: [AdminSavedViewController],
  providers: [AdminSavedViewService],
  exports: [AdminSavedViewService],
})
export class AdminPreferencesModule {}
