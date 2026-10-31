'use client';

import { useEffect, useMemo, useState } from 'react';
import { getJson } from '@/lib/client-api';
import type { BrandRecord, SellerArticleProductType, SellerProductTypeSchema } from '@/lib/seller-contracts';
import { articleRequirements, requiredArticleFieldError } from '@/lib/seller-article-requirements';
import { pendingIdentifierError } from '@/lib/seller-article-identifiers';
import { getPartGroupsForCategory, getProductTypesForPartGroup, type SellerArticleClassification } from '@/lib/seller-article-classification';
import type { InlineSellerArticle } from '@/lib/seller-inline-article';
import type { SellerOfferRequirements } from '@/lib/seller-inventory-listing';
import { ReactSelect } from './common/react-select';
import { isArticleMediaAttribute } from '@/lib/seller-article-form';
import { SchemaField, groupSellerAttributes, hasSchemaValue, isAttributeRequired } from './seller-article-schema-fields';
import { SellerArticleNumberFields } from './seller-article-number-fields';

type Props = {
  value: InlineSellerArticle;
  onChange: (value: InlineSellerArticle) => void;
  onReadyChange: (ready: boolean) => void;
  onFitmentRequiredChange: (required: boolean) => void;
  onFitmentApplicableChange: (applicable: boolean) => void;
  onOfferRequirementsChange?: (value: SellerOfferRequirements | null) => void;
  disabled?: boolean;
};

