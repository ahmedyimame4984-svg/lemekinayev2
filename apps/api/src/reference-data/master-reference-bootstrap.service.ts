import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { MasterReferenceService } from './master-reference.service.js';

/** Startup must never treat a legacy vehicle library as a reconstruction plan. */
@Injectable()
export class MasterReferenceBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MasterReferenceBootstrapService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly referenceData: MasterReferenceService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((process.env.NODE_ENV ?? 'development') !== 'development') return;
    const actor = await this.db.user.findFirst({
      where: { accountType: AccountType.ADMIN },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!actor) {
      this.logger.warn('Attribute bootstrap skipped: no ADMIN account exists.');
      return;
    }
    // Preserve the existing independently guarded catalog cleanup workflow.
    await this.referenceData.cleanupLegacySeedCatalog(actor.id);
    const attributes = await this.referenceData.canonicalAttributeStatus();
    if (!attributes.ready)
      await this.referenceData.reconcileAttributes(actor.id);
    this.logger.log(
      'Attribute bootstrap complete. Vehicle reconstruction requires an explicit audited plan; startup preserves all vehicle records.',
    );
  }
}
