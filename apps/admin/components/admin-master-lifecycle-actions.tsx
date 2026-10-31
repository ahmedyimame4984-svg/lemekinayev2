'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  DeleteMasterDataRecordResponse,
  MasterDataLifecycleEntityType,
  MasterDataLifecycleState,
  MasterDataRemovalPreflight,
  MasterDataStatus,
} from '@/lib/catalog-contracts';
import { ClientApiError } from '@/lib/client-api';
import { useAdminOverlayKeyboard } from '@/lib/use-admin-overlay-keyboard';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminRecordActionMenu, type AdminRecordActionItem } from './admin-record-action-menu';

type LifecycleDomain = 'CATALOG' | 'VEHICLE' | 'SOURCING';
type LifecycleAction = 'RETIRE' | 'ARCHIVE' | 'RESTORE' | 'REACTIVATE' | 'DELETE';
type LifecycleMenuAction = LifecycleAction | 'PUBLISH';

export function AdminMasterLifecycleActions({
  domain,
  entityType,
  entityId,
  entityName,
  status,
  version,
  disabled = false,
  reactivatePath,
  onPublishRequested,
  onCompleted,
}: {
  domain: LifecycleDomain;
  entityType: MasterDataLifecycleEntityType;
  entityId: string;
  entityName: string;
  status: MasterDataStatus;
  version: number;
  disabled?: boolean;
  reactivatePath?: string;
  onPublishRequested?: () => void;
  onCompleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const wasDialogOpenRef = useRef(false);
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [reason, setReason] = useState('');
  const [preflight, setPreflight] =
    useState<MasterDataRemovalPreflight | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogKeyboard = useAdminOverlayKeyboard<HTMLElement>({
    open,
    closeDisabled: saving,
    onClose: closePanel,
  });

  useEffect(() => {
    if (wasDialogOpenRef.current && !open && menuTriggerRef.current?.isConnected) {
      menuTriggerRef.current.focus();
    }
    wasDialogOpenRef.current = open;
  }, [open]);

  if (disabled) return null;

  const apiDomain =
    domain === 'CATALOG'
      ? 'catalog'
      : domain === 'VEHICLE'
        ? 'vehicles'
        : 'sourcing';
  const basePath = `/api/admin/${apiDomain}/lifecycle/${entityType}/${entityId}`;

  async function loadDeletePreflight() {
    try {
      setPreflightLoading(true);
      setError('');
      const response = await fetch(`${basePath}/removal-preflight`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as
        | MasterDataRemovalPreflight
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(
          payload && 'error' in payload
            ? payload.error?.message ?? 'Deletion check could not be loaded.'
            : 'Deletion check could not be loaded.',
        );
      }

      setPreflight(payload as MasterDataRemovalPreflight);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Deletion check could not be loaded.',
      );
      setPreflight(null);
    } finally {
      setPreflightLoading(false);
    }
  }

  function openPanel(nextAction: LifecycleAction) {
    setOpen(true);
    setAction(nextAction);
    setReason('');
    setError('');
    setPreflight(null);
    if (nextAction === 'DELETE') void loadDeletePreflight();
  }

  function closePanel() {
    if (saving) return;
    setOpen(false);
    setAction(null);
    setReason('');
    setError('');
    setPreflight(null);
  }

  async function submitAction() {
    if (!action) return;
    if (action === 'DELETE' && reason.trim().length < 5) return;

    try {
      setSaving(true);
      setError('');

      if (action === 'DELETE') {
        const result = await requestJson<DeleteMasterDataRecordResponse>(
          `${basePath}/permanent-delete`,
          'POST',
          { version, reason: reason.trim() },
        );
        if (!result.deleted) {
          throw new Error('The record was not deleted.');
        }
      } else if (action === 'RESTORE') {
        await requestJson<MasterDataLifecycleState>(
          `${basePath}/restore`,
          'POST',
          { version },
        );
      } else if (action === 'REACTIVATE') {
        if (!reactivatePath) {
          throw new Error('Reactivation is not available for this record.');
        }
        await requestJson<unknown>(reactivatePath, 'PATCH', {
          version,
          status: 'ACTIVE',
        });
      } else {
        await requestJson<MasterDataLifecycleState>(basePath, 'PATCH', {
          version,
          targetStatus: action === 'RETIRE' ? 'DEPRECATED' : 'ARCHIVED',
        });
      }

      setOpen(false);
      setAction(null);
      setReason('');
      setError('');
      setPreflight(null);
      onCompleted();
    } catch (nextError) {
      setError(
        nextError instanceof ClientApiError || nextError instanceof Error
          ? nextError.message
          : 'The lifecycle action could not be completed.',
      );
    } finally {
      setSaving(false);
    }
  }

  const isDelete = action === 'DELETE';
  const canSubmit =
    !saving &&
    Boolean(action) &&
    (!isDelete ||
      (reason.trim().length >= 5 && Boolean(preflight?.canPermanentlyDelete)));

  const menuItems: AdminRecordActionItem<LifecycleMenuAction>[] = [
    ...(entityType === 'PRODUCT_TYPE' && status === 'DRAFT' && onPublishRequested
      ? [{
          id: 'PUBLISH' as const,
          title: 'Publish & activate…',
          description: 'Open readiness checks and publish the Product Type with its Attributes.',
        }]
      : []),
    ...(status !== 'ARCHIVED'
      ? [{
          id: 'ARCHIVE' as const,
          title: 'Archive',
          description: 'Hide from active use. Keep references and history.',
        }]
      : []),
    ...(status === 'ACTIVE'
      ? [{
          id: 'RETIRE' as const,
          title: 'Retire',
          description: 'Mark as deprecated without losing history.',
        }]
      : []),
    ...((status === 'DEPRECATED' || status === 'INACTIVE') && reactivatePath
      ? [{
          id: 'REACTIVATE' as const,
          title: 'Reactivate',
          description: 'Revalidate before returning to Active.',
        }]
      : []),
    ...(status === 'ARCHIVED'
      ? [{
          id: 'RESTORE' as const,
          title: 'Restore',
          description: 'Return to a governed non-active state.',
        }]
      : []),
    {
      id: 'DELETE',
      title: 'Delete permanently',
      description: status === 'DRAFT'
        ? 'Check dependencies before irreversible deletion.'
        : 'Only unused Draft records can be permanently deleted.',
      destructive: true,
      disabled: status !== 'DRAFT',
    },
  ];

  return (
    <>
      <AdminRecordActionMenu
        entityName={entityName}
        items={menuItems}
        onSelect={(selectedAction) => {
          if (selectedAction === 'PUBLISH') {
            onPublishRequested?.();
            return;
          }
          openPanel(selectedAction);
        }}
        triggerRef={menuTriggerRef}
      />

      {open ? (
        <div className="admin-confirm-layer" role="presentation">
          <button
            className="admin-confirm-scrim"
            type="button"
            aria-label="Close record actions"
            onClick={() => dialogKeyboard.requestClose()}
          />
          <section
            ref={dialogKeyboard}
            tabIndex={-1}
            className="admin-confirm-card admin-lifecycle-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-lifecycle-panel-title"
          >
            <div className="admin-confirm-card__header">
              <div>
                <span className="eyebrow">Record actions</span>
                <h2 id="admin-lifecycle-panel-title">{entityName}</h2>
                <div className="admin-lifecycle-panel__status">
                  <AdminStatusBadge status={status} label={status} />
                  <span>v{version}</span>
                </div>
              </div>
              <button
                className="admin-confirm-card__close"
                type="button"
                disabled={saving}
                onClick={() => dialogKeyboard.requestClose()}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="admin-confirm-card__body">
              {preflightLoading && isDelete ? (
                <div className="alert" role="status">Checking dependencies before deletion…</div>
              ) : null}
              {action ? (
                <div className="admin-lifecycle-confirm">
                  <div>
                    <span className="eyebrow">
                      {isDelete ? 'Permanent action' : 'Confirm action'}
                    </span>
                    <h3>{titleForAction(action)}</h3>
                    <p>{confirmationForAction(action, entityName)}</p>
                  </div>

                  {action === 'ARCHIVE' ? (
                    <p className="admin-confirm-card__hint">
                      If active dependents still use this record, Lemekinaye
                      will block the archive and explain what must be resolved.
                    </p>
                  ) : null}

                  {isDelete && preflight ? (
                    preflight.canPermanentlyDelete ? (
                      <div className="alert">
                        Dependency check passed. This unused Draft can be
                        permanently deleted.
                      </div>
                    ) : (
                      <div className="alert alert--error">
                        <strong>Permanent delete is blocked.</strong>
                        {preflight.blockers.map((blocker) => (
                          <p key={blocker}>{blocker}</p>
                        ))}
                        {preflight.dependencies.length > 0 ? (
                          <ul>
                            {preflight.dependencies.map((dependency) => (
                              <li key={dependency.key}>
                                {dependency.label}: {dependency.count}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )
                  ) : null}

                  {isDelete ? (
                    <label className="field">
                      <span className="field__label">
                        Reason for permanent deletion
                      </span>
                      <input
                        value={reason}
                        minLength={5}
                        maxLength={500}
                        disabled={saving}
                        placeholder="e.g. Created by mistake"
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                  ) : null}

                  {error ? (
                    <div className="alert alert--error">{error}</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {action ? (
              <div className="admin-confirm-card__actions">
                <button
                  className={
                    isDelete
                      ? 'button button--danger'
                      : 'button button--primary'
                  }
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submitAction()}
                >
                  {saving ? 'Working…' : titleForAction(action)}
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={saving}
                  onClick={() => dialogKeyboard.requestClose()}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function titleForAction(action: LifecycleAction): string {
  switch (action) {
    case 'RETIRE':
      return 'Retire';
    case 'ARCHIVE':
      return 'Archive';
    case 'RESTORE':
      return 'Restore';
    case 'REACTIVATE':
      return 'Reactivate';
    case 'DELETE':
      return 'Delete permanently';
  }
}

function confirmationForAction(
  action: LifecycleAction,
  entityName: string,
): string {
  switch (action) {
    case 'RETIRE':
      return `${entityName} will be marked as deprecated and kept for history.`;
    case 'ARCHIVE':
      return `${entityName} will be removed from normal active use but retained for history and existing references.`;
    case 'RESTORE':
      return `${entityName} will return to a non-active governed state.`;
    case 'REACTIVATE':
      return `${entityName} will be revalidated before returning to Active.`;
    case 'DELETE':
      return `${entityName} will be permanently deleted. This cannot be undone.`;
  }
}

async function requestJson<T>(
  path: string,
  method: 'PATCH' | 'POST',
  body: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
    );
  }

  return (await response.json()) as T;
}
