import 'dotenv/config';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ReferenceSyncService } from '../reference-sync/reference-sync.service.js';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'incremental' },
    'force-full': { type: 'boolean', default: false },
    'batch-size': { type: 'string', default: '100' },
  },
  strict: true,
});

const mode = values.mode?.toLowerCase();
const forceFull = values['force-full'] ?? false;
const batchSize = parseInt(values['batch-size'] ?? '100', 10);

const application = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});

try {
  const syncService = application.get(ReferenceSyncService);

  switch (mode) {
    case 'status': {
      const status = await syncService.getStatus();
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      break;
    }
    case 'snapshot': {
      process.stdout.write(`Triggering snapshot sync (forceFull=${forceFull}, batchSize=${batchSize})...\n`);
      const result = await syncService.executeSnapshot({ forceFull, batchSize });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case 'incremental': {
      process.stdout.write(`Triggering incremental sync (batchSize=${batchSize})...\n`);
      const result = await syncService.executeIncrementalSync({ batchSize });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case 'reconcile': {
      process.stdout.write('Triggering reconciliation against canonical manifest...\n');
      const result = await syncService.executeReconciliation();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    default:
      throw new Error(`Unknown mode "${mode}". Expected "status", "snapshot", "incremental", or "reconcile".`);
  }
} finally {
  await application.close();
}
