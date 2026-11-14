import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AutotechdocSyncClient } from './autotechdoc-sync-client.js';
import { ReferenceDataUpserter } from './reference-data-upserter.js';
import { ReferenceSyncNotificationController } from './reference-sync-notification.controller.js';
import { ReferenceSyncController } from './reference-sync.controller.js';
import { ReferenceSyncService } from './reference-sync.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ReferenceSyncController, ReferenceSyncNotificationController],
  providers: [
    AutotechdocSyncClient,
    ReferenceDataUpserter,
    ReferenceSyncService,
  ],
  exports: [ReferenceSyncService, AutotechdocSyncClient, ReferenceDataUpserter],
})
export class ReferenceSyncModule {}
