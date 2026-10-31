'use client';

import { useId } from 'react';
import type { BrandRecord, SellerArticleProductType } from '@/lib/seller-contracts';
import { gtinValidationError, type PendingArticleIdentifiers } from '@/lib/seller-article-identifiers';
import { ReactSelect } from './common/react-select';

interface Props {
  value: PendingArticleIdentifiers;
  onChange: (value: PendingArticleIdentifiers) => void;
  productType: SellerArticleProductType | null;
  brands: BrandRecord[];
  gtinAllowed: boolean;
  gtinRequired?: boolean;
  disabled?: boolean;
}

export function SellerArticleNumberFields({
  value, onChange, productType, brands, gtinAllowed, gtinRequired = false, disabled = false,
}: Props) {
  const allowOE = Boolean(productType && productType.oeReferenceRequirement !== 'NOT_APPLICABLE');
  const allowCross = Boolean(productType && productType.crossReferenceRequirement !== 'NOT_APPLICABLE');
  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]';
  const gtinErrorId = useId();
  const gtinError = gtinAllowed && value.gtin.trim()
    ? gtinValidationError(value.gtin, value.gtinType)
    : gtinAllowed && gtinRequired ? 'Enter a GTIN for this Product Type.' : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {gtinAllowed ? (
          <ReactSelect label="GTIN type" isClearable={false} isDisabled={disabled}
            options={[
              { value: 'GTIN_8', label: 'GTIN-8' },
              { value: 'GTIN_12', label: 'GTIN-12' },
              { value: 'GTIN_13', label: 'GTIN-13' },
              { value: 'GTIN_14', label: 'GTIN-14' },
            ]} value={value.gtinType}
            onChange={option => {
              if (option) onChange({ ...value, gtinType: option.value as PendingArticleIdentifiers['gtinType'] });
            }}/>
        ) : null}
        {gtinAllowed ? (
          <label className="text-sm font-medium text-slate-800">GTIN number{gtinRequired ? ' *' : ' (optional)'}
            <input type="text" inputMode="numeric" autoComplete="off" disabled={disabled}
              required={gtinRequired} aria-invalid={Boolean(gtinError)}
              aria-describedby={gtinError ? gtinErrorId : undefined}
              value={value.gtin} className={inputClass} placeholder="Barcode number"
              onChange={event => onChange({ ...value, gtin: event.target.value })}/>
            {gtinError ? <span id={gtinErrorId} role="alert" className="mt-1 block text-xs text-red-800">
              {gtinError}
            </span> : null}
          </label>
        ) : null}
        {allowOE ? (
          <label className="text-sm font-medium text-slate-800">OE reference{productType?.oeReferenceRequirement === 'REQUIRED' ? ' *' : ' (optional)'}
            <input disabled={disabled} value={value.oeReference} className={inputClass}
              placeholder="OE part number"
              onChange={event => onChange({ ...value, oeReference: event.target.value })}/>
          </label>
        ) : null}
        {allowCross ? (
          <label className="text-sm font-medium text-slate-800">Cross reference{productType?.crossReferenceRequirement === 'REQUIRED' ? ' *' : ' (optional)'}
            <input disabled={disabled} value={value.crossReference} className={inputClass}
              placeholder="Interchange number"
              onChange={event => onChange({ ...value, crossReference: event.target.value })}/>
          </label>
        ) : null}
      </div>
      {allowOE || allowCross ? (
        <div className="max-w-sm">
          <ReactSelect label={value.oeReference.trim() ? 'OE issuing Brand *' : 'Reference issuer (optional)'} isDisabled={disabled}
            options={brands.map(brand => ({ value: brand.id, label: brand.name }))}
            placeholder="Choose issuer" value={value.issuerBrandId}
            onChange={option => onChange({ ...value, issuerBrandId: String(option?.value ?? '') })}/>
        </div>
      ) : null}
    </div>
  );
}
