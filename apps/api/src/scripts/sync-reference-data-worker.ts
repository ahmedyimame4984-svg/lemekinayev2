import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ReferenceSyncService } from '../reference-sync/reference-sync.service.js';

// One managed worker; the persistent schedule is controlled by Admin Pro.
// Inspect configuration every 15 seconds so changes apply without restart.
// A five-minute interval aligns to :00, :05, :10, etc. around the clock.
const application = await NestFactory.createApplicationContext(AppModule);
const sync = application.get(ReferenceSyncService);
const CHECK_INTERVAL_MS = 15_000;
let stopped = false;
let running = false;
let lastSlot: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

async function cycle() {
  if (stopped || running) return;
  running = true;
  try {
    const schedule = await sync.getSchedule();
    if (schedule.enabled) {
      const intervalMs = schedule.intervalMinutes * 60_000;
      const slot = `${schedule.intervalMinutes}:${Math.floor(Date.now() / intervalMs)}`;
      if (slot !== lastSlot) {
        // Never run twice in the same fixed clock slot, even after an error.
        lastSlot = slot;
        const result = await sync.executeIncrementalSync();
        console.info('[reference-sync] completed', result.syncType, result.appliedCount);
      }
    }
  } catch (error) {
    console.error('[reference-sync] cycle failed', error);
  } finally {
    running = false;
    if (!stopped) timer = setTimeout(() => { void cycle(); }, CHECK_INTERVAL_MS);
  }
}

async function shutdown() {
  stopped = true;
  if (timer) clearTimeout(timer);
  while (running) await new Promise((resolve) => setTimeout(resolve, 200));
  await application.close();
}

process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
await cycle();