/** Shared by Inventory First and Listing First. No Article is saved until their Save button is used. */
export function SellerInlineArticleFields({ value, onChange, onReadyChange, onFitmentRequiredChange, onFitmentApplicableChange, onOfferRequirementsChange, disabled = false }: Props) {
  const [classification, setClassification] = useState<SellerArticleClassification | null>(null);
  const [types, setTypes] = useState<SellerArticleProductType[]>([]);
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [partGroupId, setPartGroupId] = useState('');
  const [schema, setSchema] = useState<SellerProductTypeSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      getJson<SellerArticleClassification>('/api/seller/catalog/classification'),
      getJson<SellerArticleProductType[]>('/api/seller/catalog/product-types'),
      getJson<BrandRecord[]>('/api/seller/reference/brands'),
    ]).then(([groups, types, brands]) => {
      if (!active) return;
      setClassification(groups);
      setTypes(types);
      setBrands(brands);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load published Product Types.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!value.productTypeId) { setSchema(null); setSchemaLoading(false); return; }
    let active = true;
    setSchemaLoading(true);
    setSchema(null);
    getJson<SellerProductTypeSchema>(`/api/seller/catalog/product-types/${value.productTypeId}/schema`)
      .then(schema => { if (active) setSchema(schema); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Published schema is unavailable.'); })
      .finally(() => { if (active) setSchemaLoading(false); });
    return () => { active = false; };
  }, [value.productTypeId]);

  const currentType = types.find(type => type.id === value.productTypeId);
  // When used by Edit Listing, the existing Product Type is preselected and
  // must stay visible through the Category → Part Group cascading controls.
  useEffect(() => {
    if (!currentType) return;
    setCategoryId(currentType.categoryId);
    setPartGroupId(currentType.productFamilyId);
  }, [currentType?.id, currentType?.categoryId, currentType?.productFamilyId]);

  useEffect(() => {
    onOfferRequirementsChange?.(currentType ? {
      price: currentType.priceRequirement,
      stock: currentType.stockRequirement,
      condition: currentType.conditionRequirement,
      warranty: currentType.warrantyRequirement,
    } : null);
  }, [
    currentType?.id, currentType?.priceRequirement,
    currentType?.stockRequirement, currentType?.conditionRequirement,
    currentType?.warrantyRequirement, onOfferRequirementsChange,
  ]);

  const requirements = currentType && schema?.productTypeId === currentType.id
    ? articleRequirements(schema, currentType) : null;
  const attributes = useMemo(() =>
    [...(schema?.snapshot.attributes ?? [])]
      .filter(field => Boolean(field.code) && field.requirement !== 'NOT_APPLICABLE' &&
        field.displayMode !== 'HIDDEN' && field.displayMode !== 'READ_ONLY' &&
        field.sellerEditable !== false && field.marketplaceVisible !== false &&
        !isArticleMediaAttribute(field))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [schema],
  );
  const groups = useMemo(() => groupSellerAttributes(attributes), [attributes]);
  const missing = attributes.filter(attribute =>
    isAttributeRequired(attribute, value.values) && !hasSchemaValue(value.values[attribute.code ?? '']),
  );
  const blocked = (schema?.snapshot.attributes ?? []).filter(attribute =>
    attribute.requirement === 'REQUIRED' &&
    (attribute.displayMode === 'HIDDEN' || attribute.displayMode === 'READ_ONLY' ||
      attribute.sellerEditable === false) && !isArticleMediaAttribute(attribute),
  );
  const identityError = requirements
    ? requiredArticleFieldError(requirements, value.brandId, value.manufacturerPartNumber, value.identifiers)
    : 'Select a published Product Type.';
  const numbersError = requirements
    ? pendingIdentifierError(value.identifiers, requirements, requirements.gtinRequirement !== 'NOT_APPLICABLE')
    : null;
  const ready = Boolean(schema && !schemaLoading && requirements &&
    !identityError && !numbersError && missing.length === 0 && blocked.length === 0);
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);
  const fitmentRequired = requirements?.fitmentRequirement === 'REQUIRED';
  useEffect(() => { onFitmentRequiredChange(fitmentRequired); }, [fitmentRequired, onFitmentRequiredChange]);
  const fitmentApplicable = Boolean(requirements && requirements.fitmentRequirement !== 'NOT_APPLICABLE');
  useEffect(() => { onFitmentApplicableChange(fitmentApplicable); }, [fitmentApplicable, onFitmentApplicableChange]);

  function selectType(id: string) {
    onChange({
      productTypeId: id, brandId: '', manufacturerPartNumber: '',
      duplicateReviewReason: '', values: {},
      identifiers: { gtinType: 'GTIN_13', gtin: '', oeReference: '', crossReference: '', issuerBrandId: '' },
    });
  }

  return (
    <section aria-label="New spare-part details" className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <ReactSelect label="Category" value={categoryId}
          options={(classification?.categories ?? []).map(item => ({ value: item.id, label: item.name }))}
          isDisabled={disabled || loading} isClearable={false}
          onChange={option => { setCategoryId(String(option?.value ?? '')); setPartGroupId(''); selectType(''); }}/>
        <ReactSelect label="Part Group" value={partGroupId}
          options={getPartGroupsForCategory(classification?.partGroups ?? [], categoryId)
            .map(item => ({ value: item.id, label: item.name }))}
          isDisabled={disabled || !categoryId} isClearable={false}
          onChange={option => { setPartGroupId(String(option?.value ?? '')); selectType(''); }}/>
        <ReactSelect label="Product Type" value={value.productTypeId}
          options={getProductTypesForPartGroup(types, categoryId, partGroupId)
            .map(item => ({ value: item.id, label: item.name }))}
          isDisabled={disabled || !partGroupId} isClearable={false}
          onChange={option => selectType(String(option?.value ?? ''))}/>
      </div>
      {loading || schemaLoading ? <p role="status" className="text-sm text-slate-600">Loading catalog requirements…</p> : null}
      {partGroupId && !loading && getProductTypesForPartGroup(types, categoryId, partGroupId).length === 0
        ? <p role="status" className="text-sm text-amber-800">No published Product Types are available in this Part Group.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      {requirements ? (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Product Type requirements</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {requirements.brandRequirement !== 'NOT_APPLICABLE' ? (
                <ReactSelect label={`Brand${requirements.brandRequirement === 'REQUIRED' ? ' *' : ''}`}
                  value={value.brandId}
                  options={brands.map(brand => ({ value: brand.id, label: brand.name }))}
                  isDisabled={disabled}
                  onChange={option => onChange({ ...value, brandId: String(option?.value ?? '') })}/>
              ) : null}
              {requirements.identifierRequirement !== 'NOT_APPLICABLE' ? (
                <label className="text-sm font-medium text-slate-800">
                  Manufacturer Part Number{requirements.identifierRequirement === 'MANUFACTURER_PART_NUMBER' ? ' *' : ''}
                  <input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                    maxLength={160} disabled={disabled} value={value.manufacturerPartNumber}
                    onChange={event => onChange({ ...value, manufacturerPartNumber: event.target.value })}/>
                </label>
              ) : null}
            </div>
            {(requirements.gtinRequirement !== 'NOT_APPLICABLE' ||
              requirements.oeReferenceRequirement !== 'NOT_APPLICABLE' ||
              requirements.crossReferenceRequirement !== 'NOT_APPLICABLE') ? (
              <SellerArticleNumberFields productType={{ ...currentType!, ...requirements }}
                brands={brands} value={value.identifiers}
                gtinAllowed={requirements.gtinRequirement !== 'NOT_APPLICABLE'}
                gtinRequired={requirements.gtinRequirement === 'REQUIRED'}
                disabled={disabled}
                onChange={identifiers => onChange({ ...value, identifiers })}/>
            ) : null}
          </div>
          {!value.manufacturerPartNumber.trim() && !value.identifiers.gtin.trim() ? (
            <label className="block text-sm font-medium text-slate-800">
              Duplicate review reason (only if an existing technical match is a distinct part)
              <textarea className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                value={value.duplicateReviewReason} minLength={20} maxLength={500}
                placeholder="Describe the specific physical difference if the catalog reports a probable duplicate"
                disabled={disabled}
                onChange={event => onChange({ ...value, duplicateReviewReason: event.target.value })}/>
            </label>
          ) : null}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Published technical attributes</h3>
            {groups.length === 0 ? <p className="text-sm text-slate-600">No additional editable attributes.</p> : (
              groups.map(group => (
                <fieldset key={group.name} className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold">{group.name}</legend>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.attributes.map(attribute => (
                      <SchemaField key={attribute.code} attribute={attribute}
                        value={value.values[attribute.code ?? '']} allValues={value.values}
                        onChange={next => onChange({ ...value, values: { ...value.values, [attribute.code ?? '']: next } })}/>
                    ))}
                  </div>
                </fieldset>
              ))
            )}
          </div>
          {!ready ? <p role="status" className="text-sm text-amber-800">
            {identityError || numbersError || (missing.length ? `Complete ${missing.length} required attribute(s).` :
              blocked.length ? 'Admin must correct required non-editable attributes.' : '')}
          </p> : null}
          <p className="text-xs text-slate-600">Lemekinaye matches or verifies the product details automatically when you save. You do not need to create a separate catalog record.</p>
        </>
      ) : null}
    </section>
  );
}
