'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AttributeDefinitionRecord,
  AttributeGroupRecord,
  BulkCreateProductTypeAttributeAssignmentsInput,
  BulkDeleteProductTypeAttributeAssignmentsInput,
  BulkUpdateProductTypeAttributeAssignmentsInput,
  ProductTypeAttributeAssignmentRecord,
  ProductTypeAttributeRequirement,
} from '@/lib/catalog-attribute-contracts';
import type {
  ProductTypeRecord,
  ProductTypeSchemaVersionRecord,
  PublishProductTypeSchemaInput,
  UpdateProductTypeInput,
} from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { resolveAvailableAttributes } from '@/lib/product-type-attribute-management';
import { productTypePublicationVerificationError } from '@/lib/product-type-publication';
import {
  ATTRIBUTE_SETTINGS_LIMIT_MESSAGE,
  MAX_ATTRIBUTE_SETTINGS_PER_SAVE,
  stageAttributeSettingsBatch,
  verifySavedAttributeSettings,
  type AttributeSettingPatch,
  type AttributeSettingsDraftState,
} from '@/lib/product-type-attribute-drafts';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import {
  ProductTypeRequirementFields,
  type ProductTypeRequirementValues,
} from './product-type-requirement-fields';

const ATTRIBUTE_BROWSER_PAGE_SIZE = 24;

