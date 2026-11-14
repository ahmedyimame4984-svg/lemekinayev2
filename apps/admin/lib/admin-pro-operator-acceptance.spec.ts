import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Admin Pro operator acceptance — automated evidence', () => {
  it.each([
    ['../app/admin/catalog/product-types/page.tsx', 'ProductTypesManagement'],
    ['../app/admin/vehicles/configurations/page.tsx', 'CanonicalVehicleLibrary'],
    ['../app/admin/marketplace/sellers/page.tsx', 'SellersManagement'],
    ['../app/admin/sourcing/suppliers/page.tsx', 'SupplierMasterManagement'],
    ['../app/admin/audit/page.tsx', 'AuditHistoryManagement'],
    ['../app/admin/imports/page.tsx', 'AdminImportJobsWorkspace'],
    ['../app/admin/accounts/page.tsx', 'AdminAccountsManagement'],
  ])('%s exposes the accepted operational workspace', (path, component) => {
    expect(read(path)).toContain(component);
  });

  it.each([
    [
      '../app/admin/catalog/products/page.tsx',
      "redirect('/admin/catalog/product-types')",
    ],
    [
      '../app/admin/sourcing/offers/page.tsx',
      "redirect('/admin/sourcing/suppliers')",
    ],
  ])('%s preserves the canonical ownership boundary', (path, redirect) => {
    expect(read(path)).toContain(redirect);
  });

  it('routes Admin listing reviews to dedicated permission-gated moderation', () => {
    const page = read('../app/admin/marketplace/listings/page.tsx');
    const moderation = read('../components/listing-moderation.tsx');
    const tabs = read('../components/seller-management-tabs.tsx');
    expect(page).toContain('ListingModeration');
    expect(page).not.toContain("redirect('/admin/marketplace/sellers')");
    expect(moderation).toContain("principal.permissions.includes('listing.manage')");
    expect(tabs).toContain('href="/admin/marketplace/listings"');
    const sellers = read('../components/sellers-management.tsx');
    expect(sellers).toContain('Sellers register their own accounts');
    expect(sellers).not.toContain('Provision the first Seller account');
  });

  it('keeps Product Types suitable for large-scale professional operation', () => {
    const source = read('../components/product-types-management.tsx');
    for (const token of [
      'AdminSearchableCombobox',
      'AdminLibraryPagination',
      'AdminSavedViewsToolbar',
      'ProductTypeTechnicalAttributes',
      'ProductTypeRequirementFields',
      'useAdminInlineFormKeyboard',
      'AdminStatusBadge',
      'AdminLoadingState',
      'LikelyDuplicateWarning',
      'import/preview',
      'import/commit',
    ]) {
      expect(source).toContain(token);
    }
  });

  it('distinguishes an empty Product Type library from an unsuccessful filtered search', () => {
    const source = read('../components/product-types-management.tsx');
    expect(source).toContain('libraryHasActiveFilters');
    expect(source).toContain("'No Product Types yet'");
    expect(source).toContain("'No Product Types match the current filters'");
    expect(source).toContain('Start with a Category and Part Group');
    expect(source).toContain('Adjust your search or reset the filters');
  });

  it('keeps Configured Vehicles suitable for professional guided entry and review', () => {
    const source = read('../components/vehicle-builder.tsx');
    for (const token of [
      'AdminSearchableCombobox',
      'AdminLibraryPagination',
      'AdminSavedViewsToolbar',
      'useAdminInlineFormKeyboard',
      'LikelyDuplicateWarning',
      'validate-activation',
      'exportConfiguredVehiclesCsv',
    ]) {
      expect(source).toContain(token);
    }
  });

  it('does not expose Configured Vehicle CSV import while retaining manual editing and export', () => {
    const builder = read('../components/vehicle-builder.tsx');
    const controller = read('../../api/src/vehicle/admin-vehicle-configuration.controller.ts');
    const jobs = read('../components/admin-import-jobs-workspace.tsx');

    expect(builder).toContain('Export CSV');
    expect(builder).toContain('validate-activation');
    expect(builder).not.toContain('Import CSV');
    expect(builder).not.toContain('configuration-import/preview');
    expect(builder).not.toContain('configuration-import/commit');
    expect(jobs).not.toContain('title="Configured Vehicles"');
    expect(controller).not.toContain("@Post('configurations/import/preview')");
    expect(controller).not.toContain("@Post('configurations/import/commit')");
    expect(existsSync(new URL('../app/api/admin/vehicles/configuration-import/preview/route.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../app/api/admin/vehicles/configuration-import/commit/route.ts', import.meta.url))).toBe(false);
  });

  it('keeps governance, sourcing and audit workspaces operationally bounded', () => {
    const sellers = read('../components/sellers-management.tsx');
    const suppliers = read('../components/supplier-master-management.tsx');
    const audit = read('../components/audit-history-management.tsx');

    expect(sellers).toContain('AdminLibraryPagination');
    expect(sellers).toContain('useAdminInlineFormKeyboard');
    expect(suppliers).toContain('AdminLibraryPagination');
    expect(suppliers).toContain('useAdminInlineFormKeyboard');
    expect(audit).toContain('Audit History');
    expect(audit).toContain('role="table"');
  });

  it('reports Admin-managed vehicle records without claiming a restart will rebuild them', () => {
    const overview = read('../components/master-data-installer.tsx');
    const api = read('../../api/src/reference-data/master-reference.service.ts');
    const statusImplementation = api.split('async status(): Promise<MasterReferenceStatus> {')[1]
      ?.split('private async hasCanonicalAttributeLibrary()')[0] ?? '';

    expect(overview).toContain('status.vehicleLibraryState');
    expect(overview).toContain('status.attributeLibraryReady');
    expect(overview).toContain('masterReferenceCountDisplay(count)');
    expect(overview).toContain('Some master-data counts are unavailable');
    expect(read('./master-reference-status-display.ts')).toContain('value.expected === null');
    expect(overview).toContain('does not rebuild or');
    expect(overview).not.toContain('Automatic local bootstrap');
    expect(overview).not.toContain('restarting the local API will repair');
    expect(statusImplementation).toContain('canonicalAttributeStatus()');
    expect(statusImplementation).toContain('vehicleConfigurations');
    expect(statusImplementation).not.toContain('vehicleLibraryStats()');
    expect(statusImplementation).not.toContain('ready: false');
    expect(statusImplementation).not.toContain('vehicleConfiguration.findMany');
  });

  it('sends the Overview module cards to primary Admin workspaces', () => {
    const dashboard = read('../components/dashboard-overview.tsx');
    expect(dashboard).toContain("href: '/admin/catalog/product-types'");
    expect(dashboard).toContain("href: '/admin/vehicles/configurations'");
    expect(dashboard).not.toContain("href: '/admin/catalog/categories'");
    expect(dashboard).not.toContain("href: '/admin/vehicles/makes'");
    expect(dashboard).not.toContain('Seller provisioning, verification');
  });

  it('retains the UX-finalization safeguards required before live acceptance', () => {
    expect(read('./admin-readable-density.spec.ts')).toContain(
      'Admin readable-density floor',
    );
    expect(read('./admin-data-table-semantics.spec.ts')).toContain(
      'Admin data-table semantics',
    );
    expect(read('./admin-unsaved-change-adoption.spec.ts')).toContain(
      'unsaved',
    );
    expect(read('./admin-design-system-adoption.spec.ts')).toContain(
      'design',
    );
  });
});
