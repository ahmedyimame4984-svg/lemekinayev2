import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ReferenceSyncService } from '../reference-sync/reference-sync.service.js';

// Run this as ONE managed worker process, independently of the HTTP API.
// When more than one deployment starts it, database locks prevent parallel runs.
const configured = Number(process.env.AUTOTECHDOC_SYNC_INTERVAL_SECONDS ?? '300');
if (!Number.isInteger(configured) || configured < 30 || configured > 86_400) {
  throw new Error('AUTOTECHDOC_SYNC_INTERVAL_SECONDS must be an integer between 30 and 86400');
}
const intervalMs = configured * 1000;
const application = await NestFactory.createApplicationContext(AppModule);
const sync = application.get(ReferenceSyncService);
let stopped = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

async function cycle() {
  if (stopped || running) return;
  running = true;
  try {
    // Automatically initializes via a resumable snapshot when none is completed.
    const result = await sync.executeIncrementalSync();
    console.info('[reference-sync] completed', result.syncType, result.appliedCount);
  } catch (error) {
    // A competing manual or scheduled run is normal. Next cycle catches up.
    console.error('[reference-sync] cycle failed', error);
  } finally {
    running = false;
    if (!stopped) timer = setTimeout(() => { void cycle(); }, intervalMs);
  }
}

async function shutdown() {
  stopped = true;
  if (timer) clearTimeout(timer);
  // Allow an in-progress transaction to finish before closing the pool.
  while (running) await new Promise((resolve) => setTimeout(resolve, 200));
  await application.close();
}
process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
await cycle();