export function ProductTypeTechnicalAttributes({
  productType: initialProductType,
  onProductTypeChange,
  onUnsavedChange,
  focusPublication = false,
  onPublicationFocused,
}: {
  productType: ProductTypeRecord;
  onProductTypeChange?: (productType: ProductTypeRecord) => void;
  onUnsavedChange?: (count: number) => void;
  focusPublication?: boolean;
  onPublicationFocused?: () => void;
}) {
  const [productType, setProductType] = useState(initialProductType);
  const [attributes, setAttributes] = useState<AttributeDefinitionRecord[]>([]);
  const [groups, setGroups] = useState<AttributeGroupRecord[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<
    AttributeDefinitionRecord[]
  >([]);
  const [assignments, setAssignments] = useState<
    ProductTypeAttributeAssignmentRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [groupKey, setGroupKey] = useState('ALL');
  const [availablePage, setAvailablePage] = useState(1);
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<string[]>([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>(
    [],
  );
  const [adding, setAdding] = useState(false);
  const [attributeDraftState, setAttributeDraftState] =
    useState<AttributeSettingsDraftState>({ drafts: {}, error: '' });
  const attributeDrafts = attributeDraftState.drafts;
  const unsavedCount = Object.keys(attributeDrafts).length;
  const [bulkSaving, setBulkSaving] = useState(false);
  const [requirements, setRequirements] =
    useState<ProductTypeRequirementValues>({
      brandRequirement: initialProductType.brandRequirement,
      identifierRequirement: initialProductType.identifierRequirement,
      gtinRequirement: initialProductType.gtinRequirement,
      oemReferenceRequirement: initialProductType.oemReferenceRequirement,
      crossReferenceRequirement: initialProductType.crossReferenceRequirement,
      fitmentRequirement: initialProductType.fitmentRequirement,
      imageRequirement: initialProductType.imageRequirement,
      minimumImageCount: initialProductType.minimumImageCount,
      maximumImageCount: initialProductType.maximumImageCount,
      documentRequirement: initialProductType.documentRequirement,
      minimumDocumentCount: initialProductType.minimumDocumentCount,
      priceRequirement: initialProductType.priceRequirement,
      stockRequirement: initialProductType.stockRequirement,
      conditionRequirement: initialProductType.conditionRequirement,
      warrantyRequirement: initialProductType.warrantyRequirement,
    });
  const [requirementsSaving, setRequirementsSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState(false);
  const [definitionName, setDefinitionName] = useState(initialProductType.name);
  const [definitionDescription, setDefinitionDescription] = useState(
    initialProductType.description ?? '',
  );
  const [definitionSaving, setDefinitionSaving] = useState(false);

  useEffect(() => {
    setProductType(initialProductType);
    setDefinitionName(initialProductType.name);
    setDefinitionDescription(initialProductType.description ?? '');
    setRequirements({
      brandRequirement: initialProductType.brandRequirement,
      identifierRequirement: initialProductType.identifierRequirement,
      gtinRequirement: initialProductType.gtinRequirement,
      oemReferenceRequirement: initialProductType.oemReferenceRequirement,
      crossReferenceRequirement: initialProductType.crossReferenceRequirement,
      fitmentRequirement: initialProductType.fitmentRequirement,
      imageRequirement: initialProductType.imageRequirement,
      minimumImageCount: initialProductType.minimumImageCount,
      maximumImageCount: initialProductType.maximumImageCount,
      documentRequirement: initialProductType.documentRequirement,
      minimumDocumentCount: initialProductType.minimumDocumentCount,
      priceRequirement: initialProductType.priceRequirement,
      stockRequirement: initialProductType.stockRequirement,
      conditionRequirement: initialProductType.conditionRequirement,
      warrantyRequirement: initialProductType.warrantyRequirement,
    });
  }, [initialProductType]);

  useEffect(() => { onUnsavedChange?.(unsavedCount); }, [onUnsavedChange, unsavedCount]);

  useEffect(() => {
    if (unsavedCount === 0) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsavedCount]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError('');
      setActionError('');
      setNotice('');
      setSelectedAvailableIds([]);
      setSelectedAssignmentIds([]);

      try {
        const [assignmentsResponse, availableResponse, attributesResponse, groupsResponse] =
          await Promise.all([
            fetch(
              `/api/admin/catalog/product-types/${initialProductType.id}/attributes`,
              { credentials: 'same-origin', cache: 'no-store' },
            ),
            fetch(
              `/api/admin/catalog/product-types/${initialProductType.id}/available-attributes`,
              { credentials: 'same-origin', cache: 'no-store' },
            ),
            fetch('/api/admin/catalog/attributes?status=ACTIVE&scope=PRODUCT', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
            fetch('/api/admin/catalog/attribute-groups?status=ACTIVE', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
          ]);

        if (!assignmentsResponse.ok || !attributesResponse.ok) {
          throw new Error('Could not load technical Attributes');
        }

        const [assignmentData, masterAttributeData, groupData] = await Promise.all([
          assignmentsResponse.json() as Promise<
            ProductTypeAttributeAssignmentRecord[]
          >,
          attributesResponse.json() as Promise<AttributeDefinitionRecord[]>,
          groupsResponse.ok
            ? (groupsResponse.json() as Promise<AttributeGroupRecord[]>)
            : Promise.resolve([]),
        ]);

        const serverAvailable = availableResponse.ok
          ? ((await availableResponse.json()) as AttributeDefinitionRecord[])
          : [];

        if (!active) return;

        const resolvedAvailable = resolveAvailableAttributes(
          masterAttributeData,
          assignmentData,
          serverAvailable,
        );

        const activeMasterAttributes = masterAttributeData.filter(
          (attribute) => attribute.status === 'ACTIVE',
        );
        const activeAttributeIds = new Set(
          activeMasterAttributes.map((attribute) => attribute.id),
        );
        setAssignments(assignmentData);
        setAttributeDraftState({ drafts: {}, error: '' });
        setAttributes(masterAttributeData);
        setAvailableAttributes(
          resolvedAvailable.filter((attribute) =>
            activeAttributeIds.has(attribute.id),
          ),
        );
        setGroups(groupData);

        setGroupKey('ALL');
        setAvailablePage(1);
      } catch {
        if (active) {
          setLoadError(
            'Technical Attributes could not be loaded. Reload and try again.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [initialProductType.id]);

  // The library menu may select an unloaded Product Type. Navigate only
  // after its attributes have loaded and the publication panel is mounted.
  useEffect(() => {
    if (!focusPublication || loading) return;
    const target = loadError
      ? document.querySelector('.product-type-technical')
      : document.getElementById('product-type-publish');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onPublicationFocused?.();
  }, [focusPublication, loading, loadError, onPublicationFocused]);

  const attributesById = useMemo(
    () => new Map(attributes.map((attribute) => [attribute.id, attribute])),
    [attributes],
  );

  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  const availableGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = availableAttributes.filter((attribute) => {
      if (!query) return true;
      return `${attribute.name} ${attribute.code} ${attribute.description ?? ''}`
        .toLowerCase()
        .includes(query);
    });

    const grouped = new Map<
      string,
      { group: AttributeGroupRecord | null; attributes: AttributeDefinitionRecord[] }
    >();

    for (const attribute of filtered) {
      const key = attribute.groupId ?? 'UNGROUPED';
      const current = grouped.get(key) ?? {
        group: attribute.groupId ? groupsById.get(attribute.groupId) ?? null : null,
        attributes: [],
      };
      current.attributes.push(attribute);
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .map((entry) => ({
        ...entry,
        attributes: entry.attributes
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort(
        (a, b) =>
          (a.group?.sortOrder ?? 9999) - (b.group?.sortOrder ?? 9999) ||
          (a.group?.name ?? 'Ungrouped').localeCompare(
            b.group?.name ?? 'Ungrouped',
          ),
      );
  }, [availableAttributes, groupsById, search]);

  const selectedAvailableGroup =
    groupKey === 'ALL'
      ? null
      : availableGroups.find(
          (entry) => (entry.group?.id ?? 'UNGROUPED') === groupKey,
        ) ?? null;

  const visibleAvailableAttributes = useMemo(() => {
    if (groupKey === 'ALL') {
      return availableGroups.flatMap((entry) => entry.attributes);
    }
    return selectedAvailableGroup?.attributes ?? [];
  }, [availableGroups, groupKey, selectedAvailableGroup]);

  const availablePageCount = Math.max(
    1,
    Math.ceil(visibleAvailableAttributes.length / ATTRIBUTE_BROWSER_PAGE_SIZE),
  );
  const availablePageItems = visibleAvailableAttributes.slice(
    (availablePage - 1) * ATTRIBUTE_BROWSER_PAGE_SIZE,
    availablePage * ATTRIBUTE_BROWSER_PAGE_SIZE,
  );

  useEffect(() => {
    setAvailablePage(1);
  }, [groupKey, search]);

  useEffect(() => {
    if (groupKey !== 'ALL' && !selectedAvailableGroup) {
      setGroupKey('ALL');
    }
  }, [groupKey, selectedAvailableGroup]);

  useEffect(() => {
    if (availablePage > availablePageCount) {
      setAvailablePage(availablePageCount);
    }
  }, [availablePage, availablePageCount]);

  const sortedAssignments = useMemo(
    () =>
      assignments.slice().sort((a, b) => {
        const attributeA = attributesById.get(a.attributeId);
        const attributeB = attributesById.get(b.attributeId);
        const groupA = attributeA?.groupId
          ? groupsById.get(attributeA.groupId)
          : null;
        const groupB = attributeB?.groupId
          ? groupsById.get(attributeB.groupId)
          : null;

        return (
          (groupA?.sortOrder ?? 9999) - (groupB?.sortOrder ?? 9999) ||
          a.displayOrder - b.displayOrder ||
          (attributeA?.name ?? '').localeCompare(attributeB?.name ?? '')
        );
      }),
    [assignments, attributesById, groupsById],
  );

  const draftAssignments = assignments.filter(
    (assignment) => assignment.status === 'DRAFT',
  );
  const publishableAssignments = assignments.filter(
    (assignment) =>
      assignment.status === 'ACTIVE' || assignment.status === 'DRAFT',
  );
  const groupedAssignmentCount = publishableAssignments.filter(
    (assignment) => Boolean(attributesById.get(assignment.attributeId)?.groupId),
  ).length;
  const invalidPublishableAttributes = publishableAssignments.filter(
    (assignment) =>
      attributesById.get(assignment.attributeId)?.status !== 'ACTIVE',
  );

  const readiness = {
    classification: Boolean(productType.categoryId && productType.productFamilyId),
    attributes: publishableAssignments.length > 0,
    grouping:
      publishableAssignments.length > 0 &&
      groupedAssignmentCount === publishableAssignments.length,
    applicability: Boolean(productType.fitmentRequirement),
    publishable:
      publishableAssignments.length > 0 &&
      invalidPublishableAttributes.length === 0,
    published: Boolean(productType.currentSchemaVersionId),
  };

  function replaceProductType(next: ProductTypeRecord) {
    setProductType(next);
    onProductTypeChange?.(next);
  }

  function toggleAvailable(attributeId: string) {
    setSelectedAvailableIds((current) =>
      current.includes(attributeId)
        ? current.filter((id) => id !== attributeId)
        : [...current, attributeId],
    );
  }

  function toggleAvailableGroup(attributeIds: string[]) {
    setSelectedAvailableIds((current) => {
      const selected = new Set(current);
      const allSelected = attributeIds.every((id) => selected.has(id));
      for (const id of attributeIds) {
        if (allSelected) selected.delete(id);
        else selected.add(id);
      }
      return [...selected];
    });
  }

  async function addSelectedAttributes() {
    if (selectedAvailableIds.length === 0) return;
    setAdding(true);
    setActionError('');
    setNotice('');

    try {
      const nextOrder =
        assignments.length === 0
          ? 10
          : Math.max(...assignments.map((assignment) => assignment.displayOrder)) +
            10;

      const input: BulkCreateProductTypeAttributeAssignmentsInput = {
        attributeIds: selectedAvailableIds,
        requirement: 'OPTIONAL',
        displayMode: 'VISIBLE',
        startDisplayOrder: nextOrder,
        searchable: false,
        filterable: false,
        comparable: false,
        status: 'DRAFT',
      };

      const created = await postJson<ProductTypeAttributeAssignmentRecord[]>(
        `/api/admin/catalog/product-types/${productType.id}/attributes/bulk`,
        input,
      );

      const createdAttributeIds = new Set(
        created.map((assignment) => assignment.attributeId),
      );
      setAssignments((current) => [...current, ...created]);
      setAvailableAttributes((current) =>
        current.filter((attribute) => !createdAttributeIds.has(attribute.id)),
      );
      setSelectedAvailableIds([]);
      setNotice(
        `${created.length} Attribute${created.length === 1 ? '' : 's'} added. Configure each row below.`,
      );
    } catch (error) {
      setActionError(messageFor(error, 'The selected Attributes could not be added.'));
    } finally {
      setAdding(false);
    }
  }

  function stageAssignment(
    assignment: ProductTypeAttributeAssignmentRecord,
    change: AttributeSettingPatch,
  ) {
    setAttributeDraftState((current) =>
      stageAttributeSettingsBatch(current.drafts, [assignment], change),
    );
    setNotice('');
    setActionError('');
  }

  function bulkUpdateAssignments(change: AttributeSettingPatch) {
    const targets = assignments.filter((assignment) => selectedAssignmentIds.includes(assignment.id));
    if (!targets.length) return;
    setAttributeDraftState((current) =>
      stageAttributeSettingsBatch(current.drafts, targets, change),
    );
    setActionError('');
    setNotice('');
  }

  async function saveAllAttributeSettings() {
    if (unsavedCount === 0 || bulkSaving) return;
    const changes: BulkUpdateProductTypeAttributeAssignmentsInput = {
      assignments: assignments
        .filter((assignment) => Boolean(attributeDrafts[assignment.id]))
        .map((assignment) => ({
          id: assignment.id, version: assignment.version,
          ...attributeDrafts[assignment.id],
        })),
    };
    if (!changes.assignments.length) return;
    if (changes.assignments.length > MAX_ATTRIBUTE_SETTINGS_PER_SAVE) {
      setActionError(ATTRIBUTE_SETTINGS_LIMIT_MESSAGE);
      return;
    }

    setBulkSaving(true);
    setAttributeDraftState((current) => ({ ...current, error: '' }));
    setNotice('');
    setActionError('');
    try {
      const updated = await patchJson<ProductTypeAttributeAssignmentRecord[]>(
        `/api/admin/catalog/product-types/${productType.id}/attributes/bulk`,
        changes,
      );
      const saved = verifySavedAttributeSettings(
        changes.assignments,
        updated,
        productType.id,
      );
      const byId = new Map(saved.map((item) => [item.id, item]));
      setAssignments((current) => current.map((item) => byId.get(item.id) ?? item));
      setAttributeDraftState({ drafts: {}, error: '' });
      setNotice(`Saved settings for ${saved.length} Attributes together.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not save Attribute settings. Your edits are retained.',
      );
    } finally {
      setBulkSaving(false);
    }
  }

  async function removeAssignments(assignmentIds: string[]) {
    if (unsavedCount > 0) {
      setActionError('Save or discard pending settings before removing Attributes.');
      return;
    }
    const targets = assignments.filter((assignment) =>
      assignmentIds.includes(assignment.id),
    );
    if (targets.length === 0) return;

    setBulkSaving(true);
    setActionError('');
    setNotice('');

    try {
      const input: BulkDeleteProductTypeAttributeAssignmentsInput = {
        assignments: targets.map((assignment) => ({
          id: assignment.id,
          version: assignment.version,
        })),
      };
      const response = await fetch(
        `/api/admin/catalog/product-types/${productType.id}/attributes/bulk/remove`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          payload?.error?.message ??
            'The selected Attribute relationships could not be removed.',
        );
      }

      const removed =
        (await response.json()) as ProductTypeAttributeAssignmentRecord[];
      const removedIds = new Set(removed.map((assignment) => assignment.id));
      const returnedAttributeIds = new Set(
        removed.map((assignment) => assignment.attributeId),
      );
      setAssignments((current) =>
        current.filter((assignment) => !removedIds.has(assignment.id)),
      );
      setAvailableAttributes((current) => {
        const currentIds = new Set(current.map((attribute) => attribute.id));
        const returned = attributes.filter(
          (attribute) =>
            attribute.status === 'ACTIVE' &&
            returnedAttributeIds.has(attribute.id) &&
            !currentIds.has(attribute.id),
        );
        return [...current, ...returned];
      });
      setSelectedAssignmentIds([]);
      setNotice(
        `${removed.length} Attribute relationship${removed.length === 1 ? '' : 's'} removed.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'The selected Attribute relationships could not be removed.',
      );
    } finally {
      setBulkSaving(false);
    }
  }

  async function saveDefinition() {
    const name = definitionName.trim();
    if (!name) {
      setActionError('Product Type name is required.');
      return;
    }

    setDefinitionSaving(true);
    setActionError('');
    setNotice('');

    try {
      const updated = await patchJson<ProductTypeRecord>(
        `/api/admin/catalog/product-types/${productType.id}`,
        {
          version: productType.version,
          name,
          slug: name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
          description: definitionDescription.trim() || null,
        },
      );
      replaceProductType(updated);
      setEditingDefinition(false);
      setNotice('Product Type definition saved.');
    } catch (error) {
      setActionError(messageFor(error, 'The Product Type definition could not be saved.'));
    } finally {
      setDefinitionSaving(false);
    }
  }

  async function saveRequirements() {
    setRequirementsSaving(true);
    setActionError('');
    setNotice('');

    try {
      const input: UpdateProductTypeInput = {
        version: productType.version,
        ...requirements,
      };
      const updated = await patchJson<ProductTypeRecord>(
        `/api/admin/catalog/product-types/${productType.id}/marketplace-rules`,
        input,
      );
      replaceProductType(updated);
      setRequirements({
        brandRequirement: updated.brandRequirement,
        identifierRequirement: updated.identifierRequirement,
        gtinRequirement: updated.gtinRequirement,
        oemReferenceRequirement: updated.oemReferenceRequirement,
        crossReferenceRequirement: updated.crossReferenceRequirement,
        fitmentRequirement: updated.fitmentRequirement,
        imageRequirement: updated.imageRequirement,
        minimumImageCount: updated.minimumImageCount,
        maximumImageCount: updated.maximumImageCount,
        documentRequirement: updated.documentRequirement,
        minimumDocumentCount: updated.minimumDocumentCount,
        priceRequirement: updated.priceRequirement,
        stockRequirement: updated.stockRequirement,
        conditionRequirement: updated.conditionRequirement,
        warrantyRequirement: updated.warrantyRequirement,
      });
      setNotice('Article & listing requirements saved.');
    } catch (error) {
      setActionError(
        messageFor(error, 'Article & listing requirements could not be saved.'),
      );
    } finally {
      setRequirementsSaving(false);
    }
  }

  async function publishProductType() {
    if (!readiness.publishable) return;
    if (unsavedCount > 0 || bulkSaving) {
      setActionError('Save All Changes before continuing.');
      return;
    }

    setPublishing(true);
    setActionError('');
    setNotice('');

    let publicationAccepted = false;
    try {
      const published = await postJson<ProductTypeSchemaVersionRecord>(
        `/api/admin/catalog/product-types/${productType.id}/schemas/publish`,
        { productTypeVersion: productType.version } satisfies PublishProductTypeSchemaInput,
      );
      publicationAccepted = true;

      // A successful schema POST must not be shown as Active until the actual
      // saved Product Type and its assignments confirm the transition.
      const [recordResponse, assignmentsResponse] = await Promise.all([
        fetch(`/api/admin/catalog/product-types/${productType.id}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        fetch(`/api/admin/catalog/product-types/${productType.id}/attributes`, {
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      ]);
      if (!recordResponse.ok || !assignmentsResponse.ok) {
        throw new Error('Reload the Product Type to verify its saved publication status.');
      }

      const savedProductType =
        (await recordResponse.json()) as ProductTypeRecord;
      const savedAssignments =
        (await assignmentsResponse.json()) as ProductTypeAttributeAssignmentRecord[];
      const verificationError = productTypePublicationVerificationError({
        productType: savedProductType,
        assignments: savedAssignments,
        expectedProductTypeId: productType.id,
        expectedSchemaId: published.id,
        expectedAssignmentIds: publishableAssignments.map((assignment) => assignment.id),
      });
      if (verificationError) {
        setActionError(verificationError);
        return;
      }

      replaceProductType(savedProductType);
      setAssignments(savedAssignments);

      setNotice(
        `Product Type activated with published schema version ${published.schemaVersion}. Status verified from saved data.`,
      );
    } catch (error) {
      setActionError(
        publicationAccepted
          ? `The schema publication request succeeded, but activation could not be verified. ${messageFor(error, 'Reload the Product Type to check its saved status.')}`
          : messageFor(error, 'The Product Type could not be published.'),
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <section className="product-type-technical">
        <div className="catalog-state">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading Technical Attributes…</p>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="product-type-technical">
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      </section>
    );
  }

  return (
    <section className="product-type-technical">
      <div className="product-type-technical__heading" id="product-type-definition">
        <div>
          <span className="eyebrow">Technical definition</span>
          {false && editingDefinition ? (
            <div className="product-type-definition-edit">
              <label className="field">
                <span className="field__label">Product Type name</span>
                <div className="field__control">
                  <input
                    value={definitionName}
                    maxLength={140}
                    onChange={(event) => setDefinitionName(event.target.value)}
                  />
                </div>
              </label>
              <label className="field">
                <span className="field__label">Description</span>
                <textarea
                  className="product-type-definition-edit__description"
                  value={definitionDescription}
                  maxLength={2000}
                  onChange={(event) => setDefinitionDescription(event.target.value)}
                />
              </label>
              <div className="product-type-definition-edit__actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={definitionSaving || !definitionName.trim()}
                  onClick={() => void saveDefinition()}
                >
                  {definitionSaving ? 'Saving…' : 'Save definition'}
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={definitionSaving}
                  onClick={() => {
                    setDefinitionName(productType.name);
                    setDefinitionDescription(productType.description ?? '');
                    setEditingDefinition(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="product-type-definition-title">
                <h2>{productType.name}</h2>

              </div>
              <p>{productType.description || 'No description yet.'}</p>
            </>
          )}
        </div>
      </div>

      <section className="product-type-requirements-panel" id="product-type-requirements">
        <div className="product-type-requirements-panel__heading">
          <div>
            <span className="eyebrow">Seller workflow contract</span>
            <h3>Article & listing requirements</h3>
            <p>
              Decide what an actual seller-submitted article and listing must provide.
              These controls do not create technical Attributes.
            </p>
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={requirementsSaving}
            onClick={() => void saveRequirements()}
          >
            {requirementsSaving ? 'Saving…' : 'Save requirements'}
          </button>
        </div>
        <ProductTypeRequirementFields
          value={requirements}
          onChange={setRequirements}
          disabled={requirementsSaving}
        />
      </section>

      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert--success" role="status">
          {notice}
        </div>
      ) : null}

      <section className="product-type-attribute-library" id="product-type-attributes">
        <div className="product-type-attribute-library__toolbar">
          <label className="field">
            <span className="field__label">Search Attribute Library</span>
            <div className="field__control">
              <input
                type="search"
                value={search}
                placeholder="Width, material, voltage, diameter…"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setGroupKey('ALL');
                  setAvailablePage(1);
                }}
              />
            </div>
          </label>
          <div className="product-type-attribute-library__selection">
            <strong>{selectedAvailableIds.length}</strong>
            <span>selected</span>
            <button
              className="button button--primary"
              type="button"
              disabled={adding || selectedAvailableIds.length === 0}
              onClick={() => void addSelectedAttributes()}
            >
              {adding ? 'Adding…' : 'Add selected'}
            </button>
          </div>
        </div>

        <div className="product-type-attribute-browser product-type-attribute-browser--table">
          <div className="product-type-attribute-browser__controls">
            <div className="field">
              <span className="field__label">Attribute Group</span>
              <AdminSearchableCombobox
                id="product-type-attribute-group"
                value={groupKey}
                options={[
                  {
                    id: 'ALL',
                    label: 'All Attribute Groups',
                    meta: `${availableAttributes.length} available`,
                  },
                  ...availableGroups.map(({ group, attributes: groupAttributes }) => ({
                    id: group?.id ?? 'UNGROUPED',
                    label: group?.name ?? 'Ungrouped',
                    meta: `${groupAttributes.length} available`,
                    keywords: group?.code ? [group.code] : undefined,
                  })),
                ]}
                placeholder="All Attribute Groups"
                searchPlaceholder="Search Attribute Groups…"
                onChange={setGroupKey}
              />
            </div>

            <div className="product-type-attribute-browser__group-actions">
              <span>
                {groupKey === 'ALL'
                  ? `${visibleAvailableAttributes.length} Attributes`
                  : `${selectedAvailableGroup?.group?.name ?? 'Ungrouped'} · ${visibleAvailableAttributes.length}`}
              </span>
              {groupKey !== 'ALL' && visibleAvailableAttributes.length > 0 ? (
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() =>
                    toggleAvailableGroup(
                      visibleAvailableAttributes.map((attribute) => attribute.id),
                    )
                  }
                >
                  {visibleAvailableAttributes.every((attribute) =>
                    selectedAvailableIds.includes(attribute.id),
                  )
                    ? 'Clear group'
                    : 'Select group'}
                </button>
              ) : null}
            </div>
          </div>

          {visibleAvailableAttributes.length > 0 ? (
            <>
              <div className="product-type-attribute-table">
                <div
                  className="product-type-attribute-table__row product-type-attribute-table__row--header"
                  aria-hidden="true"
                >
                  <span />
                  <span>Attribute</span>
                  <span>Group</span>
                  <span>Type</span>
                  <span>Unit</span>
                </div>

                {availablePageItems.map((attribute) => {
                  const group = attribute.groupId
                    ? groupsById.get(attribute.groupId)
                    : null;
                  const selected = selectedAvailableIds.includes(attribute.id);

                  return (
                    <label
                      className={
                        selected
                          ? 'product-type-attribute-table__row is-selected'
                          : 'product-type-attribute-table__row'
                      }
                      key={attribute.id}
                    >
                      <span className="product-type-attribute-table__check">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleAvailable(attribute.id)}
                        />
                      </span>
                      <span className="product-type-attribute-table__identity">
                        <strong>{attribute.name}</strong>
                        <small>{attribute.code}</small>
                      </span>
                      <span>{group?.name ?? 'Ungrouped'}</span>
                      <span>{pretty(attribute.dataType)}</span>
                      <span>{attribute.unit || '—'}</span>
                    </label>
                  );
                })}
              </div>

              <div className="product-type-attribute-browser__pagination">
                <span>
                  Showing{' '}
                  {(availablePage - 1) * ATTRIBUTE_BROWSER_PAGE_SIZE + 1}–
                  {Math.min(
                    availablePage * ATTRIBUTE_BROWSER_PAGE_SIZE,
                    visibleAvailableAttributes.length,
                  )}{' '}
                  of {visibleAvailableAttributes.length}
                </span>
                <div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={availablePage <= 1}
                    onClick={() =>
                      setAvailablePage((current) => Math.max(1, current - 1))
                    }
                  >
                    Previous
                  </button>
                  <strong>
                    Page {availablePage} of {availablePageCount}
                  </strong>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={availablePage >= availablePageCount}
                    onClick={() =>
                      setAvailablePage((current) =>
                        Math.min(availablePageCount, current + 1),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="catalog-empty">
              <h3>No available Attributes</h3>
              <p>
                {availableAttributes.length === 0
                  ? 'Every master Attribute is already assigned.'
                  : 'No Attributes match this search and group filter.'}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="assigned-attributes-section">
        <div className="assigned-attributes-section__heading">
          <div>
            <span className="eyebrow">Assigned Attributes</span>
            <h3>{assignments.length} configured</h3>
            <small className="assigned-attributes-unsaved" role="status">
              {unsavedCount > 0 ? `${unsavedCount} unsaved Attribute configuration(s)` : 'All settings saved'}
            </small>
          </div>
          {selectedAssignmentIds.length > 0 ? (
            <div className="assigned-attributes-bulk">
              <span>{selectedAssignmentIds.length} selected</span>
              <button
                className="button button--quiet"
                type="button"
                disabled={bulkSaving}
                onClick={() =>
                  bulkUpdateAssignments({ requirement: 'MANDATORY' })
                }
              >
                Mandatory
              </button>
              <button
                className="button button--quiet"
                type="button"
                disabled={bulkSaving}
                onClick={() =>
                  bulkUpdateAssignments({ requirement: 'OPTIONAL' })
                }
              >
                Optional
              </button>
              <button
                className="button button--quiet"
                type="button"
                disabled={bulkSaving}
                onClick={() => bulkUpdateAssignments({ filterable: true })}
              >
                Filterable
              </button>
              <button
                className="button button--quiet"
                type="button"
                disabled={bulkSaving}
                onClick={() => bulkUpdateAssignments({ comparable: true })}
              >
                Comparable
              </button>
              <button
                className="button button--quiet assigned-attributes-bulk__remove"
                type="button"
                disabled={bulkSaving || unsavedCount > 0}
                onClick={() => void removeAssignments(selectedAssignmentIds)}
              >
                Remove selected
              </button>
            </div>
          ) : null}
        </div>

        {attributeDraftState.error ? (
          <div className="alert alert--error" role="alert">
            {attributeDraftState.error}
          </div>
        ) : null}
        {unsavedCount > 0 ? (
          <div className="assigned-attributes-savebar" role="group" aria-label="Attribute settings actions">
            <span>{unsavedCount} / {MAX_ATTRIBUTE_SETTINGS_PER_SAVE} Attributes staged. Settings stay local until you save them together.</span>
            <button className="button button--quiet" type="button" disabled={bulkSaving}
              onClick={() => setAttributeDraftState({ drafts: {}, error: '' })}>Discard Changes</button>
            <button className="button button--primary" type="button" disabled={bulkSaving}
              onClick={() => void saveAllAttributeSettings()}>
              {bulkSaving ? 'Saving…' : `Save All Changes (${unsavedCount})`}
            </button>
          </div>
        ) : null}
        {assignments.length === 0 ? (
          <div className="catalog-empty assigned-attributes-empty">
            <h3>No Attributes assigned yet</h3>
            <p>
              The Attribute Library is already open above. Select the technical
              Attributes this Product Type needs and add them.
            </p>
          </div>
        ) : (
          <div className="assigned-attributes-table">
            <div className="assigned-attributes-table__head">
              <span />
              <span>Attribute</span>
              <span>Group</span>
              <span>Requirement</span>
              <span>Search</span>
              <span>Filter</span>
              <span>Compare</span>
              <span>Order</span>
              <span>State</span>
              <span />
            </div>

            {sortedAssignments.map((assignment) => {
              const attribute = attributesById.get(assignment.attributeId);
              const group = attribute?.groupId
                ? groupsById.get(attribute.groupId)
                : null;
              const effective = { ...assignment, ...attributeDrafts[assignment.id] };
              const hasUnsavedChanges = Boolean(attributeDrafts[assignment.id]);
              const rowSaving = bulkSaving;

              return (
                <div
                  className={hasUnsavedChanges
                    ? 'assigned-attributes-table__row is-unsaved'
                    : 'assigned-attributes-table__row'}
                  key={assignment.id}
                >
                  <label className="assigned-attributes-table__select">
                    <input
                      type="checkbox"
                      checked={selectedAssignmentIds.includes(assignment.id)}
                      onChange={() =>
                        setSelectedAssignmentIds((current) =>
                          current.includes(assignment.id)
                            ? current.filter((id) => id !== assignment.id)
                            : [...current, assignment.id],
                        )
                      }
                    />
                  </label>

                  <div className="assigned-attributes-table__identity">
                    <strong>{attribute?.name ?? assignment.attributeId}</strong>
                    {hasUnsavedChanges ? <small className="assigned-attributes-unsaved">Unsaved</small> : null}
                    <small>
                      {attribute?.code ?? assignment.attributeId}
                      {attribute?.unit ? ` · ${attribute.unit}` : ''}
                    </small>
                    <details className="assigned-attributes-advanced">
                      <summary>More settings</summary>
                      <label>
                        Display
                        <select value={effective.displayMode} disabled={rowSaving}
                          onChange={(event) => stageAssignment(assignment, {
                            displayMode: event.target.value as ProductTypeAttributeAssignmentRecord['displayMode'],
                          })}>
                          <option value="VISIBLE">Visible</option>
                          <option value="HIDDEN">Hidden</option>
                          <option value="READ_ONLY">Read only</option>
                        </select>
                      </label>
                      {([
                        ['variantDefining', 'Variant defining'],
                        ['marketplaceVisible', 'Marketplace visible'],
                        ['sellerEditable', 'Seller editable'],
                      ] as const).map(([key, label]) => (
                        <label key={key}>
                          <input type="checkbox" checked={effective[key]} disabled={rowSaving}
                            onChange={(event) => stageAssignment(assignment, { [key]: event.target.checked })} />
                          {label}
                        </label>
                      ))}
                    </details>
                  </div>

                  <span className="assigned-attributes-table__group">
                    {group?.name ?? 'Ungrouped'}
                  </span>

                  <select
                    className="assigned-attributes-table__requirement"
                    value={effective.requirement}
                    disabled={rowSaving}
                    onChange={(event) =>
                      stageAssignment(assignment, {
                        requirement: event.target.value as ProductTypeAttributeRequirement,
                      })
                    }
                  >
                    <option value="MANDATORY">Mandatory</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>

                  <InlineFlag
                    label="Searchable"
                    checked={effective.searchable}
                    disabled={rowSaving}
                    onChange={(checked) =>
                      stageAssignment(assignment, { searchable: checked })
                    }
                  />
                  <InlineFlag
                    label="Filterable"
                    checked={effective.filterable}
                    disabled={rowSaving}
                    onChange={(checked) =>
                      stageAssignment(assignment, { filterable: checked })
                    }
                  />
                  <InlineFlag
                    label="Comparable"
                    checked={effective.comparable}
                    disabled={rowSaving}
                    onChange={(checked) =>
                      stageAssignment(assignment, { comparable: checked })
                    }
                  />

                  <input
                    className="assigned-attributes-table__order"
                    type="number"
                    min="0"
                    value={effective.displayOrder}
                    disabled={rowSaving}
                    onChange={(event) => {
                      const order = Number(event.target.value);
                      if (Number.isInteger(order) && order >= 0) {
                        stageAssignment(assignment, { displayOrder: order });
                      }
                    }}
                  />

                  <span
                    className={`category-status category-status--${assignment.status.toLowerCase()}`}
                  >
                    {rowSaving ? 'saving' : assignment.status.toLowerCase()}
                  </span>

                  <button
                    className="button button--quiet assigned-attributes-table__remove"
                    type="button"
                    disabled={rowSaving || bulkSaving || unsavedCount > 0}
                    onClick={() => void removeAssignments([assignment.id])}
                    aria-label={`Remove ${attribute?.name ?? 'Attribute'} from this Product Type`}
                    title="Remove Attribute relationship"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>


    </section>
  );
}

function InlineFlag({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="assigned-attributes-table__flag" title={label}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ReadinessCheck({
  ready,
  label,
  href,
  actionLabel,
}: {
  ready: boolean;
  label: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <span className={ready ? 'is-ready' : ''}>
      <b>{ready ? '✓' : '○'}</b>
      <span>{label}</span>
      {!ready ? <a href={href}>{actionLabel}</a> : null}
    </span>
  );
}

function pretty(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ClientApiError ? error.message : fallback;
}
