'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export type AdminRecordActionItem<T extends string> = {
  id: T;
  title: string;
  description: string;
  destructive?: boolean;
  disabled?: boolean;
};

export function AdminRecordActionMenu<T extends string>({
  entityName,
  items,
  onSelect,
  triggerRef: externalTriggerRef,
}: {
  entityName: string;
  items: readonly AdminRecordActionItem<T>[];
  onSelect: (action: T) => void;
  /** Let confirmation dialogs restore focus to this specific row's action button. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 300 });
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const menuRef = useRef<HTMLDivElement>(null);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const left = Math.min(
      window.innerWidth - width - 12,
      Math.max(12, rect.right - width),
    );
    const height = menuRef.current?.offsetHeight ?? 280;
    const above = window.innerHeight - rect.bottom < height + 12 &&
      rect.top > height + 12;
    const top = above
      ? Math.max(12, rect.top - height - 6)
      : Math.min(window.innerHeight - height - 12, rect.bottom + 6);
    setPosition({ left, top: Math.max(12, top), width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    )?.focus();
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function closeOnViewportChange(event: Event) {
      // Scrolling a tall menu on a small screen must not dismiss it.
      if (event.type === 'scroll' && menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [open]);

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if (event.key === 'Tab') setOpen(false);
      return;
    }
    const enabled = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (!enabled.length) return;
    event.preventDefault();
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? enabled.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1) % enabled.length
          : (current + enabled.length - 1) % enabled.length;
    enabled[nextIndex]?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button button--quiet admin-lifecycle-trigger"
        aria-label={`Actions for ${entityName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Record actions"
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="admin-record-action-menu"
          role="menu"
          aria-label={`Actions for ${entityName}`}
          onKeyDown={onMenuKeyDown}
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="admin-record-action-menu__heading" aria-hidden="true">
            Record actions
          </div>
          {items.map((item, index) => (
            <div key={item.id}>
              {item.destructive && index > 0 ? (
                <div className="admin-record-action-menu__separator" role="separator" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={`admin-record-action-menu__item${item.destructive ? ' is-danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  onSelect(item.id);
                }}
              >
                <span className="admin-record-action-menu__item-title">{item.title}</span>
                <span className="admin-record-action-menu__item-description">
                  {item.description}
                </span>
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
