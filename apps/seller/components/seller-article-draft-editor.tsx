'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SellerSchemaAttribute } from '@/lib/seller-contracts';
import { isArticleMediaAttribute } from '@/lib/seller-article-form';
import { getJson, patchJson } from '@/lib/client-api';
import {
  SchemaField,
  groupSellerAttributes,
  isAttributeRequired,
  hasSchemaValue,
} from './seller-article-schema-fields';

interface DraftArticleDetails {
  article: {
    id: string;
    name: string;
    productTypeId: string;
    version: number;
    shortDescription: string | null;
    description: string | null;
    manufacturerNotes: string | null;
    values: Record<string, unknown>;
  };
  attributes: SellerSchemaAttribute[];
}

export function SellerArticleDraftEditor({
  articleId,
  onSaved,
}: {
  articleId: string;
  onSaved: () => void;
}) {
  const [details, setDetails] = useState<DraftArticleDetails | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetails(null);
    setError('');
    setNotice('');
    void getJson<DraftArticleDetails>(`/api/seller/catalog/articles/${articleId}/draft`)
      .then(result => {
        if (!active) return;
        setDetails(result);
        setValues(result.article.values);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the editable Article Draft.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [articleId]);

  const groups = useMemo(() => groupSellerAttributes(
    (details?.attributes ?? []).filter(attribute => !isArticleMediaAttribute(attribute) && attribute.requirement !== 'NOT_APPLICABLE'),
  ), [details]);
  const missingRequired = useMemo(() => (details?.attributes ?? []).filter(attribute =>
    !isArticleMediaAttribute(attribute) && attribute.requirement !== 'NOT_APPLICABLE' &&
    isAttributeRequired(attribute, values) && !hasSchemaValue(values[attribute.code ?? '']),
  ), [details, values]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details || saving) return;
    if (missingRequired.length > 0) {
      setError('Complete the required technical fields before saving the Draft.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await patchJson<DraftArticleDetails>(
        `/api/seller/catalog/articles/${articleId}/draft`,
        { version: details.article.version, values },
      );
      setDetails(result);
      setValues(result.article.values);
      setNotice('Technical Draft changes saved. Review readiness must be checked again before submission.');
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your Draft. Reload if it has changed elsewhere.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-slate-600">Loading Draft technical attributes…</p>;
  if (!details) return <p role="alert" className="text-sm text-red-800">{error || 'Editable Draft unavailable.'}</p>;

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="font-semibold text-slate-900">{details.article.name}</span>
        <span className="text-xs text-slate-500">{groups.reduce((total, group) => total + group.attributes.length, 0)} editable fields</span>
      </div>
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p> : null}
      {groups.map(group => (
        <fieldset key={group.name} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <legend className="px-2 text-sm font-semibold text-slate-950">{group.name}</legend>
          <div className="seller-criteria-grid">
            {group.attributes.map(attribute => (
              <SchemaField
                key={attribute.code}
                attribute={attribute}
                value={values[attribute.code ?? '']}
                allValues={values}
                onChange={value => {
                  setNotice('');
                  setValues(current => ({ ...current, [attribute.code!]: value }));
                }}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {groups.length === 0 ? (
        <p className="text-sm text-slate-600">No Seller-editable technical attributes are defined for this Product Type.</p>
      ) : null}
      {missingRequired.length > 0 ? (
        <p role="status" className="text-sm text-amber-800">
          {missingRequired.length} required technical field(s) still need values.
        </p>
      ) : null}
      <button type="submit" disabled={saving || missingRequired.length > 0}
        className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
        {saving ? 'Saving…' : 'Save Draft changes'}
      </button>
    </form>
  );
}
