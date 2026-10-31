import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const menu = readFileSync(
  new URL('../components/admin-record-action-menu.tsx', import.meta.url),
  'utf8',
);

describe('Admin Pro row action menu', () => {
  it('uses a portal to escape table overflow and announces the expanded state', () => {
    expect(menu).toContain('createPortal(');
    expect(menu).toContain('document.body');
    expect(menu).toContain('aria-haspopup="menu"');
    expect(menu).toContain('aria-expanded={open}');
    expect(menu).toContain('role="menu"');
    expect(menu).toContain('role="menuitem"');
  });

  it('supports keyboard navigation, escape, and click-away', () => {
    expect(menu).toContain("'ArrowDown'");
    expect(menu).toContain("'ArrowUp'");
    expect(menu).toContain("'Home'");
    expect(menu).toContain("'End'");
    expect(menu).toContain("'Escape'");
    expect(menu).toContain("event.key === 'Tab'");
    expect(menu).toContain("document.addEventListener('pointerdown', onPointerDown)");
  });

  it('allows a confirmation dialog to identify the exact row action trigger', () => {
    expect(menu).toContain('triggerRef?: RefObject<HTMLButtonElement | null>');
    expect(menu).toContain('externalTriggerRef ?? internalTriggerRef');
    expect(menu).toContain('ref={triggerRef}');
  });

  it('renders destructive actions distinctly without bypassing disabled actions', () => {
    expect(menu).toContain("item.destructive");
    expect(menu).toContain('disabled={item.disabled}');
    expect(menu).toContain('onSelect(item.id)');
  });
});
