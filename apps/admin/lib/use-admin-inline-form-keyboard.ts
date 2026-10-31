'use client';

import { type KeyboardEvent, useEffect, useRef } from 'react';

type AdminInlineFormKeyboardOptions = {
  open: boolean;
  saving: boolean;
  focusKey?: string | number | boolean | null;
  onEscape: () => void;
  discardMessage?: string;
};

export const ADMIN_UNSAVED_CHANGES_MESSAGE =
  'Discard unsaved changes? Your edits will be lost.';

export const ADMIN_FORM_DIRTY_EVENT = 'admin-form-dirty';

export function shouldMarkAdminFormDirty(input: {
  eventType: string;
  insideComboboxPanel: boolean;
}): boolean {
  return (
    input.eventType === ADMIN_FORM_DIRTY_EVENT ||
    !input.insideComboboxPanel
  );
}

export function shouldCancelAdminInlineForm({
  key,
  defaultPrevented,
  saving,
  targetTagName,
}: {
  key: string;
  defaultPrevented: boolean;
  saving: boolean;
  targetTagName: string;
}): boolean {
  return (
    key === 'Escape' &&
    !defaultPrevented &&
    !saving &&
    targetTagName !== 'SELECT'
  );
}

export function shouldConfirmAdminDiscard({
  dirty,
  saving,
}: {
  dirty: boolean;
  saving: boolean;
}): boolean {
  return dirty && !saving;
}

export function shouldGuardAdminNavigation(input: {
  dirty: boolean;
  saving: boolean;
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: string | null;
  download: boolean;
  currentUrl: string;
  destinationUrl: string;
}): boolean {
  if (
    !input.dirty ||
    input.saving ||
    input.defaultPrevented ||
    input.button !== 0 ||
    input.metaKey ||
    input.ctrlKey ||
    input.shiftKey ||
    input.altKey ||
    (input.target !== null && input.target !== '_self') ||
    input.download
  ) {
    return false;
  }

  try {
    const current = new URL(input.currentUrl);
    const destination = new URL(input.destinationUrl, current);

    if (destination.origin !== current.origin) return true;

    return (
      destination.pathname !== current.pathname ||
      destination.search !== current.search
    );
  } catch {
    return false;
  }
}

export function useAdminInlineFormKeyboard<T extends HTMLElement>({
  open,
  saving,
  focusKey = null,
  onEscape,
  discardMessage = ADMIN_UNSAVED_CHANGES_MESSAGE,
}: AdminInlineFormKeyboardOptions) {
  const ref = useRef<T | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(saving);
  const onEscapeRef = useRef(onEscape);
  const discardMessageRef = useRef(discardMessage);

  savingRef.current = saving;
  onEscapeRef.current = onEscape;
  discardMessageRef.current = discardMessage;

  useEffect(() => {
    if (!open) {
      dirtyRef.current = false;
      return;
    }

    dirtyRef.current = false;
    const container = ref.current;
    if (!container) return;

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

    container.addEventListener('input', markDirty, true);
    container.addEventListener('change', markDirty, true);
    container.addEventListener(ADMIN_FORM_DIRTY_EVENT, markDirty, true);

    return () => {
      container.removeEventListener('input', markDirty, true);
      container.removeEventListener('change', markDirty, true);
      container.removeEventListener(ADMIN_FORM_DIRTY_EVENT, markDirty, true);
    };
  }, [focusKey, open]);

  useEffect(() => {
    if (!open) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (
        !shouldConfirmAdminDiscard({
          dirty: dirtyRef.current,
          saving: savingRef.current,
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
          saving: savingRef.current,
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
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      const container = ref.current;
      if (!container) return;

      const target = container.querySelector<HTMLElement>(
        '[data-admin-autofocus], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
      );
      target?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusKey, open]);

  function confirmDiscard(): boolean {
    if (savingRef.current) return false;

    if (
      shouldConfirmAdminDiscard({
        dirty: dirtyRef.current,
        saving: savingRef.current,
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
    onEscapeRef.current();
    return true;
  }

  function markPristine() {
    dirtyRef.current = false;
  }

  function onKeyDown(event: KeyboardEvent<T>) {
    const target =
      event.target instanceof HTMLElement ? event.target.tagName : '';

    if (
      !shouldCancelAdminInlineForm({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        saving,
        targetTagName: target,
      })
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    requestClose();
  }

  return { ref, onKeyDown, requestClose, confirmDiscard, markPristine };
}
