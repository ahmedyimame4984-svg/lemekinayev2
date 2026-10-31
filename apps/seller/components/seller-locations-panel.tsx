'use client';

import { type FormEvent, useState } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';
import type { SellerInventoryLocation, SellerProductRow } from '@/lib/seller-stock-contracts';
import { ReactSelect } from './common/react-select';
import { SellerRecordsTable } from './seller-records-table';

const buttonClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-[#a71920] disabled:opacity-50';
const primaryClass = 'rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-[#a71920] disabled:opacity-50';
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#a71920]';

export function SellerLocationsPanel({
  locations, products, busy, onUpdate, onAddProduct, onCreated,
}: {
  locations: SellerInventoryLocation[];
  products: SellerProductRow[];
  busy: boolean;
  onUpdate: (location: SellerInventoryLocation, changes: {
    isDefault?: boolean; onlineFulfillmentEnabled?: boolean;
  }) => void;
  onAddProduct: (locationId: string) => void;
  onCreated: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState('BRANCH');
  const [locationAddress, setLocationAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await postJson('/api/seller/locations', {
        code: `LOC-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
        name: locationName.trim(),
        type: locationType,
        addressText: locationAddress.trim() || undefined,
        onlineFulfillmentEnabled: false,
      });
      await onCreated();
      setLocationName('');
      setLocationAddress('');
      setShowAdd(false);
    } catch (error) {
      setError(error instanceof ClientApiError ? error.message : 'The Location could not be created.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Locations ({locations.length})</h2>
        <button type="button" onClick={() => setShowAdd(value => !value)}
          aria-expanded={showAdd} className={primaryClass}>
          {showAdd ? 'Close Location form' : 'Add Location'}
        </button>
      </div>
      <SellerRecordsTable
        label="Locations"
        rows={locations}
        rowKey={location => location.id}
        searchText={location => [location.name, location.code, location.type, location.addressText].join(' ')}
        emptyMessage="No Locations yet. Add a Store or Warehouse to manage stock."
        columns={[
          { key: 'name', title: 'Location', render: location => (
            <div><strong className="block">{location.name}</strong>
            <span className="text-xs text-slate-500">{location.code} {location.isDefault ? '· Default' : ''}</span></div>
          ) },
          { key: 'type', title: 'Type', render: location => location.type },
          { key: 'address', title: 'Address', render: location => location.addressText || 'Not provided' },
          { key: 'products', title: 'SKUs', numeric: true, render: location =>
            products.filter(product => product.inventories.some(row => row.locationId === location.id)).length },
          { key: 'fulfillment', title: 'Online fulfillment', render: location => (
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={location.onlineFulfillmentEnabled} disabled={busy}
                onChange={event => onUpdate(location, { onlineFulfillmentEnabled: event.target.checked })}
                className="h-4 w-4 accent-[#a71920]"/>
              {location.onlineFulfillmentEnabled ? 'Enabled' : 'Disabled'}
            </label>
          ) },
          { key: 'actions', title: 'Actions', render: location => (
            <div className="flex flex-wrap gap-2">
              {!location.isDefault ? <button type="button" disabled={busy}
                onClick={() => onUpdate(location, { isDefault: true })}
                className={buttonClass}>Set default</button> : null}
              <button type="button" className={buttonClass} onClick={() => onAddProduct(location.id)}>Add Inventory</button>
            </div>
          ) },
        ]}
      />
      {showAdd ? (
      <form onSubmit={createLocation} className="max-w-xl space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Add Store or Warehouse</h3>
        {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
        <label className="block text-sm font-medium">Location name
          <input required minLength={2} maxLength={140} value={locationName}
            onChange={event => setLocationName(event.target.value)} className={inputClass}/>
        </label>
        <ReactSelect label="Location type"
          value={locationType}
          options={[{value:'BRANCH',label:'Shop / Branch'},{value:'WAREHOUSE',label:'Warehouse'},{value:'OTHER',label:'Other'}]}
          onChange={option => setLocationType(String(option?.value ?? 'BRANCH'))}
          isClearable={false}/>
        <label className="block text-sm font-medium">Address
          <input maxLength={500} value={locationAddress} onChange={event => setLocationAddress(event.target.value)}
            className={inputClass}/>
        </label>
        <button type="submit" disabled={busy || saving} className={primaryClass}>
          {saving ? 'Creating…' : 'Create Location'}
        </button>
      </form>
      ) : null}
    </section>
  );
}
