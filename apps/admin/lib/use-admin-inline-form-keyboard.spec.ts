import { describe, expect, it } from 'vitest';
import {
  ADMIN_FORM_DIRTY_EVENT,
  shouldCancelAdminInlineForm,
  shouldConfirmAdminDiscard,
  shouldGuardAdminNavigation,
  shouldMarkAdminFormDirty,
} from './use-admin-inline-form-keyboard';

describe('Admin form dirty-event policy', () => {
  it('ignores combobox search typing but marks a real combobox selection', () => {
    expect(
      shouldMarkAdminFormDirty({
        eventType: 'input',
        insideComboboxPanel: true,
      }),
    ).toBe(false);

    expect(
      shouldMarkAdminFormDirty({
        eventType: ADMIN_FORM_DIRTY_EVENT,
        insideComboboxPanel: false,
      }),
    ).toBe(true);
  });

  it('marks ordinary form input and change events as dirty', () => {
    expect(
      shouldMarkAdminFormDirty({
        eventType: 'input',
        insideComboboxPanel: false,
      }),
    ).toBe(true);
    expect(
      shouldMarkAdminFormDirty({
        eventType: 'change',
        insideComboboxPanel: false,
      }),
    ).toBe(true);
  });
});

describe('shouldCancelAdminInlineForm', () => {
  it('cancels an idle editor on Escape from a normal field', () => {
    expect(
      shouldCancelAdminInlineForm({
        key: 'Escape',
        defaultPrevented: false,
        saving: false,
        targetTagName: 'INPUT',
      }),
    ).toBe(true);
  });

  it('does not cancel while a save is in progress', () => {
    expect(
      shouldCancelAdminInlineForm({
        key: 'Escape',
        defaultPrevented: false,
        saving: true,
        targetTagName: 'INPUT',
      }),
    ).toBe(false);
  });

  it('preserves native select Escape behavior', () => {
    expect(
      shouldCancelAdminInlineForm({
        key: 'Escape',
        defaultPrevented: false,
        saving: false,
        targetTagName: 'SELECT',
      }),
    ).toBe(false);
  });

  it('ignores non-Escape keys and already handled events', () => {
    expect(
      shouldCancelAdminInlineForm({
        key: 'Enter',
        defaultPrevented: false,
        saving: false,
        targetTagName: 'INPUT',
      }),
    ).toBe(false);

    expect(
      shouldCancelAdminInlineForm({
        key: 'Escape',
        defaultPrevented: true,
        saving: false,
        targetTagName: 'INPUT',
      }),
    ).toBe(false);
  });
});

describe('Admin unsaved-change policy', () => {
  it('confirms only dirty editors that are not currently saving', () => {
    expect(
      shouldConfirmAdminDiscard({ dirty: true, saving: false }),
    ).toBe(true);
    expect(
      shouldConfirmAdminDiscard({ dirty: false, saving: false }),
    ).toBe(false);
    expect(
      shouldConfirmAdminDiscard({ dirty: true, saving: true }),
    ).toBe(false);
  });

  it('guards normal same-origin navigation away from a dirty editor', () => {
    expect(
      shouldGuardAdminNavigation({
        dirty: true,
        saving: false,
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: null,
        download: false,
        currentUrl: 'https://admin.example/admin/catalog/categories',
        destinationUrl: '/admin/catalog/product-types?status=ACTIVE',
      }),
    ).toBe(true);
  });

  it('guards same-window external navigation because it can discard edits', () => {
    expect(
      shouldGuardAdminNavigation({
        dirty: true,
        saving: false,
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: null,
        download: false,
        currentUrl: 'https://admin.example/admin/catalog/categories',
        destinationUrl: 'https://external.example/',
      }),
    ).toBe(true);
  });

  it('does not guard clean, saving, modified, download, new-window, current-URL, or hash-only navigation', () => {
    const base = {
      dirty: true,
      saving: false,
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: null,
      download: false,
      currentUrl: 'https://admin.example/admin/catalog/categories',
      destinationUrl: 'https://admin.example/admin/catalog/categories',
    };

    expect(shouldGuardAdminNavigation(base)).toBe(false);
    expect(
      shouldGuardAdminNavigation({
        ...base,
        dirty: false,
        destinationUrl: '/admin/catalog/product-types',
      }),
    ).toBe(false);
    expect(
      shouldGuardAdminNavigation({
        ...base,
        saving: true,
        destinationUrl: '/admin/catalog/product-types',
      }),
    ).toBe(false);
    expect(
      shouldGuardAdminNavigation({
        ...base,
        ctrlKey: true,
        destinationUrl: '/admin/catalog/product-types',
      }),
    ).toBe(false);
    expect(
      shouldGuardAdminNavigation({
        ...base,
        download: true,
        destinationUrl: '/export.csv',
      }),
    ).toBe(false);
    expect(
      shouldGuardAdminNavigation({
        ...base,
        target: '_blank',
        destinationUrl: 'https://external.example/',
      }),
    ).toBe(false);
    expect(
      shouldGuardAdminNavigation({
        ...base,
        destinationUrl:
          'https://admin.example/admin/catalog/categories#details',
      }),
    ).toBe(false);
  });
});
