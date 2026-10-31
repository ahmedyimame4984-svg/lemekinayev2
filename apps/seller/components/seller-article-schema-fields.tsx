'use client';

import type { SellerSchemaAttribute } from '@/lib/seller-contracts';
import { ReactSelect } from './common/react-select';

/** Published Product Type schemas determine field visibility and required values. */
export function groupSellerAttributes(attributes: readonly SellerSchemaAttribute[]) {
  const groups = new Map<string, SellerSchemaAttribute[]>();
  for (const attribute of attributes) {
    const name = attribute.group?.name?.trim() || 'Other specifications';
    const group = groups.get(name) ?? [];
    group.push(attribute);
    groups.set(name, group);
  }
  return [...groups].map(([name, attributes]) => ({ name, attributes }));
}

export function SchemaField({
  attribute,
  value,
  allValues,
  onChange,
}: {
  attribute: SellerSchemaAttribute;
  value: unknown;
  allValues: Record<string, unknown>;
  onChange: (value: unknown) => void;
}) {
  const code = attribute.code ?? '';
  const required = isAttributeRequired(attribute, allValues);
  const options = attribute.controlledValues?.length
    ? attribute.controlledValues
    : attribute.allowedValues ?? [];
  const label = attribute.name || code;
  const editable =
    attribute.sellerEditable !== false && attribute.displayMode !== 'READ_ONLY';
  const validation = attribute.validationRule ?? {};
  const fieldClassName = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]';

  if (!editable) {
    return (
      <div className="seller-schema-readonly">
        <strong>{label}{required ? ' *' : ''}</strong>
        <span>Read-only catalog field</span>
      </div>
    );
  }

  if (attribute.dataType === 'MULTI_SELECT' && options.length > 0) {
    const selected = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
    return (
      <fieldset className="rounded-lg border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">{label}{required ? ' *' : ''}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const optionValue = option.code ?? option.id ?? '';
            return (
              <label key={optionValue} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  className="size-4 accent-[#a71920]"
                  type="checkbox"
                  checked={selected.includes(optionValue)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, optionValue]
                        : selected.filter((item) => item !== optionValue),
                    )
                  }
                />
                <span>{option.label || option.code || option.id}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (attribute.dataType === 'MULTI_SELECT') {
    return (
      <label className="block min-w-0 text-sm font-medium text-slate-800">
        <span>{label}{required ? ' *' : ''}</span>
        <textarea
          className={fieldClassName}
          required={required}
          value={stringList(value)}
          onChange={(event) => onChange(parseStringList(event.target.value))}
          placeholder="Enter one value per line or separate values with commas"
        />
      </label>
    );
  }

  if (attribute.dataType === 'SELECT' && options.length > 0) {
    return (
      <div>
        <ReactSelect
          label={label + (required ? ' *' : '')}
          options={options.map((option) => {
            const optionValue = option.code ?? option.id ?? '';
            return {
              value: optionValue,
              label: String(option.label || option.code || option.id || ''),
            };
          })}
          placeholder="Select"
          required={required}
          value={typeof value === 'string' ? value : ''}
          onChange={(option) => onChange(option?.value ?? '')}
        />
      </div>
    );
  }

  if (attribute.dataType === 'BOOLEAN') {
    return (
      <div>
        <ReactSelect
          label={label + (required ? ' *' : '')}
          options={[
            { value: '', label: 'Select' },
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          placeholder="Select"
          required={required}
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={option =>
            onChange(option?.value === 'true' ? true : option?.value === 'false' ? false : '')
          }
        />
      </div>
    );
  }

  if (
    ['MULTI_REFERENCE', 'MULTI_IMAGE'].includes(attribute.dataType ?? '')
  ) {
    return (
      <label className="block min-w-0 text-sm font-medium text-slate-800">
        <span>{label}{required ? ' *' : ''}</span>
        <textarea
          className={fieldClassName}
          required={required}
          value={stringList(value)}
          onChange={(event) => onChange(parseStringList(event.target.value))}
          placeholder="Enter one value per line or separate values with commas"
        />
      </label>
    );
  }

  if (attribute.dataType === 'LONG_TEXT') {
    return (
      <label className="block min-w-0 text-sm font-medium text-slate-800">
        <span>{label}{required ? ' *' : ''}</span>
        <textarea
          className={fieldClassName}
          required={required}
          minLength={validation.minLength}
          maxLength={validation.maxLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  const numeric = ['INTEGER', 'DECIMAL', 'MONEY', 'MEASUREMENT'].includes(
    attribute.dataType ?? '',
  );
  const inputType =
    attribute.dataType === 'DATE'
      ? 'date'
      : attribute.dataType === 'DATETIME'
        ? 'datetime-local'
        : numeric
          ? 'number'
          : 'text';

  return (
    <label className="block min-w-0 text-sm font-medium text-slate-800">
      <span>{label}{required ? ' *' : ''}</span>
      <input
        className={fieldClassName}
        required={required}
        type={inputType}
        min={numeric ? validation.min : undefined}
        max={numeric ? validation.max : undefined}
        minLength={!numeric ? validation.minLength : undefined}
        maxLength={!numeric ? validation.maxLength : undefined}
        step={attribute.dataType === 'INTEGER' ? '1' : numeric ? 'any' : undefined}
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(event) =>
          onChange(
            numeric && event.target.value !== ''
              ? Number(event.target.value)
              : event.target.value,
          )
        }
      />
      {attribute.unit ? <small>{attribute.unit}</small> : null}
    </label>
  );
}

export function isAttributeRequired(
  attribute: SellerSchemaAttribute,
  values: Record<string, unknown>,
): boolean {
  if (attribute.requirement === 'MANDATORY') return true;
  if (attribute.requirement !== 'CONDITIONAL') return false;
  return conditionalRuleMatches(attribute.conditionalRule, values);
}

function conditionalRuleMatches(
  rule: Record<string, unknown> | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!rule || typeof rule.operator !== 'string') return false;
  const operator = normalizeRuleOperator(rule.operator);

  if (operator === 'AND' || operator === 'OR') {
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      return false;
    }
    const results = rule.conditions.map((condition) =>
      isRecord(condition)
        ? conditionalRuleMatches(condition, values)
        : false,
    );
    return operator === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  if (typeof rule.attributeCode !== 'string') return false;
  const actual = values[rule.attributeCode];
  const expected = rule.value;

  switch (operator) {
    case 'EQUALS':
      return actual === expected;
    case 'NOT_EQUALS':
      return actual !== expected;
    case 'CONTAINS':
      return typeof actual === 'string' && typeof expected === 'string'
        ? actual.includes(expected)
        : Array.isArray(actual)
          ? actual.includes(expected)
          : false;
    case 'DOES_NOT_CONTAIN':
      return !conditionalRuleMatches(
        { ...rule, operator: 'CONTAINS' },
        values,
      );
    case 'GREATER_THAN':
      return typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual > expected;
    case 'GREATER_THAN_OR_EQUAL':
      return typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual >= expected;
    case 'LESS_THAN':
      return typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual < expected;
    case 'LESS_THAN_OR_EQUAL':
      return typeof actual === 'number' &&
        typeof expected === 'number' &&
        actual <= expected;
    case 'IN':
      return Array.isArray(expected) && expected.includes(actual);
    case 'NOT_IN':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'EXISTS':
      return hasSchemaValue(actual);
    case 'DOES_NOT_EXIST':
      return !hasSchemaValue(actual);
    default:
      return false;
  }
}

function normalizeRuleOperator(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function hasSchemaValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function stringList(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\n')
    : '';
}

function parseStringList(value: string): string[] {
  return [...new Set(
    value
      .split(/[\n,]+/u)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

