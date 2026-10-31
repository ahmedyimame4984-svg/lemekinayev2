'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';
import type { SellerInventoryLocation, SellerProductRow } from '@/lib/seller-stock-contracts';
import { ReactSelect } from './common/react-select';

interface Transfer {
  id: string;
  sellerProductId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  receivedQuantity: number;
  version: number;
  status: 'IN_TRANSIT' | 'COMPLETED';
}

const inputStyle = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#a71920]';
const buttonStyle = 'rounded-lg bg-[#a71920] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function SellerStockTransferPanel({
  product, locations, onDone, onClose,
}: {
  product: SellerProductRow;
  locations: SellerInventoryLocation[];
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState(product.inventories.find(item => item.quantityAvailable > 0)?.locationId ?? '');
  const [destinationId, setDestinationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [receiptKeys, setReceiptKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/seller/products/${product.id}/transfers`, {
      credentials: 'same-origin', cache: 'no-store',
    });
    if (!response.ok) throw new Error('Could not load stock transfers.');
    setTransfers(await response.json() as Transfer[]);
  }, [product.id]);

  useEffect(() => { void refresh().catch(error => setError(String(error))); }, [refresh]);

  async function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sourceId === destinationId) { setError('Select different source and destination Locations.'); return; }
    setBusy(true);
    setError('');
    try {
      await postJson(`/api/seller/products/${product.id}/transfers`, {
        sourceLocationId: sourceId,
        destinationLocationId: destinationId,
        quantity: Number(quantity),
        reason,
        idempotencyKey,
      });
      await refresh();
      await onDone();
      setIdempotencyKey(crypto.randomUUID());
      setQuantity('');
      setReason('');
      setNotice('Transfer dispatched. Stock is now in transit, not available for orders.');
    } catch (error) {
      setError(error instanceof ClientApiError ? error.message : 'Transfer dispatch failed.');
    } finally { setBusy(false); }
  }

  async function receive(transfer: Transfer) {
    setBusy(true);
    setError('');
    const key = receiptKeys[transfer.id] ?? crypto.randomUUID();
    setReceiptKeys(current => ({ ...current, [transfer.id]: key }));
    try {
      await postJson(`/api/seller/products/${product.id}/transfers/${transfer.id}/receive`, {
        version: transfer.version,
        quantity: Number(receiptQuantities[transfer.id] ?? 0),
        idempotencyKey: key,
      });
      await refresh();
      await onDone();
      setReceiptKeys(current => {
        const next = { ...current }; delete next[transfer.id]; return next;
      });
      setNotice('Receipt recorded. Destination stock is now updated.');
    } catch (error) {
      setError(error instanceof ClientApiError ? error.message : 'Transfer receipt failed.');
    } finally { setBusy(false); }
  }

  const options = locations.map(item => ({
    label: `${item.name}${item.isDefault ? ' (Default)' : ''}`,
    value: item.id,
  }));

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Transfer stock · {product.sku}</h2>
          <p className="text-xs text-slate-600">Dispatch removes stock from the source; receipt adds it to the destination.</p>
        </div>
        <button type="button" onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Close</button>
      </div>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      <form onSubmit={dispatch} className="grid gap-3 md:grid-cols-2">
        <ReactSelect label="Source Location" value={sourceId} options={options}
          onChange={option => setSourceId(String(option?.value ?? ''))} isClearable={false}/>
        <ReactSelect label="Destination Location" value={destinationId} options={options}
          onChange={option => setDestinationId(String(option?.value ?? ''))} isClearable={false}/>
        <label className="space-y-1 text-sm font-medium">Quantity to dispatch
          <input className={inputStyle} type="number" required min={1} step={1}
            value={quantity} onChange={event => setQuantity(event.target.value)}/>
        </label>
        <label className="space-y-1 text-sm font-medium">Transfer reason
          <input className={inputStyle} required minLength={3} maxLength={500}
            value={reason} onChange={event => setReason(event.target.value)}/>
        </label>
        <div className="md:col-span-2">
          <button type="submit" className={buttonStyle} disabled={busy || !sourceId || !destinationId || sourceId === destinationId}>
            {busy ? 'Processing…' : 'Dispatch transfer'}
          </button>
        </div>
      </form>
      <div className="space-y-2">
        <h3 className="font-semibold">Transfer history</h3>
        {transfers.length === 0 ? <p className="text-sm text-slate-500">No transfers recorded.</p> : null}
        {transfers.map(transfer => (
          <div key={transfer.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <p className="font-medium">
              {locations.find(l => l.id === transfer.sourceLocationId)?.name ?? 'Source'} →{' '}
              {locations.find(l => l.id === transfer.destinationLocationId)?.name ?? 'Destination'}
            </p>
            <p className="mt-1 text-slate-600">
              {transfer.receivedQuantity} of {transfer.quantity} received · {transfer.status.replaceAll('_',' ')}
            </p>
            {transfer.status === 'IN_TRANSIT' ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="block text-xs font-medium">Quantity received now
                  <input className={inputStyle} type="number" min={1}
                    max={transfer.quantity - transfer.receivedQuantity} step={1}
                    value={receiptQuantities[transfer.id] ?? ''}
                    onChange={event => setReceiptQuantities(current => ({ ...current, [transfer.id]: event.target.value }))}/>
                </label>
                <button type="button" className={buttonStyle}
                  disabled={busy || !(Number(receiptQuantities[transfer.id]) >= 1) ||
                    Number(receiptQuantities[transfer.id]) > transfer.quantity - transfer.receivedQuantity}
                  onClick={() => void receive(transfer)}>Record receipt</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
