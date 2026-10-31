'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  ADMIN_FORM_DIRTY_EVENT,
  ADMIN_UNSAVED_CHANGES_MESSAGE,
  shouldConfirmAdminDiscard,
  shouldGuardAdminNavigation,
  shouldMarkAdminFormDirty,
} from './use-admin-inline-form-keyboard';

export type AdminOverlayFocusWrapTarget = 'FIRST' | 'LAST' | null;

export type AdminOverlayController<T extends HTMLElement> = RefObject<T | null> & {
  requestClose: () => boolean;
  confirmDiscard: () => boolean;
  markPristine: () => void;
};

export function shouldCloseAdminOverlay({
  key,
  closeDisabled,
  defaultPrevented,
  targetTagName,
}: {
  key: string;
  closeDisabled: boolean;
  defaultPrevented: boolean;
  targetTagName: string;
}): boolean {
  return (
    key === 'Escape' &&
    !closeDisabled &&
    !defaultPrevented &&
    targetTagName !== 'SELECT'
  );
}

export function resolveAdminOverlayTabWrap(input: {
  shiftKey: boolean;
  focusableCount: number;
  activeIndex: number;
}): AdminOverlayFocusWrapTarget {
  if (input.focusableCount <= 0) return null;

  if (input.activeIndex < 0) {
    return input.shiftKey ? 'LAST' : 'FIRST';
  }

  if (input.shiftKey && input.activeIndex === 0) return 'LAST';
  if (
    !input.shiftKey &&
    input.activeIndex === input.focusableCount - 1
  ) {
    return 'FIRST';
  }

  return null;
}

export function useAdminOverlayKeyboard<T extends HTMLElement>(options: {
  open: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
  discardMessage?: string;
}): AdminOverlayController<T> {
  const rootRef = useRef<T>(null);
  const onCloseRef = useRef(options.onClose);
  const closeDisabledRef = useRef(options.closeDisabled ?? false);
  const discardMessageRef = useRef(
    options.discardMessage ?? ADMIN_UNSAVED_CHANGES_MESSAGE,
  );
  const dirtyRef = useRef(false);

  onCloseRef.current = options.onClose;
  closeDisabledRef.current = options.closeDisabled ?? false;
  discardMessageRef.current =
    options.discardMessage ?? ADMIN_UNSAVED_CHANGES_MESSAGE;

  function markPristine() {
    dirtyRef.current = false;
  }

  function confirmDiscard(): boolean {
    if (closeDisabledRef.current) return false;

    if (
      shouldConfirmAdminDiscard({
        dirty: dirtyRef.current,
        saving: closeDisabledRef.current,
      }) &&
      !window.confirm(discardMessageRef.current)
    ) {
      return false;
    }

    dirtyRef.current = false;
    return true;
  }

  function requestClose(): boolean {
    if (!confirmDiscard()) return false;

    onCloseRef.current();
    return true;
  }

  useEffect(() => {
    if (!options.open) {
      dirtyRef.current = false;
      return;
    }

    dirtyRef.current = false;
    const root = rootRef.current;
    if (!root) return;

    const markDirty = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !shouldMarkAdminFormDirty({
          eventType: event.type,
          insideComboboxPanel: Boolean(
            target?.closest('.admin-combobox__panel'),
          ),
        })
      ) {
        return;
      }
      dirtyRef.current = true;
    };

    root.addEventListener('input', markDirty, true);
    root.addEventListener('change', markDirty, true);
    root.addEventListener(ADMIN_FORM_DIRTY_EVENT, markDirty, true);

    return () => {
      root.removeEventListener('input', markDirty, true);
      root.removeEventListener('change', markDirty, true);
      root.removeEventListener(ADMIN_FORM_DIRTY_EVENT, markDirty, true);
      dirtyRef.current = false;
    };
  }, [options.open]);

  useEffect(() => {
    if (!options.open) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (
        !shouldConfirmAdminDiscard({
          dirty: dirtyRef.current,
          saving: closeDisabledRef.current,
        })
      ) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    function handleDocumentClick(event: MouseEvent) {
      const target =
        event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      if (
        !shouldGuardAdminNavigation({
          dirty: dirtyRef.current,
          saving: closeDisabledRef.current,
          defaultPrevented: event.defaultPrevented,
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          target: anchor.target || null,
          download: anchor.hasAttribute('download'),
          currentUrl: window.location.href,
          destinationUrl: anchor.href,
        })
      ) {
        return;
      }

      if (window.confirm(discardMessageRef.current)) {
        dirtyRef.current = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [options.open]);

  useEffect(() => {
    if (!options.open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;

      const preferred = root.querySelector<HTMLElement>(
        '[data-admin-autofocus]',
      );
      const focusable = getFocusableElements(root);
      (preferred ?? focusable[0] ?? root).focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      const root = rootRef.current;
      if (!root) return;

      const targetTagName =
        event.target instanceof HTMLElement ? event.target.tagName : '';

      if (
        shouldCloseAdminOverlay({
          key: event.key,
          closeDisabled: closeDisabledRef.current,
          defaultPrevented: event.defaultPrevented,
          targetTagName,
        })
      ) {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(root);
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const activeIndex = focusable.findIndex(
        (element) => element === document.activeElement,
      );
      const tabTarget = resolveAdminOverlayTabWrap({
        shiftKey: event.shiftKey,
        focusableCount: focusable.length,
        activeIndex,
      });

      if (!tabTarget) return;

      event.preventDefault();
      const next =
        tabTarget === 'FIRST'
          ? focusable[0]
          : focusable[focusable.length - 1];
      next?.focus();
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      });
    };
  }, [options.open]);

  return Object.assign(rootRef, {
    requestClose,
    confirmDiscard,
    markPristine,
  }) as AdminOverlayController<T>;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0,
  );
}
