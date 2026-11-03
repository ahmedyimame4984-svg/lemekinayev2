'use client';
import type { SellerCommercialDetails, SellerCommercialPolicy } from '@/lib/seller-commercial';
import { DEFAULT_SELLER_COMMERCIAL_POLICY, SELLER_TRANSPORTS } from '@/lib/seller-commercial';

const field = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function SellerListingCommercialFields({
  value, onChange, policy = DEFAULT_SELLER_COMMERCIAL_POLICY, disabled = false,
}: {
  value: SellerCommercialDetails;
  onChange: (value: SellerCommercialDetails) => void;
  policy?: SellerCommercialPolicy;
  disabled?: boolean;
}) {
  const measurement = (key: 'packageLengthCm' | 'packageWidthCm' | 'packageHeightCm' | 'packageWeightKg', label: string) => (
    <label key={key} className="block text-sm font-medium text-slate-800">
      {label}
      <input className={field} type="number" min="0.01" step="0.01"
        disabled={disabled} value={value[key] ?? ''}
        onChange={event => {
          const raw = event.target.value;
          onChange({ ...value, [key]: raw === '' ? undefined : Number(raw) });
        }}/>
    </label>
  );
  const requirement = (key: keyof SellerCommercialPolicy) =>
    policy[key] === 'REQUIRED' ? ' *' : '';
  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">Packaging & delivery for one selling unit</legend>
      <p className="text-xs text-slate-600">
        These package measurements and suitable vehicles describe ONE selling unit
        (for example, one sealed box or one set). Larger orders need delivery confirmation.
      </p>
      {policy.packageDimensions !== 'NOT_APPLICABLE' && (
        <div>
          <p className="mb-2 text-sm font-medium">Package dimensions in cm{requirement('packageDimensions')}</p>
          <div className="grid grid-cols-3 gap-2">
            {measurement('packageLengthCm', 'Length')}
            {measurement('packageWidthCm', 'Width')}
            {measurement('packageHeightCm', 'Height')}
          </div>
        </div>
      )}
      {policy.packageWeight !== 'NOT_APPLICABLE' &&
        measurement('packageWeightKg', 'Gross package weight (kg)' + requirement('packageWeight'))}
      {policy.discount !== 'NOT_APPLICABLE' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Discount{requirement('discount')}
            <select className={field} disabled={disabled} value={value.discountType ?? ''}
              onChange={e => onChange({ ...value,
                discountType: e.target.value ? e.target.value as 'PERCENT' | 'FIXED' : undefined,
                discountValue: e.target.value ? value.discountValue : undefined,
              })}>
              <option value="">No discount</option>
              <option value="PERCENT">Percentage (%)</option>
              <option value="FIXED">Fixed amount (ETB)</option>
            </select>
          </label>
          {value.discountType && (
            <label className="block text-sm font-medium">
              {value.discountType === 'PERCENT' ? 'Discount percentage' : 'Discount amount (ETB)'}
              <input className={field} type="number" min="0.01" step="0.01"
                disabled={disabled} value={value.discountValue ?? ''}
                onChange={e => onChange({ ...value,
                  discountValue: e.target.value === '' ? undefined : Number(e.target.value),
                })}/>
            </label>
          )}
        </div>
      )}
      {policy.transport !== 'NOT_APPLICABLE' && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Suitable transport for ONE selling unit{requirement('transport')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SELLER_TRANSPORTS.map(method => (
              <label key={method.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={disabled}
                  checked={Boolean(value.transportMethods?.includes(method.id))}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...(value.transportMethods ?? []), method.id]
                      : (value.transportMethods ?? []).filter(m => m !== method.id);
                    onChange({ ...value, transportMethods: next });
                  }}/>
                {method.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            Selections are seller estimates, not a confirmed delivery service or price.
          </p>
        </div>
      )}
      {policy.specialHandling !== 'NOT_APPLICABLE' && (
        <label className="block text-sm font-medium">
          Special handling{requirement('specialHandling')}
          <textarea className={field} maxLength={500} rows={2} disabled={disabled}
            placeholder="Fragile, heavy, hazardous, liquid, battery..."
            value={value.specialHandling ?? ''}
            onChange={e => onChange({ ...value, specialHandling: e.target.value })}/>
        </label>
      )}
    </fieldset>
  );
}
