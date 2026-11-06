'use client';

import type {
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@/lib/catalog-contracts';

export type ProductTypeRequirementValues = {
  brandRequirement: ProductTypeRequirementLevel;
  identifierRequirement: ProductTypeIdentifierRequirement;
  gtinRequirement: ProductTypeRequirementLevel;
  oemReferenceRequirement: ProductTypeRequirementLevel;
  crossReferenceRequirement: ProductTypeRequirementLevel;
  fitmentRequirement: ProductTypeRequirementLevel;
  imageRequirement: ProductTypeRequirementLevel;
  minimumImageCount: number;
  maximumImageCount: number;
  documentRequirement: ProductTypeRequirementLevel;
  minimumDocumentCount: number;
  priceRequirement: ProductTypeRequirementLevel;
  stockRequirement: ProductTypeRequirementLevel;
  conditionRequirement: ProductTypeRequirementLevel;
  warrantyRequirement: ProductTypeRequirementLevel;
  packageDimensionsRequirement: ProductTypeRequirementLevel;
  packageWeightRequirement: ProductTypeRequirementLevel;
  discountRequirement: ProductTypeRequirementLevel;
  transportRequirement: ProductTypeRequirementLevel;
  specialHandlingRequirement: ProductTypeRequirementLevel;
};

export const DEFAULT_PRODUCT_TYPE_REQUIREMENTS: ProductTypeRequirementValues = {
  brandRequirement: 'OPTIONAL',
  identifierRequirement: 'ANY_PART_NUMBER',
  gtinRequirement: 'OPTIONAL',
  oemReferenceRequirement: 'OPTIONAL',
  crossReferenceRequirement: 'OPTIONAL',
  fitmentRequirement: 'REQUIRED',
  imageRequirement: 'REQUIRED',
  minimumImageCount: 1,
  maximumImageCount: 20,
  documentRequirement: 'OPTIONAL',
  minimumDocumentCount: 0,
  priceRequirement: 'REQUIRED',
  stockRequirement: 'REQUIRED',
  conditionRequirement: 'REQUIRED',
  warrantyRequirement: 'OPTIONAL',
  packageDimensionsRequirement: 'OPTIONAL',
  packageWeightRequirement: 'OPTIONAL',
  discountRequirement: 'OPTIONAL',
  transportRequirement: 'OPTIONAL',
  specialHandlingRequirement: 'OPTIONAL',
};

export function ProductTypeRequirementFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ProductTypeRequirementValues;
  onChange: (value: ProductTypeRequirementValues) => void;
  disabled?: boolean;
}) {
  function setRequirement(
    key:
      | 'brandRequirement'
      | 'gtinRequirement'
      | 'oemReferenceRequirement'
      | 'crossReferenceRequirement'
      | 'fitmentRequirement'
      | 'imageRequirement'
      | 'documentRequirement'
      | 'priceRequirement'
      | 'stockRequirement'
      | 'conditionRequirement'
      | 'warrantyRequirement'
      | 'packageDimensionsRequirement'
      | 'packageWeightRequirement'
      | 'discountRequirement'
      | 'transportRequirement'
      | 'specialHandlingRequirement',
    requirement: ProductTypeRequirementLevel,
  ) {
    onChange({
      ...value,
      [key]: requirement,
      ...(key === 'imageRequirement'
        ? {
            minimumImageCount:
              requirement === 'REQUIRED' ? Math.max(1, value.minimumImageCount) : 0,
            maximumImageCount:
              requirement === 'NOT_APPLICABLE' ? 0 : Math.max(1, value.maximumImageCount),
          }
        : {}),
      ...(key === 'documentRequirement'
        ? {
            minimumDocumentCount:
              requirement === 'NOT_APPLICABLE'
                ? 0
                : requirement === 'REQUIRED'
                  ? Math.max(1, value.minimumDocumentCount)
                  : Math.max(0, value.minimumDocumentCount),
          }
        : {}),
    });
  }

  return (
    <div className="product-type-requirements">
      <section className="product-type-requirements__group">
        <div className="product-type-requirements__group-heading">
          <strong>Article identity & application</strong>
          <small>
            Rules for the canonical manufacturer article and its vehicle applicability.
          </small>
        </div>

        <div className="product-type-requirements__group-grid">
          <RequirementSelect
            label="Brand"
            value={value.brandRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('brandRequirement', next)}
            hint="Reference Brand Master when the article requires a manufacturer identity."
          />

          <label className="field">
            <span className="field__label">Part number / identifier</span>
            <select
              className="category-form__select"
              value={value.identifierRequirement}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...value,
                  identifierRequirement:
                    event.target.value as ProductTypeIdentifierRequirement,
                })
              }
            >
              <option value="MANUFACTURER_PART_NUMBER">
                Manufacturer part number required
              </option>
              <option value="ANY_PART_NUMBER">Any part number required</option>
              <option value="OPTIONAL">Optional</option>
              <option value="NOT_APPLICABLE">Not applicable</option>
            </select>
            <small className="field__hint">
              Stored on the actual article as a structured Part Number.
            </small>
          </label>

          <RequirementSelect
            label="GTIN"
            value={value.gtinRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('gtinRequirement', next)}
            hint="Controls whether a GTIN-8, GTIN-12, GTIN-13 or GTIN-14 must be stored as a structured Article identifier."
          />

          <RequirementSelect
            label="OE references"
            value={value.oemReferenceRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('oemReferenceRequirement', next)}
            hint="Controls whether one or more OE numbers must be linked to the canonical Manufacturer Article."
          />

          <RequirementSelect
            label="Cross references"
            value={value.crossReferenceRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('crossReferenceRequirement', next)}
            hint="Controls whether aftermarket or interchange references must be provided."
          />

          <RequirementSelect
            label="Vehicle fitment"
            value={value.fitmentRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('fitmentRequirement', next)}
            notApplicableLabel="Not applicable / universal"
            hint="Require configured-vehicle fitment only when this Product Type is vehicle-specific."
          />

          <RequirementSelect
            label="Images"
            value={value.imageRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('imageRequirement', next)}
            hint="Controls Seller Listing image requirements. Images belong to the Listing, not the shared Article."
          />

          <label className="field">
            <span className="field__label">Minimum images</span>
            <input
              className="product-type-requirements__number"
              type="number"
              min={value.imageRequirement === 'REQUIRED' ? 1 : 0}
              max={20}
              value={value.minimumImageCount}
              disabled={disabled || value.imageRequirement !== 'REQUIRED'}
              onChange={(event) => {
                const minimum = Math.max(1, Math.min(20, Number(event.target.value) || 0));
                onChange({
                  ...value,
                  minimumImageCount: minimum,
                  maximumImageCount: Math.max(minimum, value.maximumImageCount),
                });
              }}
            />
            <small className="field__hint">
              Minimum verified Seller Listing images when Required. Optional images have no minimum.
            </small>
          </label>

          <label className="field">
            <span className="field__label">Maximum listing images</span>
            <input
              className="product-type-requirements__number"
              type="number"
              min={Math.max(1, value.minimumImageCount)}
              max={20}
              value={value.maximumImageCount}
              disabled={disabled || value.imageRequirement === 'NOT_APPLICABLE'}
              onChange={(event) =>
                onChange({
                  ...value,
                  maximumImageCount: Math.max(
                    Math.max(1, value.minimumImageCount),
                    Math.min(20, Number(event.target.value) || 0),
                  ),
                })
              }
            />
            <small className="field__hint">
              Upper limit for verified photos on each Seller Listing (1–20).
            </small>
          </label>

          <RequirementSelect
            label="Technical documents"
            value={value.documentRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('documentRequirement', next)}
            hint="For datasheets, certificates, installation guides or other article documents."
          />

          <label className="field">
            <span className="field__label">Minimum documents</span>
            <input
              className="product-type-requirements__number"
              type="number"
              min={0}
              max={20}
              value={value.minimumDocumentCount}
              disabled={disabled || value.documentRequirement === 'NOT_APPLICABLE'}
              onChange={(event) =>
                onChange({
                  ...value,
                  minimumDocumentCount: Math.max(
                    value.documentRequirement === 'REQUIRED' ? 1 : 0,
                    Math.min(20, Number(event.target.value) || 0),
                  ),
                })
              }
            />
            <small className="field__hint">
              Required documents are stored as Product Assets, not Attributes.
            </small>
          </label>
        </div>
      </section>

      <section className="product-type-requirements__group">
        <div className="product-type-requirements__group-heading">
          <strong>Seller listing requirements</strong>
          <small>
            Commercial rules for a seller listing after the canonical article exists.
          </small>
        </div>

        <div className="product-type-requirements__group-grid product-type-requirements__group-grid--commerce">
          <RequirementSelect
            label="Price"
            value={value.priceRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('priceRequirement', next)}
            hint="Enforced on the seller Listing Price layer."
          />

          <RequirementSelect
            label="Stock"
            value={value.stockRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('stockRequirement', next)}
            hint="Enforced on seller Inventory, not stored as an Attribute."
          />

          <RequirementSelect
            label="Condition"
            value={value.conditionRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('conditionRequirement', next)}
            hint="Enforced on the seller listing for New, Used or Refurbished products."
          />

          <RequirementSelect
            label="Warranty information"
            value={value.warrantyRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('warrantyRequirement', next)}
            hint="Controls whether the seller listing must state warranty terms or explicitly provide them."
          />
          <RequirementSelect
            label="Package length, width & height"
            value={value.packageDimensionsRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('packageDimensionsRequirement', next)}
            hint="Shipping package dimensions, not technical part dimensions."
          />
          <RequirementSelect
            label="Gross package weight"
            value={value.packageWeightRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('packageWeightRequirement', next)}
            hint="Weight of one packaged selling unit."
          />
          <RequirementSelect
            label="Discount"
            value={value.discountRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('discountRequirement', next)}
            hint="Percentage or fixed ETB reduction."
          />
          <RequirementSelect
            label="Transport methods for one selling unit"
            value={value.transportRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('transportRequirement', next)}
            hint="Seller-declared choices; no automatic guarantee for multiple items."
          />
          <RequirementSelect
            label="Special handling notes"
            value={value.specialHandlingRequirement}
            disabled={disabled}
            onChange={(next) => setRequirement('specialHandlingRequirement', next)}
            hint="Fragile, battery, liquid or other handling instructions."
          />
        </div>
      </section>

      <div className="product-type-requirements__boundary">
        <strong>Ownership boundary</strong>
        <span>
          These are Product Type policies, not actual Article values. Brand, identifiers,
          technical values and fitment belong to the canonical Manufacturer Article;
          Seller Listing images, price, stock, condition and warranty belong to the Seller Offer.
        </span>
      </div>
    </div>
  );
}

function RequirementSelect({
  label,
  value,
  onChange,
  disabled,
  hint,
  notApplicableLabel = 'Not applicable',
}: {
  label: string;
  value: ProductTypeRequirementLevel;
  onChange: (value: ProductTypeRequirementLevel) => void;
  disabled: boolean;
  hint: string;
  notApplicableLabel?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="category-form__select"
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value as ProductTypeRequirementLevel)
        }
      >
        <option value="REQUIRED">Required</option>
        <option value="OPTIONAL">Optional</option>
        <option value="NOT_APPLICABLE">{notApplicableLabel}</option>
      </select>
      <small className="field__hint">{hint}</small>
    </label>
  );
}
