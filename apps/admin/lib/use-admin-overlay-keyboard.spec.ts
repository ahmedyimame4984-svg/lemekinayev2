import { describe, expect, it } from 'vitest';
import {
  resolveAdminOverlayTabWrap,
  shouldCloseAdminOverlay,
} from './use-admin-overlay-keyboard';

describe('Admin overlay keyboard policy', () => {
  it('closes on Escape only when the event is safe to treat as overlay dismissal', () => {
    expect(
      shouldCloseAdminOverlay({
        key: 'Escape',
        closeDisabled: false,
        defaultPrevented: false,
        targetTagName: 'INPUT',
      }),
    ).toBe(true);
    expect(
      shouldCloseAdminOverlay({
        key: 'Escape',
        closeDisabled: true,
        defaultPrevented: false,
        targetTagName: 'INPUT',
      }),
    ).toBe(false);
    expect(
      shouldCloseAdminOverlay({
        key: 'Escape',
        closeDisabled: false,
        defaultPrevented: false,
        targetTagName: 'SELECT',
      }),
    ).toBe(false);
    expect(
      shouldCloseAdminOverlay({
        key: 'Escape',
        closeDisabled: false,
        defaultPrevented: true,
        targetTagName: 'INPUT',
      }),
    ).toBe(false);
    expect(
      shouldCloseAdminOverlay({
        key: 'Enter',
        closeDisabled: false,
        defaultPrevented: false,
        targetTagName: 'INPUT',
      }),
    ).toBe(false);
  });

  it('wraps Tab focus at both overlay boundaries', () => {
    expect(
      resolveAdminOverlayTabWrap({
        shiftKey: false,
        focusableCount: 4,
        activeIndex: 3,
      }),
    ).toBe('FIRST');
    expect(
      resolveAdminOverlayTabWrap({
        shiftKey: true,
        focusableCount: 4,
        activeIndex: 0,
      }),
    ).toBe('LAST');
  });

  it('recovers focus into the overlay when focus is outside', () => {
    expect(
      resolveAdminOverlayTabWrap({
        shiftKey: false,
        focusableCount: 3,
        activeIndex: -1,
      }),
    ).toBe('FIRST');
    expect(
      resolveAdminOverlayTabWrap({
        shiftKey: true,
        focusableCount: 3,
        activeIndex: -1,
      }),
    ).toBe('LAST');
  });

  it('does not interfere with normal Tab travel inside the overlay', () => {
    expect(
      resolveAdminOverlayTabWrap({
        shiftKey: false,
        focusableCount: 4,
        activeIndex: 1,
      }),
    ).toBeNull();
    expect(
      resolveAdminOverlayTabWrap({
        shiftKey: true,
        focusableCount: 4,
        activeIndex: 2,
      }),
    ).toBeNull();
  });
});
