import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Admin unsaved-change adoption', () => {
  it.each([
    ['../components/categories-management.tsx', 'formKeyboard.requestClose'],
    ['../components/part-groups-management.tsx', 'formKeyboard.requestClose'],
    ['../components/brands-management.tsx', 'formKeyboard.requestClose'],
    [
      '../components/supplier-master-management.tsx',
      'supplierFormKeyboard.requestClose',
    ],
    ['../components/sellers-management.tsx', 'sellerFormKeyboard.requestClose'],
    [
      '../components/criteria-template-management.tsx',
      'formKeyboard.requestClose',
    ],
    [
      '../components/product-types-management.tsx',
      'createFormKeyboard.requestClose',
    ],
    [
      '../components/vehicle-master-configuration-management.tsx',
      'editorKeyboard.requestClose',
    ],
  ] as const)(
    'routes inline Close/Cancel through the dirty guard in %s',
    (relativePath, guardedClose) => {
      expect(read(relativePath)).toContain(guardedClose);
    },
  );

  it.each([
    ['../components/categories-management.tsx', 'formKeyboard.confirmDiscard'],
    ['../components/part-groups-management.tsx', 'formKeyboard.confirmDiscard'],
    ['../components/brands-management.tsx', 'formKeyboard.confirmDiscard'],
    [
      '../components/supplier-master-management.tsx',
      'supplierFormKeyboard.confirmDiscard',
    ],
    ['../components/sellers-management.tsx', 'sellerFormKeyboard.confirmDiscard'],
    [
      '../components/criteria-template-management.tsx',
      'formKeyboard.confirmDiscard',
    ],
    [
      '../components/product-types-management.tsx',
      'createFormKeyboard.confirmDiscard',
    ],
  ] as const)(
    'guards inline editor replacement in %s',
    (relativePath, discardGuard) => {
      expect(read(relativePath)).toContain(discardGuard);
    },
  );

  it('guards the major overlay editors and in-drawer record switches', () => {
    const attributes = read(
      '../components/attribute-master-management.tsx',
    );
    const productTypes = read(
      '../components/product-types-management.tsx',
    );
    const vehicles = read(
      '../components/vehicle-master-configuration-management.tsx',
    );

    for (const guardedClose of [
      'attributeDrawerRef.requestClose',
      'groupDrawerRef.requestClose',
      'valueDrawerRef.requestClose',
    ]) {
      expect(attributes).toContain(guardedClose);
    }

    expect(productTypes).toContain('mappingDrawerRef.requestClose');
    expect(productTypes).toContain('mappingDrawerRef.confirmDiscard');
    expect(productTypes).toContain('localizationDrawerRef.requestClose');
    expect(productTypes).toContain(
      'localizationDrawerRef.confirmDiscard',
    );

    expect(vehicles).toContain('provenanceDrawerRef.requestClose');
    expect(vehicles).toContain('provenanceDrawerRef.confirmDiscard');
  });

  it('marks actual searchable-combobox selection as a form edit', () => {
    const source = read('../components/admin-searchable-combobox.tsx');

    expect(source).toContain('ADMIN_FORM_DIRTY_EVENT');
    expect(source).toContain(
      'new CustomEvent(ADMIN_FORM_DIRTY_EVENT, { bubbles: true })',
    );
  });

  it('confirms destructive bulk lifecycle actions', () => {
    for (const relativePath of [
      '../components/brands-management.tsx',
      '../components/supplier-master-management.tsx',
    ]) {
      const source = read(relativePath);
      expect(source).toContain(
        'requiresAdminBulkLifecycleConfirmation',
      );
      expect(source).toContain(
        'adminBulkLifecycleConfirmationMessage',
      );
      expect(source).toContain('window.confirm(');
    }
  });
});

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
