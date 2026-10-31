'use client';

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ArticleValidation,
  BrandRecord,
  SellerArticleProductType,
  SellerArticleReviewSubmissionResult,
  SellerArticleSubmissionResult,
  SellerArticleSubmissionSummary,
  SellerProductTypeSchema,
  VehicleConfigurationRecord,
  VehicleGenerationRecord,
  VehicleMakeRecord,
  VehicleModelRecord,
  VehicleModelDerivativeRecord,
  VehicleTrimRecord,
} from '@/lib/seller-contracts';
import { ClientApiError, postJson } from '@/lib/client-api';
import { ReactSelect } from '@/components/common/react-select';
import { SchemaField, groupSellerAttributes, isAttributeRequired, hasSchemaValue } from './seller-article-schema-fields';
import { useSellerPrincipal } from './seller-session';
import { SellerArticleDraftEditor } from './seller-article-draft-editor';
import { SellerArticleNumberFields } from './seller-article-number-fields';
import { articleRequirements, requiredArticleFieldError } from '@/lib/seller-article-requirements';
import { buildSellerArticleDraftPayload } from '@/lib/seller-article-draft-payload';
import { canSaveArticleDraft, isArticleMediaAttribute } from '@/lib/seller-article-form';
import {
  clearSavedIdentifier, emptyPendingArticleIdentifiers, pendingArticleIdentifierRequests,
  pendingIdentifierError, gtinValidationError, normalizeGtin,
  type PendingArticleIdentifiers,
} from '@/lib/seller-article-identifiers';
import { getPartGroupsForCategory, getProductTypesForPartGroup, type SellerArticleClassification } from '@/lib/seller-article-classification';
import { enqueueExactFitment, MAX_QUEUED_FITMENTS, pendingAfterFailure, type PendingExactFitment } from '@/lib/seller-article-fitment-queue';

const directIdentifierTypes = [
  'GTIN_8',
  'GTIN_12',
  'GTIN_13',
  'GTIN_14',
  'TRADE_NUMBER',
] as const;

