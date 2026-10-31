import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../components/admin-master-lifecycle-actions.tsx', import.meta.url),
  'utf8',
);

describe('Admin master lifecycle action policy', () => {
  it('uses a shared row-safe action menu with a focused confirmation dialog', () => {
    expect(source).toContain('<AdminRecordActionMenu');
    expect(source).toContain('admin-confirm-card');
    expect(source).toContain('Record actions');
    expect(source).not.toContain('<details');
    expect(source).not.toContain('catalog-drawer--compact');
  });

  it('contains keyboard focus while the confirmation is open and restores it on close', () => {
    expect(source).toContain('useAdminOverlayKeyboard<HTMLElement>');
    expect(source).toContain('closeDisabled: saving');
    expect(source).toContain('ref={dialogKeyboard}');
    expect(source).toContain('triggerRef={menuTriggerRef}');
    expect(source).toContain('wasDialogOpenRef.current && !open');
    expect(source).toContain('menuTriggerRef.current.focus()');
    expect(source).toContain('dialogKeyboard.requestClose()');
    expect(source).not.toContain('ref={dialogRef}');
  });

  it('keeps routine archive, retire and restore confirmation-only', () => {
    expect(source).toContain("action === 'DELETE' && reason.trim().length < 5");
    expect(source).toContain("{ version }");
    expect(source).toContain(
      "targetStatus: action === 'RETIRE' ? 'DEPRECATED' : 'ARCHIVED'",
    );
  });

  it('closes the compact dialog after a successful action', () => {
    expect(source).toContain('setOpen(false);');
    expect(source).toContain('onCompleted();');
  });

  it('hides lifecycle actions when the operator lacks manage permission', () => {
    expect(source).toContain('if (disabled) return null;');
  });

  it('keeps blocked deletion details reachable while final submit stays gated', () => {
    expect(source).toContain('preflightLoading && isDelete');
    expect(source).toContain('Boolean(preflight?.canPermanentlyDelete)');
    expect(source).toContain('preflight?.canPermanentlyDelete');
    expect(source).toContain('Permanent delete is blocked.');
    expect(source).toContain('/removal-preflight');
    expect(source).toContain("disabled: status !== 'DRAFT'");
    expect(source).toContain("if (nextAction === 'DELETE') void loadDeletePreflight()");
    expect(source).toContain('/permanent-delete');
    expect(source).toContain("'POST'");
  });
});
