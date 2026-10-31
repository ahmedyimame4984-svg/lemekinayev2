import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { MasterReferenceBootstrapService } from './master-reference-bootstrap.service.js';
import type { MasterReferenceService } from './master-reference.service.js';
const originalEnvironment = process.env.NODE_ENV;
afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment;
});
function setup(ready = false) {
  const db = {
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'admin' }) },
    vehicleConfiguration: { update: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = {
    cleanupLegacySeedCatalog: vi.fn().mockResolvedValue({ removed: false }),
    canonicalAttributeStatus: vi.fn().mockResolvedValue({ ready }),
    reconcileAttributes: vi.fn().mockResolvedValue({}),
    replace: vi.fn(),
  };
  const bootstrap = new MasterReferenceBootstrapService(
    db as unknown as DatabaseService,
    service as unknown as MasterReferenceService,
  );
  return { db, service, bootstrap };
}
describe('attribute-only development bootstrap', () => {
  it('reconciles attributes without repairing/replacing vehicle data', async () => {
    process.env.NODE_ENV = 'development';
    const { db, service, bootstrap } = setup();
    await bootstrap.onApplicationBootstrap();
    expect(service.reconcileAttributes).toHaveBeenCalledWith('admin');
    expect(service.replace).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.vehicleConfiguration.update).not.toHaveBeenCalled();
    expect(db.vehicleConfiguration.deleteMany).not.toHaveBeenCalled();
  });
  it('preserves the guarded catalog cleanup and skips ready attributes', async () => {
    process.env.NODE_ENV = 'development';
    const { service, bootstrap } = setup(true);
    await bootstrap.onApplicationBootstrap();
    expect(service.cleanupLegacySeedCatalog).toHaveBeenCalledWith('admin');
    expect(service.reconcileAttributes).not.toHaveBeenCalled();
  });
  it.each(['production', 'test'])(
    'does not bootstrap in %s',
    async (environment) => {
      process.env.NODE_ENV = environment;
      const { db, bootstrap } = setup();
      await bootstrap.onApplicationBootstrap();
      expect(db.user.findFirst).not.toHaveBeenCalled();
    },
  );
  it('skips when no admin exists', async () => {
    process.env.NODE_ENV = 'development';
    const { db, service, bootstrap } = setup();
    db.user.findFirst.mockResolvedValue(null as never);
    await bootstrap.onApplicationBootstrap();
    expect(service.reconcileAttributes).not.toHaveBeenCalled();
  });
  it('propagates attribute reconciliation failures', async () => {
    process.env.NODE_ENV = 'development';
    const { service, bootstrap } = setup();
    service.reconcileAttributes.mockRejectedValue(new Error('failed'));
    await expect(bootstrap.onApplicationBootstrap()).rejects.toThrow('failed');
  });
});