export function SellerArticleWorkspace({ onArticlePrepared, embedded = false, initialDraftId }: {
  onArticlePrepared?: (article: {
    id: string;
    name: string;
    brandName: string | null;
    primaryManufacturerPartNumber: string | null;
  }) => void;
  embedded?: boolean;
  initialDraftId?: string;
} = {}) {
  const principal = useSellerPrincipal();
  const [productTypes, setProductTypes] = useState<SellerArticleProductType[]>([]);
  const [classification, setClassification] = useState<SellerArticleClassification | null>(null);
  const [productTypesLoaded, setProductTypesLoaded] = useState(false);
  const [submissions, setSubmissions] = useState<SellerArticleSubmissionSummary[]>([]);
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [partGroupId, setPartGroupId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [schema, setSchema] = useState<SellerProductTypeSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [manufacturerPartNumber, setManufacturerPartNumber] = useState('');
  const [identityChecked, setIdentityChecked] = useState(false);
  const [duplicateReviewReason, setDuplicateReviewReason] = useState('');
  const [duplicateReview, setDuplicateReview] = useState<{
    reviewRequired: boolean;
    candidates: { id: string; name: string; status: 'ACTIVE' | 'DRAFT'; catalogReviewSubmittedAt: string | null }[];
  } | null>(null);

  const [pendingIdentifiers, setPendingIdentifiers] = useState<PendingArticleIdentifiers>(emptyPendingArticleIdentifiers);
  const [savingIdentifiers, setSavingIdentifiers] = useState(false);
  const identifierSaveLock = useRef(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [resolution, setResolution] =
    useState<SellerArticleSubmissionResult | null>(null);
  const [articleId, setArticleId] = useState('');
  const autoResumeId = useRef<string | null>(null);
  const [validation, setValidation] = useState<ArticleValidation | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const listedType = useMemo(
    () => productTypes.find((item) => item.id === productTypeId) ?? null,
    [productTypeId, productTypes],
  );

  const selectedType = useMemo(() => listedType && schema?.productTypeId === listedType.id
    ? { ...listedType, ...articleRequirements(schema, listedType) } : null, [listedType, schema]);

  const categoryOptions = useMemo(
    () => (classification?.categories ?? []).map(item => ({ value: item.id, label: item.name })),
    [classification],
  );
  const partGroupOptions = useMemo(
    () => getPartGroupsForCategory(classification?.partGroups ?? [], categoryId)
      .map(item => ({ value: item.id, label: item.name })),
    [classification, categoryId],
  );

  useEffect(() => {
    if (selectedType) {
      setCategoryId(selectedType.categoryId);
      setPartGroupId(selectedType.productFamilyId);
    }
  }, [selectedType]);

  const filteredProductTypes = useMemo(
    () => getProductTypesForPartGroup(productTypes, categoryId, partGroupId),
    [productTypes, categoryId, partGroupId],
  );

  const schemaAttributes = useMemo(
    () =>
      [...(schema?.snapshot.attributes ?? [])]
        .filter((item) => Boolean(item.code) && item.requirement !== 'NOT_APPLICABLE')
        .sort(
          (a, b) =>
            (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
            (a.group?.name ?? '').localeCompare(b.group?.name ?? '') ||
            (a.name ?? a.code ?? '').localeCompare(b.name ?? b.code ?? ''),
        ),
    [schema],
  );

  const attributes = useMemo(
    () =>
      schemaAttributes.filter(
        (item) =>
          item.displayMode !== 'HIDDEN' &&
          item.displayMode !== 'READ_ONLY' &&
          item.sellerEditable !== false &&
          item.marketplaceVisible !== false &&
          !isArticleMediaAttribute(item),
      ),
    [schemaAttributes],
  );

  const attributeGroups = useMemo(() => groupSellerAttributes(attributes), [attributes]);

  const missingRequiredAttributes = useMemo(
    () => schemaAttributes.filter(attribute =>
      isAttributeRequired(attribute, values) && !hasSchemaValue(values[attribute.code ?? '']) &&
      attribute.displayMode !== 'HIDDEN' && attribute.marketplaceVisible !== false &&
      attribute.displayMode !== 'READ_ONLY' && attribute.sellerEditable !== false &&
      !isArticleMediaAttribute(attribute),
    ), [schemaAttributes, values],
  );

  const blockedSellerRequirements = useMemo(
    () =>
      schemaAttributes.filter(
        (attribute) =>
          isAttributeRequired(attribute, values) &&
          (attribute.displayMode === 'HIDDEN' ||
            attribute.displayMode === 'READ_ONLY' ||
            attribute.sellerEditable === false) && !isArticleMediaAttribute(attribute),
      ),
    [schemaAttributes, values],
  );

  const editable =
    resolution?.resolution === 'CREATED_DRAFT' ||
    resolution?.resolution === 'REUSED_OWN_DRAFT';
  const draftSaveState = {
    hasType: Boolean(selectedType),
    hasSchema: Boolean(schema && !schemaLoading && schema.productTypeId === productTypeId),
    identityChecked,
    missingRequired: missingRequiredAttributes.length,
    blockedRequired: blockedSellerRequirements.length,
    busy,
  };
  useEffect(() => {
    setDuplicateReview(null);
    setDuplicateReviewReason('');
  }, [productTypeId, brandId, manufacturerPartNumber, values]);
  const requiredIdentityError = selectedType
    ? requiredArticleFieldError(selectedType, brandId, manufacturerPartNumber, pendingIdentifiers) : null;
  const draftReady = canSaveArticleDraft(draftSaveState) && !requiredIdentityError;
  const gtinAllowed = Boolean(selectedType && selectedType.gtinRequirement !== 'NOT_APPLICABLE');
  const queuedIdentifiers = selectedType
    ? pendingArticleIdentifierRequests(pendingIdentifiers, selectedType, gtinAllowed)
    : [];
  const canQueueIdentifiers = Boolean(selectedType && schema && !schemaLoading);
  const pendingNumberError = selectedType
    ? pendingIdentifierError(pendingIdentifiers, selectedType, gtinAllowed) : null;

  useEffect(() => {
    let active = true;
    void (async () => {
      // Master classifications do not depend on Product Type readiness.
      // Independent requests also prevent a failure loading Brands or previous
      // submissions from hiding categories that exist in the catalog.
      const [classificationResult, typesResult, submissionsResult, brandsResult] =
        await Promise.allSettled([
          sellerGet<SellerArticleClassification>('classification'),
          sellerGet<SellerArticleProductType[]>('product-types'),
          sellerGet<SellerArticleSubmissionSummary[]>('articles'),
          referenceGet<BrandRecord[]>('brands'),
        ]);
      if (!active) return;

      if (classificationResult.status === 'fulfilled') {
        setClassification(classificationResult.value);
      }
      if (typesResult.status === 'fulfilled') {
        setProductTypes(typesResult.value);
        setProductTypesLoaded(true);
      }
      if (submissionsResult.status === 'fulfilled') {
        setSubmissions(submissionsResult.value);
      }
      if (brandsResult.status === 'fulfilled') {
        setBrands(brandsResult.value);
      }

      const errors = [
        classificationResult.status === 'rejected'
          ? 'Categories and Part Groups could not be loaded.'
          : null,
        typesResult.status === 'rejected'
          ? 'Product Types could not be loaded.'
          : null,
        submissionsResult.status === 'rejected'
          ? 'Your Article Drafts could not be loaded.'
          : null,
        brandsResult.status === 'rejected'
          ? 'Brands could not be loaded.'
          : null,
      ].filter(Boolean);
      if (errors.length > 0) setError(errors.join(' '));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!productTypeId) {
      setSchema(null);
      setValues({});
      setSchemaLoading(false);
      return;
    }
    let active = true;
    setSchemaLoading(true);
    void (async () => {
      try {
        const value = await sellerGet<SellerProductTypeSchema>(
          `product-types/${productTypeId}/schema`,
        );
        if (active) {
          setSchema(value);
          setValues({});
        }
      } catch (requestError) {
        if (active) setError(messageOf(requestError, 'The Product Type schema could not be loaded.'));
      } finally {
        if (active) setSchemaLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productTypeId]);

  function selectProductType(id: string) {
    setSchema(null);
    setProductTypeId(id);
    setBrandId('');
    setManufacturerPartNumber('');
    setPendingIdentifiers(emptyPendingArticleIdentifiers);
    setIdentityChecked(false);
    setValues({});
    setResolution(null);
    setArticleId('');
    setValidation(null);
    setError('');
    setNotice('');
  }

  async function persistPendingIdentifiers(targetArticleId: string, type: SellerArticleProductType) {
    const requests = pendingArticleIdentifierRequests(pendingIdentifiers, type, gtinAllowed);
    if (requests.length === 0 || identifierSaveLock.current) return;
    const invalid = pendingIdentifierError(pendingIdentifiers, type, gtinAllowed);
    if (invalid) {
      setError(invalid);
      return;
    }
    identifierSaveLock.current = true;
    setSavingIdentifiers(true);
    let saved = 0;
    try {
      for (const request of requests) {
        await sellerPost(`articles/${targetArticleId}/${request.path}`, request.body);
        setPendingIdentifiers(current => clearSavedIdentifier(
          current, request.key, request.body.value ?? request.body.partNumber ?? '',
        ));
        saved++;
      }
      setNotice(`Article saved · ${saved} identifier${saved === 1 ? '' : 's'} added`);
    } catch (cause) {
      setError(`Article Draft saved. ${saved} identifier(s) added; ${requests.length - saved} pending. ${messageOf(cause, 'Retry the remaining references.')}`);
    } finally {
      identifierSaveLock.current = false;
      setSavingIdentifiers(false);
    }
  }

  async function checkIdentity() {
    if (!selectedType) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (brandId && manufacturerPartNumber.trim()) {
        const result = await sellerPost<SellerArticleSubmissionResult | null>(
          'articles/resolve-identity',
          {
            brandId,
            manufacturerPartNumber: manufacturerPartNumber.trim(),
          },
        );
        if (result) {
          setProductTypeId(result.productTypeId);
          setResolution(result);
          setArticleId(result.articleId);
          setNotice(result.message);
          if (result.canPrepareOffer) onArticlePrepared?.({
            id: result.articleId,
            name: [brands.find(brand => brand.id === brandId)?.name, manufacturerPartNumber, selectedType.name].filter(Boolean).join(' '),
            brandName: brands.find(brand => brand.id === brandId)?.name ?? null,
            primaryManufacturerPartNumber: manufacturerPartNumber.trim() || null,
          });
          if (result.resolution === 'REUSED_OWN_DRAFT') {
            await persistPendingIdentifiers(result.articleId,
              productTypes.find(type => type.id === result.productTypeId) ?? selectedType);
            try { await refreshSubmissions(); } catch (error) {
              setError(messageOf(error, 'Draft opened, but your submission list could not be refreshed.'));
            }
          }
          return;
        }
      }
      setIdentityChecked(true);
      setNotice(
        brandId && manufacturerPartNumber.trim()
          ? 'No matching Article found. Save your Draft when ready.'
          : 'Complete the technical fields. Possible duplicates will be checked before saving.',
      );
    } catch (requestError) {
      setError(messageOf(requestError, 'Canonical Article identity could not be checked.'));
    } finally {
      setBusy(false);
    }
  }

  async function createOrReuseArticle(event: FormEvent) {
    event.preventDefault();
    if (!draftReady || pendingNumberError || !selectedType || !schema) return;
    setBusy(true);
    setError('');
    setNotice('');
    setValidation(null);
    try {
      if (!manufacturerPartNumber.trim()) {
        const preflight = await sellerPost<NonNullable<typeof duplicateReview>>('articles/duplicate-preflight', {
          productTypeId: selectedType.id, ...(brandId ? { brandId } : {}), values,
        });
        setDuplicateReview(preflight);
        if (preflight.reviewRequired && duplicateReviewReason.trim().length < 20) {
          setError('Review matching Articles below. Reuse one or explain why this is a different part.');
          return;
        }
      }
      const result = await sellerPost<SellerArticleSubmissionResult>(
        'articles/submit',
        buildSellerArticleDraftPayload({
          productTypeId: selectedType.id,
          brandId,
          manufacturerPartNumber,
          duplicateReviewReason,
          values,
        }),
      );
      setProductTypeId(result.productTypeId);
      setResolution(result);
      setArticleId(result.articleId);
      setNotice(result.message);
      if (result.canPrepareOffer) onArticlePrepared?.({
        id: result.articleId,
        name: [brands.find(brand => brand.id === brandId)?.name, manufacturerPartNumber, selectedType.name].filter(Boolean).join(' '),
        brandName: brands.find(brand => brand.id === brandId)?.name ?? null,
        primaryManufacturerPartNumber: manufacturerPartNumber.trim() || null,
      });
      if (
        result.resolution === 'CREATED_DRAFT' ||
        result.resolution === 'REUSED_OWN_DRAFT'
      ) {
        await persistPendingIdentifiers(result.articleId,
          productTypes.find(type => type.id === result.productTypeId) ?? selectedType);
        try { await refreshSubmissions(); } catch (error) {
          setError(messageOf(error, 'Draft saved, but your submission list could not be refreshed.'));
        }
      }
    } catch (requestError) {
      setError(messageOf(requestError, 'The Manufacturer Article could not be resolved.'));
    } finally {
      setBusy(false);
    }
  }

  async function refreshSubmissions() {
    setSubmissions(await sellerGet<SellerArticleSubmissionSummary[]>('articles'));
  }

  async function resumeSubmission(item: SellerArticleSubmissionSummary) {
    setError('');
    setNotice('');
    setProductTypeId(item.productTypeId);
    setArticleId(item.id);
    onArticlePrepared?.({
      id: item.id,
      name: item.name,
      brandName: brands.find(brand => brand.id === item.brandId)?.name ?? null,
      primaryManufacturerPartNumber: null,
    });
    setResolution({
      resolution: item.catalogReviewSubmittedAt
        ? 'REUSED_OWN_REVIEW'
        : 'REUSED_OWN_DRAFT',
      articleId: item.id,
      productTypeId: item.productTypeId,
      status: item.status,
      reused: true,
      canPrepareOffer: true,
      canSubmitOffer: false,
      requiresCatalogReview: true,
      catalogReviewSubmittedAt: item.catalogReviewSubmittedAt,
      message: item.catalogReviewSubmittedAt
        ? 'This Manufacturer Article is already submitted for catalog review.'
        : 'Your editable Manufacturer Article Draft is open in the evidence workspace.',
    });
    setValidation(null);
    if (!embedded) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!initialDraftId || autoResumeId.current === initialDraftId || productTypes.length === 0) return;
    const ownDraft = submissions.find(item =>
      item.id === initialDraftId &&
      item.status === 'DRAFT' &&
      !item.catalogReviewSubmittedAt,
    );
    if (!ownDraft) return;
    autoResumeId.current = initialDraftId;
    void resumeSubmission(ownDraft);
    // Resumption is intentional once per initial Article ID after the own-submissions list loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraftId, submissions, productTypes]);

  async function validateArticle() {
    if (!articleId) return;
    setBusy(true);
    setError('');
    try {
      const result = await sellerGet<ArticleValidation>(
        `articles/${articleId}/validation`,
      );
      setValidation(result);
    } catch (requestError) {
      setError(messageOf(requestError, 'Article readiness could not be checked.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (!articleId) return;
    setBusy(true);
    setError('');
    try {
      const result = await sellerPost<SellerArticleReviewSubmissionResult>(
        `articles/${articleId}/submit-for-review`,
        {},
      );
      setValidation(result.readiness);
      setResolution((current) =>
        current
          ? {
              ...current,
              resolution: 'REUSED_OWN_REVIEW',
              catalogReviewSubmittedAt: result.catalogReviewSubmittedAt,
              message:
                'Manufacturer Article submitted for catalog review. Technical evidence is now locked while Admin verifies it.',
            }
          : current,
      );
      setNotice(
        'Manufacturer Article submitted for catalog review. Technical evidence is now locked while Admin verifies it.',
      );
      await refreshSubmissions();
    } catch (requestError) {
      setError(messageOf(requestError, 'The Manufacturer Article could not be submitted for review.'));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await postJson('/api/seller/auth/logout', {});
    } finally {
      window.location.assign('/login');
    }
  }

  const Root = embedded ? 'section' : 'main';
  return (
    <Root className="seller-workspace">
      {embedded ? (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-950">Create or reuse a Product Article</h2>
          <p className="text-sm text-slate-600">Classification · Identity · Technical attributes · Fitment</p>
        </div>
      ) : (
        <>
          <header className="seller-workspace__header">
            <div>
              <span className="eyebrow">Seller catalog</span>
              <h1>Add Product Article</h1>
              <p>Canonical manufacturer article and technical fitment</p>
            </div>
            <button className="button button--quiet" type="button" onClick={() => void logout()}>Sign out</button>
          </header>
        </>
      )}

      {error ? <div role="alert" className="alert alert--error">{error}</div> : null}
      {notice ? <div role="status" className="alert alert--success">{notice}</div> : null}

      {!resolution ? (
        <form className="space-y-5" onSubmit={createOrReuseArticle}>
          {duplicateReview?.reviewRequired ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold">Review possible duplicates</p>
              <p className="text-sm">These Articles have the same Product Type, Brand and technical values. A match may still be a different physical part.</p>
              {duplicateReview.candidates.map(candidate => (
                <div key={candidate.id} className="mt-2 flex items-center justify-between gap-3">
                  <span>{candidate.name} · {candidate.status === 'ACTIVE' ? 'Approved' : 'Your draft'}</span>
                  <button type="button" className="button button--secondary" disabled={busy} onClick={() => {
                    setArticleId(candidate.id);
                    setResolution({ articleId: candidate.id, productTypeId: selectedType!.id,
                      status: candidate.status, reused: true, canPrepareOffer: true,
                      canSubmitOffer: candidate.status === 'ACTIVE', requiresCatalogReview: candidate.status !== 'ACTIVE',
                      catalogReviewSubmittedAt: candidate.catalogReviewSubmittedAt,
                      resolution: candidate.status === 'ACTIVE' ? 'REUSED_ACTIVE' : candidate.catalogReviewSubmittedAt ? 'REUSED_OWN_REVIEW' : 'REUSED_OWN_DRAFT',
                      message: 'Existing Article selected. Reuse it for Inventory.' });
                    onArticlePrepared?.({ id: candidate.id, name: candidate.name,
                      brandName: brands.find(brand => brand.id === brandId)?.name ?? null,
                      primaryManufacturerPartNumber: null });
                  }}>Use existing Article</button>
                </div>
              ))}
              <label className="mt-3 block text-sm">Why is this a different part?
                <textarea className="mt-1 w-full rounded-lg border border-slate-300 p-2" minLength={20} maxLength={500}
                  value={duplicateReviewReason} onChange={event => setDuplicateReviewReason(event.target.value)}
                  placeholder="Explain the manufacturer identity or physical difference."/>
              </label>
            </div>
          ) : null}
          <ArticleSection id="article-classification" number="01" title="Classification"
            aside={selectedType ? `Schema v${selectedType.schemaVersion}` : undefined}>
            <div className="grid gap-4 lg:grid-cols-3">
              <ReactSelect label="Category" options={categoryOptions} value={categoryId}
                onChange={option => { setCategoryId(String(option?.value ?? '')); setPartGroupId(''); selectProductType(''); }}
                isDisabled={loading || !classification} isClearable={false} placeholder="Select category"/>
              <ReactSelect label="Part Group" options={partGroupOptions} value={partGroupId}
                onChange={option => { setPartGroupId(String(option?.value ?? '')); selectProductType(''); }}
                isDisabled={!categoryId || !classification} isClearable={false} placeholder="Select part group"/>
              <ReactSelect label="Product Type" options={filteredProductTypes.map(item => ({ value: item.id, label: item.name }))}
                value={productTypeId} onChange={option => selectProductType(String(option?.value ?? ''))}
                isDisabled={!partGroupId || !productTypesLoaded} isClearable={false} placeholder="Select product type"/>
            </div>
            {selectedType && schema ? (
              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                {selectedType.categoryName} <span aria-hidden="true">›</span> {selectedType.partGroupName} <span aria-hidden="true">›</span> {selectedType.name}
              </div>
            ) : null}
            {loading ? <p role="status" className="mt-3 text-sm text-slate-600">Loading catalog…</p> : null}
            {!loading && classification?.categories.length === 0 ? (
              <p role="status" className="mt-3 text-sm text-amber-800">No Active Categories available.</p>
            ) : null}
            {categoryId && partGroupOptions.length === 0 ? (
              <p role="status" className="mt-3 text-sm text-amber-800">No Active Part Groups in this Category.</p>
            ) : null}
            {partGroupId && productTypesLoaded && filteredProductTypes.length === 0 ? (
              <p role="status" className="mt-3 text-sm text-amber-800">No published Product Types in this Part Group. Contact Admin.</p>
            ) : null}
            {productTypeId && schemaLoading ? (
              <p role="status" className="mt-3 text-sm text-slate-600">Loading technical attributes…</p>
            ) : null}
            {productTypeId && !schemaLoading && !schema ? (
              <p role="status" className="mt-3 text-sm text-amber-800">Published schema unavailable. Contact Admin.</p>
            ) : null}
          </ArticleSection>

          {selectedType ? <ArticleSection id="article-identity" number="02" title="Product Type fields"
            aside={identityChecked ? 'Identity checked' : 'Check before saving'}>
            <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              {selectedType.brandRequirement !== 'NOT_APPLICABLE' ? <ReactSelect label={`Brand${selectedType?.brandRequirement === 'REQUIRED' ? ' *' : ''}`}
                options={brands.map(brand => ({ value: brand.id, label: brand.name }))}
                value={brandId} placeholder="Select brand"
                isDisabled={busy} aria-required={selectedType.brandRequirement === 'REQUIRED'}
                onChange={option => { setBrandId(String(option?.value ?? '')); setIdentityChecked(false); }}/> : null}
              {selectedType.identifierRequirement !== 'NOT_APPLICABLE' ? <label className="block min-w-0">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Manufacturer Part Number{selectedType?.identifierRequirement === 'MANUFACTURER_PART_NUMBER' ? ' *' : ''}
                </span>
                <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  value={manufacturerPartNumber}
                  disabled={busy} aria-required={selectedType.identifierRequirement === 'MANUFACTURER_PART_NUMBER'}
                  onChange={event => { setManufacturerPartNumber(event.target.value); setIdentityChecked(false); }}
                  maxLength={160} autoComplete="off" placeholder="Manufacturer part number"/>
              </label> : null}
              <button className="button button--secondary min-h-10 whitespace-nowrap" type="button"
                disabled={busy || !selectedType || !schema || schemaLoading ||
                  (selectedType.brandRequirement === 'REQUIRED' && !brandId) ||
                  (selectedType.identifierRequirement === 'MANUFACTURER_PART_NUMBER' && !manufacturerPartNumber.trim())}
                onClick={() => void checkIdentity()}>
                {busy ? 'Checking…' : identityChecked ? 'Check again' : 'Check identity'}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Fields follow this Product Type's published requirements. Check for an existing Article before saving.</p>
          </ArticleSection> : null}

          <ArticleSection id="article-technical" number="03" title="Technical attributes"
            aside={schema ? `${attributes.length} fields` : 'Select a Product Type'}>
            {blockedSellerRequirements.length > 0 ? (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Required fields are not Seller-editable: {blockedSellerRequirements.map(item => item.name || item.code).join(', ')}. Contact Admin.
              </div>
            ) : null}
            {schema ? (
              <>
                {attributes.length === 0 ? (
                  <p className="text-sm text-slate-600">This Product Type has no Seller-editable attributes.</p>
                ) : (
                  <div className="space-y-4">
                    {attributeGroups.map(group => (
                      <fieldset key={group.name} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <legend className="px-2 text-sm font-semibold text-slate-900">{group.name}</legend>
                        <div className="seller-criteria-grid">
                          {group.attributes.map(attribute => (
                            <SchemaField key={attribute.code} attribute={attribute}
                              value={values[attribute.code ?? '']} allValues={values}
                              onChange={value => {
                                setValidation(null);
                                setValues(current => ({ ...current, [attribute.code!]: value }));
                              }}/>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
                {missingRequiredAttributes.length > 0 ? (
                  <p role="status" className="mt-3 text-xs font-medium text-amber-800">
                    {missingRequiredAttributes.length} required field{missingRequiredAttributes.length === 1 ? '' : 's'} remaining
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">{schemaLoading ? 'Loading fields…' : 'Choose a Product Type to load its fields.'}</p>
            )}
          </ArticleSection>

          {selectedType && (gtinAllowed || selectedType.oeReferenceRequirement !== 'NOT_APPLICABLE' || selectedType.crossReferenceRequirement !== 'NOT_APPLICABLE') ? <ArticleSection id="article-numbers" number="04" title="GTIN & references">
            <SellerArticleNumberFields value={pendingIdentifiers} onChange={setPendingIdentifiers}
              productType={selectedType} brands={brands} gtinAllowed={gtinAllowed}
              gtinRequired={selectedType.gtinRequirement === 'REQUIRED'} disabled={!canQueueIdentifiers}/>
            {pendingNumberError ? <p role="alert" className="mt-2 text-xs text-red-800">{pendingNumberError}</p> : null}
          </ArticleSection> : null}

          {selectedType && selectedType.fitmentRequirement !== 'NOT_APPLICABLE' ? <ArticleSection id="article-fitment-pending" number="05" title="Vehicle fitment">
            <p className="text-sm text-slate-500">Save Draft to add configured vehicles. {selectedType.fitmentRequirement === 'REQUIRED' ? 'Required before Article approval.' : 'Optional.'}</p>
          </ArticleSection> : null}

          <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <span className="text-xs text-slate-600">
              {!selectedType || !schema ? 'Choose a published Product Type' :
                !identityChecked ? 'Check article identity before saving' :
                blockedSellerRequirements.length > 0 ? 'Admin schema correction required' :
                missingRequiredAttributes.length > 0 ? 'Complete required technical fields' :
                requiredIdentityError ? requiredIdentityError : pendingNumberError ? pendingNumberError : 'Ready to save as Draft'}
            </span>
            <button className="button button--primary min-h-10" type="submit" disabled={!draftReady || Boolean(pendingNumberError)}>
              {busy ? 'Saving…' : 'Save Article Draft'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {editable ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <strong className="text-sm text-emerald-950">Article Draft saved</strong>
              <span className="text-xs text-emerald-900">Add references, technical details and vehicle fitments before review.</span>
            </div>
          ) : null}
          <ArticleEvidenceWorkspace
            articleId={articleId} editable={editable} resolution={resolution}
            selectedType={selectedType} validation={validation} busy={busy} brands={brands}
            onValidate={() => void validateArticle()}
            onSubmitReview={() => void submitForReview()}
            onError={setError}
            onNotice={message => { setNotice(message); setValidation(null); }}
            onTechnicalUpdate={() => setValidation(null)}
            pendingIdentifierCount={queuedIdentifiers.length}
            pendingIdentifiersBusy={savingIdentifiers}
            pendingIdentifiers={pendingIdentifiers}
            onPendingIdentifiersChange={setPendingIdentifiers}
            gtinAllowed={gtinAllowed}
            onRetryIdentifiers={() => {
              if (selectedType) void persistPendingIdentifiers(articleId, selectedType);
            }}
            onStartAnother={() => {
              setResolution(null); setArticleId(''); setValidation(null);
              setCategoryId(''); setPartGroupId(''); setProductTypeId(''); setSchema(null);
              setBrandId(''); setManufacturerPartNumber(''); setIdentityChecked(false);
              setValues({}); setNotice(''); setError('');
              setPendingIdentifiers(emptyPendingArticleIdentifiers);
            }}
          />
        </div>
      )}

      <section className="seller-panel seller-submissions">
        <PanelHeading
          title="Your Manufacturer Article submissions"
          detail="Draft evidence stays editable only while the canonical Article is under catalog review."
        />
        <div className="seller-submission-list">
          {submissions.length === 0 ? (
            <p className="seller-muted">No Seller Article submissions yet.</p>
          ) : (
            submissions.map((item) => (
              <div key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    Schema v{item.schemaVersion} · {
                      item.status === 'DRAFT' && item.catalogReviewSubmittedAt
                        ? 'IN REVIEW'
                        : item.status
                    }
                  </small>
                  {item.reviewFeedback ? (
                    <small className="seller-review-feedback">
                      Admin correction: {item.reviewFeedback}
                      {item.reviewFeedbackAt
                        ? ` · ${new Date(item.reviewFeedbackAt).toLocaleDateString()}`
                        : ''}
                    </small>
                  ) : null}
                </span>
                <time>{new Date(item.submittedAt).toLocaleDateString()}</time>
                {item.status === 'DRAFT' && !item.catalogReviewSubmittedAt ? (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => void resumeSubmission(item)}
                  >
                    Resume
                  </button>
                ) : (
                  <span className="seller-status">
                    {item.status === 'DRAFT' && item.catalogReviewSubmittedAt
                      ? 'IN REVIEW'
                      : item.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="seller-workspace__footer">
        Signed in as Seller user {principal.userId.slice(0, 8)}…
      </footer>
    </Root>
  );
}

function ArticleEvidenceWorkspace({
  articleId,
  editable,
  resolution,
  selectedType,
  validation,
  busy,
  brands,
  onValidate,
  onSubmitReview,
  onError,
  onNotice,
  onTechnicalUpdate,
  pendingIdentifierCount,
  pendingIdentifiersBusy,
  pendingIdentifiers,
  onPendingIdentifiersChange,
  gtinAllowed,
  onRetryIdentifiers,
  onStartAnother,
}: {
  articleId: string;
  editable: boolean;
  resolution: SellerArticleSubmissionResult;
  selectedType: SellerArticleProductType | null;
  validation: ArticleValidation | null;
  busy: boolean;
  brands: BrandRecord[];
  onValidate: () => void;
  onSubmitReview: () => void;
  onError: (value: string) => void;
  onNotice: (value: string) => void;
  onTechnicalUpdate: () => void;
  pendingIdentifierCount: number;
  pendingIdentifiersBusy: boolean;
  pendingIdentifiers: PendingArticleIdentifiers;
  onPendingIdentifiersChange: (value: PendingArticleIdentifiers) => void;
  gtinAllowed: boolean;
  onRetryIdentifiers: () => void;
  onStartAnother: () => void;
}) {
  if (!editable) {
    return (
      <section className="seller-panel seller-resolution">
        <PanelHeading title="Article resolved" detail={resolution.message} />
        <div className="seller-panel__body">
          <div className="seller-resolution__state">
            <strong>{resolution.resolution.replaceAll('_', ' ')}</strong>
            <span>Article {articleId}</span>
          </div>
          {resolution.resolution === 'REUSED_ACTIVE' ? (
            <p>
              The shared Manufacturer Article is already approved. Use this Article
              when creating your Seller Offer; do not create another technical Article.
            </p>
          ) : resolution.resolution === 'REUSED_OWN_REVIEW' ? (
            <p>
              Your Manufacturer Article is already in catalog review. Technical
              evidence is locked until Admin finishes verification.
            </p>
          ) : (
            <p>
              This identity already exists but cannot be reused yet. Catalog review
              must resolve it before a Seller Offer is submitted.
            </p>
          )}
          <button className="button button--quiet" type="button" onClick={onStartAnother}>
            Check another Article
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <ArticleSection id="saved-identity" number="01" title="Article identity" aside="Identifiers & references">
        <p className="mb-4 text-xs text-slate-500">Manufacturer identity is fixed for this Draft.</p>
        {pendingIdentifierCount > 0 ? (
          <div className="mb-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p role="status" className="text-sm font-medium text-amber-950">
              {pendingIdentifierCount} unsaved reference{pendingIdentifierCount === 1 ? '' : 's'}
            </p>
            <SellerArticleNumberFields value={pendingIdentifiers} onChange={onPendingIdentifiersChange}
              productType={selectedType} brands={brands} gtinAllowed={gtinAllowed}
              disabled={pendingIdentifiersBusy}/>
            <button type="button" disabled={pendingIdentifiersBusy} className="button button--secondary"
              onClick={onRetryIdentifiers}>{pendingIdentifiersBusy ? 'Saving…' : 'Retry pending references'}</button>
          </div>
        ) : null}
        <IdentifierEvidence articleId={articleId} brands={brands} productType={selectedType} gtinAllowed={gtinAllowed} onError={onError} onNotice={onNotice}/>
      </ArticleSection>
      <ArticleSection id="saved-technical" number="02" title="Technical attributes"
        aside={selectedType ? `Schema v${selectedType.schemaVersion}` : undefined}>
        <SellerArticleDraftEditor key={articleId} articleId={articleId} onSaved={onTechnicalUpdate}/>
      </ArticleSection>
      {selectedType?.fitmentRequirement !== 'NOT_APPLICABLE' ? (
        <ArticleSection id="saved-fitment" number="03" title="Vehicle fitment">
          <FitmentEvidence articleId={articleId} onError={onError} onNotice={onNotice}/>
        </ArticleSection>
      ) : null}
      <ArticleSection id="saved-review" number={selectedType?.fitmentRequirement === 'NOT_APPLICABLE' ? '03' : '04'} title="Review & submit">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600">Readiness is checked against the published catalog rules.</p>
          <div className="flex flex-wrap gap-2">
            <button className="button button--secondary min-h-10" type="button"
              disabled={busy} onClick={onValidate}>
              {busy ? 'Checking…' : 'Check readiness'}
            </button>
            <button className="button button--primary min-h-10" type="button"
              disabled={busy || !validation?.readyForReview} onClick={onSubmitReview}>
              Submit for review
            </button>
          </div>
        </div>
        {validation ? <ValidationResult validation={validation}/> : null}
      </ArticleSection>
    </div>
  );
}

function IdentifierEvidence({
  articleId,
  brands,
  onError,
  onNotice,
  productType,
  gtinAllowed,
}: EvidenceProps & { brands: BrandRecord[]; productType: SellerArticleProductType | null; gtinAllowed: boolean }) {
  const [directType, setDirectType] =
    useState<(typeof directIdentifierTypes)[number]>('GTIN_13');
  const [directValue, setDirectValue] = useState('');
  const directGtinError = directType === 'TRADE_NUMBER' ? null
    : gtinValidationError(directValue, directType);
  const [referenceType, setReferenceType] = useState<'OE' | 'CROSS_REFERENCE' | 'AFTERMARKET' | 'OTHER'>('OE');
  const [referenceValue, setReferenceValue] = useState('');
  const [issuerBrandId, setIssuerBrandId] = useState('');

  const referenceOptions = [
    ...(productType && productType.oeReferenceRequirement !== 'NOT_APPLICABLE' ? [{ value: 'OE', label: 'OE number' }] : []),
    ...(productType && productType.crossReferenceRequirement !== 'NOT_APPLICABLE' ? [{ value: 'CROSS_REFERENCE', label: 'Cross reference' }] : []),
    ...(productType && productType.identifierRequirement !== 'NOT_APPLICABLE' ? [
      { value: 'AFTERMARKET', label: 'Aftermarket reference' }, { value: 'OTHER', label: 'Other reference' },
    ] : []),
  ];
  const allowedReferenceType = referenceOptions.some(option => option.value === referenceType)
    ? referenceType : referenceOptions[0]?.value;

  async function addDirect() {
    if (directGtinError || !directValue.trim()) return;
    try {
      await sellerPost(`articles/${articleId}/direct-identifiers`, {
        type: directType,
        value: directType === 'TRADE_NUMBER' ? directValue.trim() : normalizeGtin(directValue),
      });
      setDirectValue('');
      onNotice(`${directType.replaceAll('_', ' ')} added to the Draft Article.`);
    } catch (error) {
      onError(messageOf(error, 'The direct identifier could not be added.'));
    }
  }

  async function addReference() {
    try {
      await sellerPost(`articles/${articleId}/identifiers`, {
        type: allowedReferenceType,
        partNumber: referenceValue.trim(),
        ...(issuerBrandId.trim() ? { issuerBrandId: issuerBrandId.trim() } : {}),
      });
      setReferenceValue('');
      onNotice(`${referenceType.replaceAll('_', ' ')} reference added.`);
    } catch (error) {
      onError(messageOf(error, 'The Article reference could not be added.'));
    }
  }

  return (
    <div className="seller-two-column">
      {gtinAllowed ? <EvidenceCard title="GTIN" detail="">
        <ReactSelect
          label="Identifier type"
          options={directIdentifierTypes.filter(value => value !== 'TRADE_NUMBER').map((value) => ({
            value,
            label: value.replaceAll('_', ' '),
          }))}
          value={directType}
          isClearable={false}
          onChange={(option) => {
            if (option) {
              setDirectType(option.value as (typeof directIdentifierTypes)[number]);
            }
          }}
        />
        <label>
          <span>Value</span>
          <input inputMode="numeric" value={directValue}
            aria-invalid={Boolean(directGtinError)}
            aria-describedby={directGtinError ? 'seller-direct-gtin-error' : undefined}
            onChange={(event) => setDirectValue(event.target.value)} />
        </label>
        {directGtinError ? <p id="seller-direct-gtin-error" role="alert" className="text-xs text-red-800">
          {directGtinError}
        </p> : null}
        <button className="button button--primary" type="button"
          disabled={!directValue.trim() || Boolean(directGtinError)}
          onClick={() => void addDirect()}>
          Add identifier
        </button>
      </EvidenceCard> : null}

      {referenceOptions.length > 0 ? <EvidenceCard title="OE & cross references" detail="">
        <ReactSelect
          label="Reference type"
          options={referenceOptions}
          value={allowedReferenceType}
          isClearable={false}
          onChange={(option) => {
            if (option) {
              setReferenceType(
                option.value as typeof referenceType,
              );
            }
          }}
        />
        <ReactSelect
          label="Issuing Brand / vehicle marque"
          options={[
            { value: '', label: 'No issuer selected' },
            ...brands.map((brand) => ({
              value: brand.id,
              label: brand.name,
            })),
          ]}
          value={issuerBrandId}
          placeholder="No issuer selected"
          onChange={(option) =>
            setIssuerBrandId(String(option?.value ?? ''))
          }
        />
        <label>
          <span>Part/reference number</span>
          <input value={referenceValue} onChange={(event) => setReferenceValue(event.target.value)} />
        </label>
        <button className="button button--primary" type="button" disabled={!referenceValue.trim()} onClick={() => void addReference()}>
          Add reference
        </button>
      </EvidenceCard> : null}
    </div>
  );
}

function FitmentEvidence({
  articleId,
  onError,
  onNotice,
}: EvidenceProps) {
  const [makes, setMakes] = useState<VehicleMakeRecord[]>([]);
  const [models, setModels] = useState<VehicleModelRecord[]>([]);
  const [derivatives, setDerivatives] = useState<VehicleModelDerivativeRecord[]>([]);
  const [derivativeId, setDerivativeId] = useState('');
  const [generations, setGenerations] = useState<VehicleGenerationRecord[]>([]);
  const [trims, setTrims] = useState<VehicleTrimRecord[]>([]);
  const [configurations, setConfigurations] = useState<VehicleConfigurationRecord[]>([]);
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [generationId, setGenerationId] = useState('');
  const [trimId, setTrimId] = useState('');
  const [configurationId, setConfigurationId] = useState('');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [queuedFitments, setQueuedFitments] = useState<PendingExactFitment[]>([]);
  const [savingFitments, setSavingFitments] = useState(false);
  const [loadingVehicleChoices, setLoadingVehicleChoices] = useState(false);
  const vehicleLookupSequence = useRef(0);

  useEffect(() => {
    void referenceGet<VehicleMakeRecord[]>('vehicles/makes').then(setMakes).catch((error) =>
      onError(messageOf(error, 'Vehicle makes could not be loaded.')),
    );
  }, [onError]);

  async function loadVehicleChoices(
    task: (isCurrent: () => boolean) => Promise<void>,
  ) {
    const sequence = ++vehicleLookupSequence.current;
    setLoadingVehicleChoices(true);
    onError('');
    const isCurrent = () => sequence === vehicleLookupSequence.current;
    try {
      await task(isCurrent);
    } catch (error) {
      if (isCurrent()) onError(messageOf(error, 'Vehicle reference options could not be loaded.'));
    } finally {
      if (isCurrent()) setLoadingVehicleChoices(false);
    }
  }

  async function selectMake(value: string) {
    setMakeId(value);
    setModelId('');
    setDerivativeId('');
    setDerivatives([]);
    setGenerationId('');
    setTrimId('');
    setConfigurationId('');
    setModels([]);
    setGenerations([]);
    setTrims([]);
    setConfigurations([]);
    await loadVehicleChoices(async isCurrent => {
      if (!value) return;
      const next = await referenceGet<VehicleModelRecord[]>(`vehicles/models?makeId=${value}`);
      if (isCurrent()) setModels(next);
    });
  }

  async function selectModel(value: string) {
    setModelId(value);
    setDerivativeId('');
    setDerivatives([]);
    setGenerationId('');
    setTrimId('');
    setConfigurationId('');
    setGenerations([]);
    setTrims([]);
    setConfigurations([]);
    await loadVehicleChoices(async isCurrent => {
      if (!value) return;
      const [nextDerivatives, nextGenerations, nextConfigurations] = await Promise.all([
        referenceGet<VehicleModelDerivativeRecord[]>(`vehicles/derivatives?modelId=${value}`),
        referenceGet<VehicleGenerationRecord[]>(`vehicles/generations?modelId=${value}`),
        referenceGet<VehicleConfigurationRecord[]>(`vehicles/configurations?modelId=${value}`),
      ]);
      if (!isCurrent()) return;
      setDerivatives(nextDerivatives);
      setGenerations(nextGenerations);
      setConfigurations(nextConfigurations);
    });
  }

  async function selectDerivative(value: string) {
    setDerivativeId(value);
    setGenerationId('');
    setTrimId('');
    setConfigurationId('');
    setTrims([]);
    setConfigurations([]);
    await loadVehicleChoices(async isCurrent => {
      if (!modelId) return;
      const suffix = value ? `&derivativeId=${value}` : '';
      const next = await referenceGet<VehicleGenerationRecord[]>(`vehicles/generations?modelId=${modelId}${suffix}`);
      if (isCurrent()) setGenerations(next);
    });
  }

  async function selectGeneration(value: string) {
    setGenerationId(value);
    setTrimId('');
    setConfigurationId('');
    setTrims([]);
    setConfigurations([]);
    await loadVehicleChoices(async isCurrent => {
      if (!modelId) return;
      const [nextTrims, nextConfigurations] = await Promise.all([
        value ? referenceGet<VehicleTrimRecord[]>(`vehicles/trims?generationId=${value}`) :
          Promise.resolve([] as VehicleTrimRecord[]),
        referenceGet<VehicleConfigurationRecord[]>(
          `vehicles/configurations?modelId=${modelId}${value ? `&generationId=${value}` : ''}`,
        ),
      ]);
      if (!isCurrent()) return;
      setTrims(nextTrims);
      setConfigurations(nextConfigurations);
    });
  }

  async function selectTrim(value: string) {
    setTrimId(value);
    setConfigurationId('');
    setConfigurations([]);
    await loadVehicleChoices(async isCurrent => {
      if (!modelId) return;
      const next = await referenceGet<VehicleConfigurationRecord[]>(
        `vehicles/configurations?modelId=${modelId}${generationId ? `&generationId=${generationId}` : ''}${value ? `&trimId=${value}` : ''}`,
      );
      if (isCurrent()) setConfigurations(next);
    });
  }

  function queueFitment() {
    const configuration = configurations.find(item => item.id === configurationId);
    if (!configuration || queuedFitments.some(item => item.vehicleConfigurationId === configuration.id)) {
      return;
    }
    if (queuedFitments.length >= MAX_QUEUED_FITMENTS) {
      onError(`Select no more than ${MAX_QUEUED_FITMENTS} configurations per batch.`);
      return;
    }
    setQueuedFitments(current => enqueueExactFitment(current, {
      vehicleConfigurationId: configuration.id,
      vehicleLabel: `${configuration.code || configuration.id.slice(0, 8)}${configuration.modelYear ? ` · ${configuration.modelYear}` : ''}`,
      position: position.trim(),
      notes: notes.trim(),
    }));
    setConfigurationId('');
    setPosition('');
    setNotes('');
    onError('');
  }

  async function saveFitments() {
    if (queuedFitments.length === 0 || savingFitments) return;
    setSavingFitments(true);
    onError('');
    let saved = 0;
    try {
      // Existing API is single-fitment. Save sequentially and retain failed/unattempted
      // records for retry, rather than incorrectly claiming the batch was atomic.
      for (const fitment of queuedFitments) {
        await sellerPost(`articles/${articleId}/fitments/exact`, {
          vehicleConfigurationId: fitment.vehicleConfigurationId,
          ...(fitment.position ? { position: fitment.position } : {}),
          ...(fitment.notes ? { notes: fitment.notes } : {}),
        });
        saved++;
      }
      setQueuedFitments([]);
      onNotice(`${saved} configured-vehicle fitment${saved === 1 ? '' : 's'} saved as Seller-submitted evidence. Admin verification is still required.`);
    } catch (error) {
      setQueuedFitments(pendingAfterFailure(queuedFitments, saved));
      onError(`${saved} fitment${saved === 1 ? ' was' : 's were'} saved. ${messageOf(error, 'A vehicle fitment could not be saved.')} The remaining configurations are still selected; retry them before submitting for review.`);
    } finally {
      setSavingFitments(false);
    }
  }

  return (
    <EvidenceCard
      title="Exact configured-vehicle fitment"
      detail="Match this Article to supported vehicle configurations."
    >
      {loadingVehicleChoices ? <p role="status" className="mb-3 text-sm text-slate-600">Loading vehicle options…</p> : null}
      <div className="seller-fitment-grid">
        <SelectField label="Make" value={makeId} onChange={(value) => void selectMake(value)} options={makes.map((item) => ({ id: item.id, label: item.name }))} />
        <SelectField label="Model" value={modelId} onChange={(value) => void selectModel(value)}
          disabled={!makeId || loadingVehicleChoices} options={models.map((item) => ({ id: item.id, label: item.name }))} />
        {derivatives.length > 0 ? (
          <SelectField label="Derivative / Body Line" value={derivativeId} onChange={(value) => void selectDerivative(value)}
            disabled={!modelId || loadingVehicleChoices}
            options={derivatives.map(item => ({ id: item.id, label: item.name }))}/>
        ) : null}
        <SelectField label="Generation" value={generationId} onChange={(value) => void selectGeneration(value)} disabled={!modelId || (derivatives.length > 0 && !derivativeId) || loadingVehicleChoices} options={generations.map((item) => ({ id: item.id, label: `${item.name}${item.startYear ? ` · ${item.startYear}–${item.endYear ?? 'present'}` : ''}` }))} />
        <SelectField label="Trim" value={trimId} onChange={(value) => void selectTrim(value)} disabled={!generationId || loadingVehicleChoices} options={trims.map((item) => ({ id: item.id, label: item.name }))} />
        <SelectField
          label="Configuration"
          disabled={!generationId || loadingVehicleChoices}
          value={configurationId}
          onChange={setConfigurationId}
          options={configurations.map((item) => ({
            id: item.id,
            label: `${item.code || item.id.slice(0, 8)}${item.modelYear ? ` · ${item.modelYear}` : ''}`,
          }))}
        />
        <label>
          <span>Position</span>
          <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Optional install position" />
        </label>
      </div>
      <label>
        <span>Fitment notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button className="button button--quiet" type="button"
        disabled={!configurationId || savingFitments || queuedFitments.length >= MAX_QUEUED_FITMENTS}
        onClick={queueFitment}>
        Select configuration for batch
      </button>
      <div className="space-y-2" aria-label="Selected vehicle configurations">
        <p className="text-sm font-semibold">{queuedFitments.length} of {MAX_QUEUED_FITMENTS} configurations selected</p>
        {queuedFitments.length === 0 ? (
          <p className="text-sm text-slate-600">Choose a configuration above, then add it to the batch. Repeat for every compatible vehicle.</p>
        ) : (
          <ul className="space-y-2">
            {queuedFitments.map(fitment => (
              <li key={fitment.vehicleConfigurationId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <strong className="text-sm">{fitment.vehicleLabel}</strong>
                  {fitment.position ? <p className="text-xs text-slate-500">Position: {fitment.position}</p> : null}
                  {fitment.notes ? <p className="text-xs text-slate-500">Notes: {fitment.notes}</p> : null}
                </div>
                <button type="button" className="button button--quiet" disabled={savingFitments}
                  aria-label={`Remove ${fitment.vehicleLabel} from selected fitments`}
                  onClick={() => setQueuedFitments(current => current.filter(item => item.vehicleConfigurationId !== fitment.vehicleConfigurationId))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="button button--primary" type="button"
        disabled={savingFitments || queuedFitments.length === 0} onClick={() => void saveFitments()}>
        {savingFitments ? 'Saving fitments…' : `Save ${queuedFitments.length} selected fitment${queuedFitments.length === 1 ? '' : 's'}`}
      </button>
      <p className="text-xs text-slate-600">Each configuration is checked by the API. On an error, earlier saved entries remain and the remaining selections can be retried. Fitments remain unverified until approved.</p>
    </EvidenceCard>
  );
}

function ValidationResult({ validation }: { validation: ArticleValidation }) {
  return (
    <div className="seller-validation">
      <div className="seller-validation__score">
        <strong>{validation.qualityScore}</strong>
        <span>{validation.qualityBand}</span>
        <small>{validation.readyForReview ? 'Ready to submit for catalog review' : 'More Seller evidence required'}</small>
      </div>
      <div className="seller-validation__counts">
        <span><strong>{validation.summary.identifierCount}</strong> identifiers</span>
        <span><strong>{validation.summary.oeReferenceCount}</strong> OE</span>
        <span><strong>{validation.summary.crossReferenceCount}</strong> cross refs</span>
        <span>
          <strong>{validation.summary.fitmentEvidenceCount}</strong> fitment evidence
          <small>{validation.summary.verifiedFitmentCount} verified</small>
        </span>
      </div>
      {validation.issues.length > 0 ? (
        <div className="seller-validation__issues">
          {validation.issues.map((issue) => (
            <div key={issue.code + (issue.attributeCode ?? '')}>
              <strong>{issue.area.replaceAll('_', ' ')}</strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="alert alert--success">
          No current Article validation issues. The Draft is ready for catalog review.
        </div>
      )}
    </div>
  );
}

function ArticleSection({
  id,
  number,
  title,
  aside,
  children,
}: {
  id: string;
  number: string;
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-white">{number}</span>
          <h2 id={id} className="text-base font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
        {aside ? <span className="text-xs font-medium text-slate-500">{aside}</span> : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function PanelHeading({
  step,
  title,
  detail,
}: {
  step?: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="seller-panel__heading">
      {step ? <span>{step}</span> : null}
      <div>
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}

function EvidenceCard({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div className="seller-evidence-card">
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <ReactSelect
        label={label}
        options={options.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        placeholder="Select"
        value={value}
        isDisabled={disabled}
        onChange={(option) => onChange(String(option?.value ?? ''))}
      />
    </div>
  );
}

type EvidenceProps = {
  articleId: string;
  onError: (value: string) => void;
  onNotice: (value: string) => void;
};


async function sellerGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api/seller/catalog/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return readResponse<T>(response);
}

async function sellerPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/seller/catalog/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse<T>(response);
}

async function referenceGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api/seller/reference/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'The request could not be completed.';
    let code = 'REQUEST_FAILED';
    try {
      const value = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
          issues?: Array<{
            code?: string;
            area?: string;
            attributeCode?: string;
            message?: string;
          }>;
        };
      };
      message = value.error?.message ?? message;
      code = value.error?.code ?? code;
      const issues = value.error?.issues
        ?.filter((issue) => typeof issue.message === 'string')
        .slice(0, 6) ?? [];
      if (issues.length > 0) {
        message += ` — ${issues
          .map((issue) =>
            `${issue.attributeCode || issue.area || issue.code || 'Field'}: ${issue.message}`,
          )
          .join(' • ')}`;
      }
    } catch {
      // Keep the safe fallback.
    }
    throw new ClientApiError(message, code, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
