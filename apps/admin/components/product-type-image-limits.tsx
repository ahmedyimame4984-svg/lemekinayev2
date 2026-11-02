'use client';

import { useEffect, useState } from 'react';
import type { ProductTypeRecord, ProductTypeRequirementLevel } from '@/lib/catalog-contracts';
import { ClientApiError, patchJson } from '@/lib/client-api';

type ImageRules = {
  imageRequirement: ProductTypeRequirementLevel;
  minimumImageCount: number;
  maximumImageCount: number;
};

function rulesOf(productType: ProductTypeRecord): ImageRules {
  return {
    imageRequirement: productType.imageRequirement,
    minimumImageCount: productType.minimumImageCount,
    maximumImageCount: productType.maximumImageCount,
  };
}

/** Edits the Product Type policy; new Articles receive it only after publication. */
export function ProductTypeImageLimits({ productType, onProductTypeChange }: {
  productType: ProductTypeRecord;
  onProductTypeChange: (updated: ProductTypeRecord) => void;
}) {
  const [rules, setRules] = useState<ImageRules>(() => rulesOf(productType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setRules(rulesOf(productType));
    setError('');
  }, [productType.id, productType.version]);

  const min = rules.imageRequirement === 'REQUIRED' ? rules.minimumImageCount : 0;
  const max = rules.imageRequirement === 'NOT_APPLICABLE' ? 0 : rules.maximumImageCount;
  const invalid = min > max || max > 20 ||
    (rules.imageRequirement !== 'NOT_APPLICABLE' && max < 1);
  const unchanged = rules.imageRequirement === productType.imageRequirement &&
    rules.minimumImageCount === productType.minimumImageCount &&
    rules.maximumImageCount === productType.maximumImageCount;

  function choose(level: ProductTypeRequirementLevel) {
    setMessage('');
    setRules(current => ({
      imageRequirement: level,
      minimumImageCount: level === 'REQUIRED' ? Math.max(1, current.minimumImageCount) : 0,
      maximumImageCount: level === 'NOT_APPLICABLE' ? 0 : Math.max(1, current.maximumImageCount),
    }));
  }

  async function save() {
    if (saving || unchanged || invalid) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchJson<ProductTypeRecord>(
        `/api/admin/catalog/product-types/${productType.id}/marketplace-rules`,
        { version: productType.version, ...rules },
      );
      onProductTypeChange(updated);
      setMessage('Image limits saved. Publish a new Product Type schema version before new Articles use them.');
    } catch (cause) {
      setError(cause instanceof ClientApiError ? cause.message : 'Could not save the image policy. Reload and retry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Product Type Seller Listing image policy" className="product-type-requirements">
      <div className="product-type-requirements__group-heading">
        <strong>Seller Listing image requirements</strong>
        <small>Rules apply to Seller Listing photos and are frozen into new Articles when the Product Type is published.</small>
      </div>
      <div className="product-type-requirements__group-grid">
        <fieldset className="field" disabled={saving}>
          <legend className="field__label">Images</legend>
          <div className="flex flex-wrap gap-2">
            {(['REQUIRED', 'OPTIONAL', 'NOT_APPLICABLE'] as const).map(level => (
              <button type="button" key={level} aria-pressed={rules.imageRequirement === level}
                className={rules.imageRequirement === level ? 'button button--primary' : 'button button--quiet'}
                onClick={() => choose(level)}>
                {level === 'NOT_APPLICABLE' ? 'Not applicable' : level === 'REQUIRED' ? 'Required' : 'Optional'}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span className="field__label">Minimum images</span>
          <input className="product-type-requirements__number" type="number" min={1} max={20}
            value={rules.minimumImageCount} disabled={saving || rules.imageRequirement !== 'REQUIRED'}
            onChange={event => {
              const minimum = Math.max(1, Math.min(20, Number(event.target.value) || 1));
              setRules(current => ({ ...current, minimumImageCount: minimum, maximumImageCount: Math.max(current.maximumImageCount, minimum) }));
            }}/>
          <small className="field__hint">Only mandatory when images are Required.</small>
        </label>
        <label className="field">
          <span className="field__label">Maximum images</span>
          <input className="product-type-requirements__number" type="number" min={Math.max(1, min)} max={20}
            value={rules.maximumImageCount} disabled={saving || rules.imageRequirement === 'NOT_APPLICABLE'}
            onChange={event => {
              const maximum = Math.max(Math.max(1, min), Math.min(20, Number(event.target.value) || 1));
              setRules(current => ({ ...current, maximumImageCount: maximum }));
            }}/>
          <small className="field__hint">Maximum verified images allowed on one Seller Listing.</small>
        </label>
      </div>
      {invalid ? <p role="alert">Maximum images must be at least the minimum and no greater than 20.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="button button--primary" disabled={saving || invalid || unchanged}
          onClick={() => void save()}>{saving ? 'Saving…' : 'Save image requirements'}</button>
        <button type="button" className="button button--quiet" disabled={saving || unchanged}
          onClick={() => setRules(rulesOf(productType))}>Discard changes</button>
      </div>
    </section>
  );
}
