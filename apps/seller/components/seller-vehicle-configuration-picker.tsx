'use client';

import { useEffect, useState } from 'react';
import Select, { type MultiValue } from 'react-select';
import { getJson } from '@/lib/client-api';
import type { VehicleMakeRecord, VehicleModelRecord } from '@/lib/seller-contracts';
import { ReactSelect } from './common/react-select';

type VehicleOption = { value: string; label: string };

/** Searchable selection by Make and Model; selections are retained when switching Models. */
export function SellerVehicleConfigurationPicker({
  value, onChange, required = false, disabled = false,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [makes, setMakes] = useState<VehicleMakeRecord[]>([]);
  const [models, setModels] = useState<VehicleModelRecord[]>([]);
  const [configurations, setConfigurations] = useState<VehicleOption[]>([]);
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [savedOptions, setSavedOptions] = useState<Record<string, VehicleOption>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getJson<VehicleMakeRecord[]>('/api/seller/reference/vehicles/makes')
      .then(items => { if (active) setMakes(items); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load vehicle makes.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!makeId) { setModels([]); return; }
    let active = true;
    setLoading(true);
    getJson<VehicleModelRecord[]>(`/api/seller/reference/vehicles/models?makeId=${encodeURIComponent(makeId)}`)
      .then(items => { if (active) setModels(items); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load models.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [makeId]);

  useEffect(() => {
    if (!modelId) { setConfigurations([]); return; }
    let active = true;
    setLoading(true);
    getJson<VehicleOption[]>(`/api/seller/entry/vehicle-configurations?modelId=${encodeURIComponent(modelId)}`)
      .then(items => {
        if (!active) return;
        setConfigurations(items);
        setSavedOptions(previous => ({
          ...previous,
          ...Object.fromEntries(items.map(item => [item.value, item])),
        }));
      }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load configurations.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [modelId]);

  const chosen = value.map(id => savedOptions[id] ?? { value: id, label: id });
  const visible = [
    ...configurations,
    ...chosen.filter(item => !configurations.some(option => option.value === item.value)),
  ];

  function selectValues(next: MultiValue<VehicleOption>) {
    const ids = next.map(item => item.value);
    onChange([...new Set(ids)]);
  }

  return (
    <section aria-label="Exact configured-vehicle selection" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="font-semibold text-slate-900">Vehicle configurations{required ? ' *' : ''}</h3>
        <p className="text-xs text-slate-600">Choose only existing active vehicle configurations. Make and Model filter the list; only configuration IDs are saved for fitment. New Article fitments require Admin verification.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ReactSelect label="Vehicle Make" value={makeId}
          options={makes.map(item => ({ value: item.id, label: item.name }))}
          isDisabled={disabled} onChange={option => { setMakeId(String(option?.value ?? '')); setModelId(''); setConfigurations([]); }}/>
        <ReactSelect label="Vehicle Model" value={modelId}
          options={models.map(item => ({ value: item.id, label: item.name }))}
          isDisabled={disabled || !makeId || loading}
          onChange={option => { setModelId(String(option?.value ?? '')); setConfigurations([]); }}/>
      </div>
      <div>
        <label htmlFor="seller-entry-configurations" className="mb-1.5 block text-sm font-medium text-slate-800">
          Search and select configurations{required ? ' (required)' : ''}
        </label>
        <Select<VehicleOption, true>
          inputId="seller-entry-configurations" isMulti isSearchable isClearable
          options={visible} value={chosen} onChange={selectValues}
          isDisabled={disabled || loading || !modelId} isLoading={loading}
          placeholder={modelId ? 'Search make, model, generation, engine, gearbox…' : 'Select Make and Model first'}
          noOptionsMessage={() => modelId ? 'No active configured vehicles for this model.' : 'Select Make and Model first.'}
          formatOptionLabel={(option, { context }) => context === 'menu'
            ? <span className="block whitespace-normal break-words text-sm leading-5">{option.label}</span>
            : <span title={option.label} className="block max-w-52 truncate">{option.label}</span>}
          aria-invalid={required && value.length === 0}
          aria-describedby="seller-entry-fitment-help"
        />
        <p id="seller-entry-fitment-help" className="mt-1 text-xs text-slate-600">{value.length} selected. Select another model to add configurations from it.</p>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected configurations">
          {chosen.map(item => (
            <li key={item.value} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs">
              <span className="min-w-0 break-words">{item.label}</span>
              <button type="button" disabled={disabled} className="font-semibold text-[#a71920] underline focus-visible:outline-2"
                aria-label={`Remove ${item.label}`} onClick={() => onChange(value.filter(id => id !== item.value))}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
    </section>
  );
}
