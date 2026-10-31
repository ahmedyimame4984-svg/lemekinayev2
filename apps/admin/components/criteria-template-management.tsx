'use client';
import { CatalogPrimaryNav } from './catalog-primary-nav';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  AttributeDefinitionPage,
  AttributeDefinitionRecord,
  AttributeDefinitionSummary,
  AttributeGroupRecord,
  BulkCreateCriteriaTemplateItemsInput,
  CanonicalCriteriaLibraryInstallResult,
  CanonicalCriteriaLibraryStatus,
  CreateCriteriaTemplateInput,
  CriteriaTemplateItemRecord,
  CriteriaTemplatePage,
  CriteriaTemplateRecord,
  ProductTypeAttributeRequirement,
  UpdateCriteriaTemplateInput,
  UpdateCriteriaTemplateItemInput,
} from '@/lib/catalog-attribute-contracts';
import type {
  MasterDataStatus,
  ProductFamilyRecord,
} from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { useAdminPrincipal } from './admin-session';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';

type TemplateStatusFilter = 'ALL' | MasterDataStatus;

function templateCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  return normalized.length > 0 ? normalized.slice(0, 80) : '';
}

export function CriteriaTemplateManagement() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [templates, setTemplates] = useState<CriteriaTemplateRecord[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateStatus, setTemplateStatus] =
    useState<TemplateStatusFilter>('ALL');
  const [templateFamilyId, setTemplateFamilyId] = useState('');
  const [templatePageNumber, setTemplatePageNumber] = useState(1);
  const [templatePageCount, setTemplatePageCount] = useState(0);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templateReloadKey, setTemplateReloadKey] = useState(0);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState('');
  const [families, setFamilies] = useState<ProductFamilyRecord[]>([]);
  const [attributes, setAttributes] = useState<AttributeDefinitionRecord[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<
    AttributeDefinitionRecord[]
  >([]);
  const [availableSummary, setAvailableSummary] =
    useState<AttributeDefinitionSummary>({
      total: 0,
      ungrouped: 0,
      groupCounts: {},
    });
  const [groups, setGroups] = useState<AttributeGroupRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [items, setItems] = useState<CriteriaTemplateItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [canonicalStatus, setCanonicalStatus] =
    useState<CanonicalCriteriaLibraryStatus | null>(null);
  const [canonicalLoading, setCanonicalLoading] = useState(false);
  const [canonicalError, setCanonicalError] = useState('');
  const [canonicalNotice, setCanonicalNotice] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<CriteriaTemplateRecord | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MasterDataStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkGroupKey, setBulkGroupKey] = useState('ALL');
  const [bulkPageNumber, setBulkPageNumber] = useState(1);
  const [bulkPageCount, setBulkPageCount] = useState(0);
  const [bulkCandidateTotal, setBulkCandidateTotal] = useState(0);
  const [bulkCandidatesLoading, setBulkCandidatesLoading] = useState(false);
  const [bulkCandidatesError, setBulkCandidatesError] = useState('');
  const [bulkReloadKey, setBulkReloadKey] = useState(0);
  const [bulkRequirement, setBulkRequirement] =
    useState<ProductTypeAttributeRequirement>('OPTIONAL');
  const [bulkStartOrder, setBulkStartOrder] = useState('0');
  const [bulkSearchable, setBulkSearchable] = useState(false);
  const [bulkFilterable, setBulkFilterable] = useState(false);
  const [bulkComparable, setBulkComparable] = useState(false);
  const [bulkVariantDefining, setBulkVariantDefining] = useState(false);
  const [bulkMarketplaceVisible, setBulkMarketplaceVisible] = useState(true);
  const [bulkSellerEditable, setBulkSellerEditable] = useState(true);
  const [bulkStatus, setBulkStatus] = useState<MasterDataStatus>('DRAFT');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const formKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editingTemplate?.id ?? 'create',
    onEscape: closeTemplateForm,
  });

  const templateDuplicate = useLikelyDuplicate({
    enabled: formOpen && !editingTemplate,
    name,
    code,
    searchUrl: '/api/admin/catalog/criteria-templates/page',
  });

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoading(true);
        setLoadError('');

        const [familiesResponse, groupsResponse] = await Promise.all([
          fetch('/api/admin/catalog/product-families', {
            credentials: 'same-origin',
            cache: 'no-store',
          }),
          fetch('/api/admin/catalog/attribute-groups?status=ACTIVE', {
            credentials: 'same-origin',
            cache: 'no-store',
          }),
        ]);

        if (!familiesResponse.ok || !groupsResponse.ok) {
          throw new Error('Could not load Criteria Template foundations');
        }

        const [familiesData, groupsData] = await Promise.all([
          familiesResponse.json() as Promise<ProductFamilyRecord[]>,
          groupsResponse.json() as Promise<AttributeGroupRecord[]>,
        ]);

        if (!active) return;
        setFamilies(familiesData);
        setGroups(groupsData);
      } catch {
        if (active) {
          setLoadError(
            'Criteria Template foundations could not be loaded. Reload the page and try again.',
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
  }, [canManage]);

  useEffect(() => {
    if (!canManage) {
      setTemplateLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setTemplateLoading(true);
        setTemplateError('');

        const query = new URLSearchParams({
          page: String(templatePageNumber),
          pageSize: '50',
        });
        const searchValue = templateSearch.trim();
        if (searchValue) query.set('search', searchValue);
        if (templateStatus !== 'ALL') query.set('status', templateStatus);
        if (templateFamilyId) {
          query.set('productFamilyId', templateFamilyId);
        }

        const response = await fetch(
          `/api/admin/catalog/criteria-templates/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          throw new Error('Could not load Criteria Template library');
        }

        const page = (await response.json()) as CriteriaTemplatePage;
        if (!active) return;

        setTemplates(page.items);
        setTemplateTotal(page.total);
        setTemplatePageCount(page.pageCount);
        setSelectedTemplateId((current) =>
          current && !page.items.some((template) => template.id === current)
            ? ''
            : current,
        );
        if (page.pageCount > 0 && templatePageNumber > page.pageCount) {
          setTemplatePageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setTemplateError(
            'Criteria Templates could not be loaded. Change the filters or reload the page.',
          );
        }
      } finally {
        if (active) setTemplateLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    canManage,
    templateFamilyId,
    templatePageNumber,
    templateReloadKey,
    templateSearch,
    templateStatus,
  ]);

  useEffect(() => {
    if (!canManage) return;

    let active = true;

    async function loadCanonicalStatus() {
      try {
        setCanonicalError('');
        const response = await fetch(
          '/api/admin/catalog/criteria-templates/canonical-library',
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          throw new Error('Could not load canonical Criteria library status');
        }
        const status =
          (await response.json()) as CanonicalCriteriaLibraryStatus;
        if (active) setCanonicalStatus(status);
      } catch {
        if (active) {
          setCanonicalError(
            'Canonical Criteria library status could not be loaded.',
          );
        }
      }
    }

    void loadCanonicalStatus();
    return () => {
      active = false;
    };
  }, [canManage]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setItems([]);
      setAttributes([]);
      setAvailableAttributes([]);
      setAvailableSummary({ total: 0, ungrouped: 0, groupCounts: {} });
      setItemsError('');
      return;
    }

    let active = true;

    async function loadItems() {
      try {
        setItemsLoading(true);
        setItemsError('');

        const [itemsResponse, summaryResponse] = await Promise.all([
          fetch(
            `/api/admin/catalog/criteria-templates/${selectedTemplateId}/items`,
            {
              credentials: 'same-origin',
              cache: 'no-store',
            },
          ),
          fetch(
            `/api/admin/catalog/criteria-templates/${selectedTemplateId}/available-attributes/summary`,
            {
              credentials: 'same-origin',
              cache: 'no-store',
            },
          ),
        ]);

        if (!itemsResponse.ok || !summaryResponse.ok) {
          throw new Error('Could not load criteria');
        }

        const [data, summary] = await Promise.all([
          itemsResponse.json() as Promise<CriteriaTemplateItemRecord[]>,
          summaryResponse.json() as Promise<AttributeDefinitionSummary>,
        ]);

        if (!active) return;

        setItems(data);
        setAttributes(
          data.flatMap((item) => (item.attribute ? [item.attribute] : [])),
        );
        setAvailableSummary(summary);
      } catch {
        if (active) {
          setItemsError(
            'Template criteria could not be loaded. Reload and try again.',
          );
        }
      } finally {
        if (active) setItemsLoading(false);
      }
    }

    void loadItems();
    return () => {
      active = false;
    };
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!canManage || !bulkOpen || !selectedTemplateId) {
      setBulkCandidatesLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setBulkCandidatesLoading(true);
        setBulkCandidatesError('');

        const query = new URLSearchParams({
          page: String(bulkPageNumber),
          pageSize: '50',
        });
        const searchValue = bulkSearch.trim();
        if (searchValue) query.set('search', searchValue);
        if (bulkGroupKey === 'UNGROUPED') {
          query.set('ungrouped', 'true');
        } else if (bulkGroupKey && bulkGroupKey !== 'ALL') {
          query.set('groupId', bulkGroupKey);
        }

        const response = await fetch(
          `/api/admin/catalog/criteria-templates/${selectedTemplateId}/available-attributes/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          throw new Error('Could not load available Attributes');
        }

        const page = (await response.json()) as AttributeDefinitionPage;
        if (!active) return;

        setAvailableAttributes(page.items);
        setBulkCandidateTotal(page.total);
        setBulkPageCount(page.pageCount);
        if (page.pageCount > 0 && bulkPageNumber > page.pageCount) {
          setBulkPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setAvailableAttributes([]);
          setBulkCandidatesError(
            'Available Attributes could not be loaded. Change the group or search and retry.',
          );
        }
      } finally {
        if (active) setBulkCandidatesLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    bulkGroupKey,
    bulkOpen,
    bulkPageNumber,
    bulkReloadKey,
    bulkSearch,
    canManage,
    selectedTemplateId,
  ]);

  const familyById = useMemo(
    () => new Map(families.map((family) => [family.id, family])),
    [families],
  );
  const attributeById = useMemo(
    () =>
      new Map(
        [...attributes, ...availableAttributes].map((attribute) => [
          attribute.id,
          attribute,
        ]),
      ),
    [attributes, availableAttributes],
  );

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code),
      ),
    [templates],
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          (attributeById.get(a.attributeId)?.name ?? a.attributeId).localeCompare(
            attributeById.get(b.attributeId)?.name ?? b.attributeId,
          ),
      ),
    [items, attributeById],
  );

  const bulkGroupOptions = useMemo(() => {
    const options = [
      {
        key: 'ALL',
        name: 'All Attributes',
        count: availableSummary.total,
        group: null as AttributeGroupRecord | null,
      },
      ...groups
        .filter((group) => (availableSummary.groupCounts[group.id] ?? 0) > 0)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        )
        .map((group) => ({
          key: group.id,
          name: group.name,
          count: availableSummary.groupCounts[group.id] ?? 0,
          group,
        })),
    ];

    if (availableSummary.ungrouped > 0) {
      options.push({
        key: 'UNGROUPED',
        name: 'Ungrouped',
        count: availableSummary.ungrouped,
        group: null,
      });
    }

    return options;
  }, [availableSummary, groups]);

  const activeBulkGroupOption =
    bulkGroupOptions.find((option) => option.key === bulkGroupKey) ??
    bulkGroupOptions[0] ??
    null;

  async function installCanonicalLibrary() {
    setCanonicalLoading(true);
    setCanonicalError('');
    setCanonicalNotice('');

    try {
      const response = await fetch(
        '/api/admin/catalog/criteria-templates/canonical-library/install',
        {
          method: 'POST',
          credentials: 'same-origin',
        },
      );
      if (!response.ok) {
        throw new Error('Canonical Criteria library installation failed');
      }

      const result =
        (await response.json()) as CanonicalCriteriaLibraryInstallResult;
      setCanonicalStatus(result);
      setCanonicalNotice(
        `Canonical library reconciled: ${result.templates.installed}/${result.templates.expected} templates installed, ${result.productTypeTargets.resolvedCodes}/${result.productTypeTargets.expectedCodes} Product Type codes resolved, ${result.assignments.installed}/${result.assignments.expected} canonical assignments materialized.`,
      );

      setTemplatePageNumber(1);
      setTemplateReloadKey((current) => current + 1);
    } catch {
      setCanonicalError(
        'The canonical automotive Criteria library could not be installed.',
      );
    } finally {
      setCanonicalLoading(false);
    }
  }

  function resetTemplateFilters() {
    setTemplateSearch('');
    setTemplateStatus('ALL');
    setTemplateFamilyId('');
    setTemplatePageNumber(1);
    setSelectedTemplateId('');
    setBulkOpen(false);
  }

  function openCreateTemplate() {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditingTemplate(null);
    setName('');
    setCode('');
    setFamilyId('');
    setDescription('');
    setStatus('DRAFT');
    setFormError('');
    setFormOpen(true);
  }

  function openEditTemplate(template: CriteriaTemplateRecord) {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditingTemplate(template);
    setName(template.name);
    setCode(template.code);
    setFamilyId(template.productFamilyId ?? '');
    setDescription(template.description ?? '');
    setStatus(template.status);
    setFormError('');
    setFormOpen(true);
  }

  function closeTemplateForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingTemplate(null);
    setFormError('');
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!editingTemplate && !code) setCode(templateCode(value));
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      if (editingTemplate) {
        const input: UpdateCriteriaTemplateInput = {
          version: editingTemplate.version,
          name: name.trim(),
          productFamilyId: familyId || null,
          description: description.trim() || null,
          status,
        };
        await patchJson<CriteriaTemplateRecord>(
          `/api/admin/catalog/criteria-templates/${editingTemplate.id}`,
          input,
        );
      } else {
        const input: CreateCriteriaTemplateInput = {
          code: templateCode(code),
          name: name.trim(),
          productFamilyId: familyId || null,
          description: description.trim() || null,
          status,
        };
        const created = await postJson<CriteriaTemplateRecord>(
          '/api/admin/catalog/criteria-templates',
          input,
        );
        setTemplatePageNumber(1);
        setSelectedTemplateId(created.id);
      }

      setTemplateReloadKey((current) => current + 1);
      setFormOpen(false);
      setEditingTemplate(null);
    } catch (requestError) {
      if (requestError instanceof ClientApiError) {
        setFormError(requestError.message);
      } else {
        setFormError('The Criteria Template could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function reloadTemplateItemState(templateId: string) {
    const [itemsResponse, summaryResponse] = await Promise.all([
      fetch(`/api/admin/catalog/criteria-templates/${templateId}/items`, {
        credentials: 'same-origin',
        cache: 'no-store',
      }),
      fetch(
        `/api/admin/catalog/criteria-templates/${templateId}/available-attributes/summary`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        },
      ),
    ]);

    if (!itemsResponse.ok || !summaryResponse.ok) {
      throw new Error('Could not refresh Criteria Template items');
    }

    const [data, summary] = await Promise.all([
      itemsResponse.json() as Promise<CriteriaTemplateItemRecord[]>,
      summaryResponse.json() as Promise<AttributeDefinitionSummary>,
    ]);

    setItems(data);
    setAttributes(
      data.flatMap((item) => (item.attribute ? [item.attribute] : [])),
    );
    setAvailableSummary(summary);
    setBulkReloadKey((current) => current + 1);
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? { ...template, itemCount: data.length }
          : template,
      ),
    );
  }

  function openBulkSelector() {
    if (!selectedTemplate) return;
    setBulkSelectedIds([]);
    setBulkSearch('');
    setBulkGroupKey('ALL');
    setBulkPageNumber(1);
    setBulkRequirement('OPTIONAL');
    setBulkStartOrder(
      items.length === 0
        ? '0'
        : String(Math.max(...items.map((item) => item.displayOrder)) + 10),
    );
    setBulkSearchable(false);
    setBulkFilterable(false);
    setBulkComparable(false);
    setBulkVariantDefining(false);
    setBulkMarketplaceVisible(true);
    setBulkSellerEditable(true);
    setBulkStatus(
      selectedTemplate.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
    );
    setBulkError('');
    setBulkCandidatesError('');
    setBulkOpen(true);
  }

  function toggleAttribute(attributeId: string) {
    setBulkSelectedIds((current) =>
      current.includes(attributeId)
        ? current.filter((id) => id !== attributeId)
        : current.length >= 200
          ? current
          : [...current, attributeId],
    );
  }

  function togglePage(attributeIds: string[]) {
    setBulkSelectedIds((current) => {
      const selected = new Set(current);
      const allSelected = attributeIds.every((id) => selected.has(id));

      if (allSelected) {
        for (const id of attributeIds) selected.delete(id);
        return [...selected];
      }

      for (const id of attributeIds) {
        if (selected.size >= 200) break;
        selected.add(id);
      }
      return [...selected];
    });
  }

  async function addBulkCriteria() {
    if (!selectedTemplate || bulkSelectedIds.length === 0) return;
    setBulkSaving(true);
    setBulkError('');

    try {
      const input: BulkCreateCriteriaTemplateItemsInput = {
        attributeIds: bulkSelectedIds,
        requirement: bulkRequirement,
        startDisplayOrder: Number(bulkStartOrder) || 0,
        searchable: bulkSearchable,
        filterable: bulkFilterable,
        comparable: bulkComparable,
        variantDefining: bulkVariantDefining,
        marketplaceVisible: bulkMarketplaceVisible,
        sellerEditable: bulkSellerEditable,
        status: bulkStatus,
      };

      await postJson<CriteriaTemplateItemRecord[]>(
        `/api/admin/catalog/criteria-templates/${selectedTemplate.id}/items/bulk`,
        input,
      );
      await reloadTemplateItemState(selectedTemplate.id);
      setBulkOpen(false);
      setBulkSelectedIds([]);
    } catch (requestError) {
      if (requestError instanceof ClientApiError) {
        setBulkError(requestError.message);
      } else {
        setBulkError('The selected criteria could not be added.');
      }
    } finally {
      setBulkSaving(false);
    }
  }

  async function toggleItemStatus(item: CriteriaTemplateItemRecord) {
    if (!selectedTemplate) return;
    const nextStatus: MasterDataStatus =
      item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      const input: UpdateCriteriaTemplateItemInput = {
        version: item.version,
        status: nextStatus,
      };
      await patchJson<CriteriaTemplateItemRecord>(
        `/api/admin/catalog/criteria-templates/${selectedTemplate.id}/items/${item.id}`,
        input,
      );
      await reloadTemplateItemState(selectedTemplate.id);
    } catch (requestError) {
      setItemsError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'The criterion status could not be changed.',
      );
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Catalog management</span>
        <h1>Criteria Templates</h1>
        <p>Your administrator account does not have catalog.manage permission.</p>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <AdminPageHeader
        eyebrow="Advanced catalog tools"
        title="Criteria Templates"
        description="Build reusable automotive specification sets from canonical Attributes, then apply them safely to Product Types."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={openCreateTemplate}
          >
            + New Template
          </button>
        }
      />

      <CatalogPrimaryNav active="advanced" />

      <section
        className="criteria-template-card canonical-criteria-card"
        aria-labelledby="canonical-criteria-title"
      >
        <div className="criteria-template-card__heading">
          <div>
            <span className="eyebrow">Canonical automotive library</span>
            <h2 id="canonical-criteria-title">Professional criteria baseline</h2>
            <p>
              Reconcile the governed CANON_* Template library against the
              current Master Attributes and real Admin-created Product Types.
              Canonical criteria are materialized as Product Type Attribute
              assignments; unrelated Admin-specific assignments are preserved.
              Missing Product Type codes are reported and never fabricated.
            </p>
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={canonicalLoading || canonicalStatus?.valid === false}
            onClick={() => void installCanonicalLibrary()}
          >
            {canonicalLoading ? 'Installing…' : 'Install / refresh library'}
          </button>
        </div>

        {canonicalError ? (
          <div className="alert alert--error" role="alert">
            {canonicalError}
          </div>
        ) : null}

        {canonicalNotice ? (
          <div className="alert alert--success" role="status">
            {canonicalNotice}
          </div>
        ) : null}

        {canonicalStatus ? (
          <div className="schema-publication-summary canonical-criteria-summary">
            <div>
              <span>Templates</span>
              <strong>
                {canonicalStatus.templates.installed}/
                {canonicalStatus.templates.expected}
              </strong>
            </div>
            <div>
              <span>Canonical Attributes</span>
              <strong>
                {canonicalStatus.attributes.resolved}/
                {canonicalStatus.attributes.expected}
              </strong>
            </div>
            <div>
              <span>Resolved Product Types</span>
              <strong>
                {canonicalStatus.productTypeTargets.resolvedCodes}/
                {canonicalStatus.productTypeTargets.expectedCodes}
              </strong>
            </div>
            <div>
              <span>Canonical Assignments</span>
              <strong>
                {canonicalStatus.assignments.installed}/
                {canonicalStatus.assignments.expected}
              </strong>
            </div>
          </div>
        ) : null}

        {canonicalStatus?.productTypeTargets.unmatchedCodes.length ? (
          <div className="vehicle-form__context">
            Not yet present in the real catalog:{' '}
            {canonicalStatus.productTypeTargets.unmatchedCodes.join(', ')}.
            Their canonical Templates stay Draft until those Product Types are
            created.
          </div>
        ) : null}
      </section>

      {formOpen ? (
        <form
          className="category-form"
          ref={formKeyboard.ref}
          onKeyDown={formKeyboard.onKeyDown}
          onSubmit={saveTemplate}
        >
          <div className="category-form__heading">
            <div>
              <span className="eyebrow">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </span>
              <h2>
                {editingTemplate
                  ? editingTemplate.name
                  : 'Create Criteria Template'}
              </h2>
            </div>
            <button
              className="button button--quiet"
              type="button"
              disabled={saving}
              onClick={formKeyboard.requestClose}
            >
              Cancel
            </button>
          </div>

          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="category-form__grid">
            <label className="field">
              <span className="field__label">Template name</span>
              <div className="field__control">
                <input
                  required
                  maxLength={140}
                  value={name}
                  placeholder="Brake Disc Standard Criteria"
                  onChange={(event) => handleNameChange(event.target.value)}
                />
              </div>
            </label>

            <div className="field">
              <span className="field__label">Applicable Part Group</span>
              <AdminSearchableCombobox
                id="criteria-template-family-editor"
                value={familyId}
                options={[
                  {
                    id: '',
                    label: 'Global / reusable across Part Groups',
                    meta: 'Cross-domain criteria',
                  },
                  ...families
                    .filter(
                      (family) =>
                        family.status === 'ACTIVE' ||
                        family.id === editingTemplate?.productFamilyId,
                    )
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((family) => ({
                      id: family.id,
                      label: family.name,
                      meta: family.code,
                      keywords: [family.code],
                    })),
                ]}
                placeholder="Global / reusable across Part Groups"
                searchPlaceholder="Search Part Groups…"
                onChange={setFamilyId}
              />
              <small className="field__hint">
                Choose a Part Group when this reusable criteria set belongs to
                one automotive domain; leave Global only when it is truly
                cross-domain.
              </small>
            </div>

            <label className="field category-form__description">
              <span className="field__label">Purpose and usage</span>
              <textarea
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What Product Types should use this criteria set?"
              />
            </label>

            {editingTemplate ? (
              <label className="field">
                <span className="field__label">Lifecycle status</span>
                <select
                  className="category-form__select"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as MasterDataStatus)
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
            ) : null}
          </div>

          <LikelyDuplicateWarning
            match={templateDuplicate.match}
            checking={templateDuplicate.checking}
          />

          {!editingTemplate ? (
            <div className="vehicle-form__context">
              New Criteria Templates are created as Draft. Add and review their
              criteria before activation.
            </div>
          ) : null}

          <details className="catalog-workspace-advanced">
            <summary>Advanced technical fields</summary>
            <div className="category-form__grid">
              <label className="field">
                <span className="field__label">Canonical code</span>
                <div className="field__control">
                  <input
                    required
                    disabled={Boolean(editingTemplate)}
                    maxLength={80}
                    value={code}
                    placeholder="BRAKE_DISC_STANDARD"
                    onChange={(event) =>
                      setCode(templateCode(event.target.value))
                    }
                  />
                </div>
                <small className="field__hint">
                  {editingTemplate
                    ? 'Stable identifier. It is immutable after creation.'
                    : 'Generated automatically from the Template name. Change only when governance or migration requires a specific identifier.'}
                </small>
              </label>
            </div>
          </details>

          <div className="category-form__actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner" /> Saving…
                </>
              ) : editingTemplate ? (
                'Save Template'
              ) : (
                'Create Draft Template'
              )}
            </button>
          </div>
        </form>
      ) : null}

      <div className="catalog-toolbar catalog-toolbar--filters">
        <div className="catalog-filter">
          <label htmlFor="criteria-template-search">Search</label>
          <input
            id="criteria-template-search"
            value={templateSearch}
            placeholder="Template name, code, or description"
            onChange={(event) => {
              setTemplateSearch(event.target.value);
              setTemplatePageNumber(1);
              setSelectedTemplateId('');
              setBulkOpen(false);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="criteria-template-status">Status</label>
          <select
            id="criteria-template-status"
            value={templateStatus}
            onChange={(event) => {
              setTemplateStatus(
                event.target.value as TemplateStatusFilter,
              );
              setTemplatePageNumber(1);
              setSelectedTemplateId('');
              setBulkOpen(false);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="SUPERSEDED">Superseded</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div className="catalog-filter criteria-template-family-filter">
          <label>Applicable Part Group</label>
          <AdminSearchableCombobox
            id="criteria-template-family"
            value={templateFamilyId}
            options={[
              { id: '', label: 'All Part Groups' },
              ...families
                .filter((family) => family.status === 'ACTIVE')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((family) => ({
                  id: family.id,
                  label: family.name,
                  meta: family.code,
                  keywords: [family.code],
                })),
            ]}
            placeholder="All Part Groups"
            searchPlaceholder="Search Part Groups…"
            onChange={(value) => {
              setTemplateFamilyId(value);
              setTemplatePageNumber(1);
              setSelectedTemplateId('');
              setBulkOpen(false);
            }}
          />
        </div>

        <AdminFilterResetButton
          active={Boolean(
            templateSearch.trim() ||
              templateStatus !== 'ALL' ||
              templateFamilyId,
          )}
          onReset={resetTemplateFilters}
        />

        <span className="catalog-count">
          {templateTotal}{' '}
          {templateTotal === 1 ? 'template' : 'templates'}
        </span>
      </div>

      {loading ? (
        <div className="catalog-state">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading Criteria Templates…</p>
        </div>
      ) : null}

      {loadError ? (
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      ) : null}

      {!loading && !loadError ? (
        <div className="attribute-master-layout">
          <div className="attribute-list criteria-template-library">
            {templateLoading ? (
              <div className="catalog-state" aria-live="polite">
                <span className="spinner spinner--dark" aria-hidden="true" />
                <p>Loading Criteria Template library…</p>
              </div>
            ) : null}

            {templateError ? (
              <div className="alert alert--error" role="alert">
                {templateError}
              </div>
            ) : null}

            {!templateLoading &&
            !templateError &&
            sortedTemplates.length === 0 ? (
              <div className="catalog-empty">
                <h2>No Criteria Templates found</h2>
                <p>
                  Change the search or filters, or create a reusable automotive
                  criteria set.
                </p>
              </div>
            ) : null}

            {!templateLoading && !templateError && sortedTemplates.length > 0 ? (
              <div className="admin-library-table criteria-template-table">
                <div
                  className="admin-library-table__row admin-library-table__row--header criteria-template-table__row"
                  aria-hidden="true"
                >
                  <span>Template</span>
                  <span>Part Group</span>
                  <span>Criteria</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>

                {sortedTemplates.map((template) => (
                  <div
                    className={
                      selectedTemplateId === template.id
                        ? 'admin-library-table__row criteria-template-table__row is-selected'
                        : 'admin-library-table__row criteria-template-table__row'
                    }
                    key={template.id}
                  >
                    <button
                      className="criteria-template-table__select"
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setBulkOpen(false);
                      }}
                    >
                      <span className="admin-library-table__primary">
                        <strong>{template.name}</strong>
                        <small>{template.code}</small>
                      </span>
                    </button>
                    <span>
                      {template.productFamilyId
                        ? familyById.get(template.productFamilyId)?.name ??
                          'Unknown Part Group'
                        : 'Global'}
                    </span>
                    <span>{template.itemCount}</span>
                    <span>
                      <AdminStatusBadge status={template.status} />
                    </span>
                    <span className="criteria-template-table__actions">
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={() => openEditTemplate(template)}
                      >
                        Edit
                      </button>
                      <AdminMasterLifecycleActions
                        domain="CATALOG"
                        entityType="CRITERIA_TEMPLATE"
                        entityId={template.id}
                        entityName={template.name}
                        status={template.status}
                        version={template.version}
                        reactivatePath={`/api/admin/catalog/criteria-templates/${template.id}`}
                        disabled={!canManage}
                        onCompleted={() =>
                          setTemplateReloadKey((current) => current + 1)
                        }
                      />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {!templateLoading &&
            !templateError &&
            templateTotal > 0 ? (
              <div className="attribute-library-pagination">
                <span>
                  Page {templatePageCount === 0 ? 0 : templatePageNumber} of{' '}
                  {templatePageCount}
                </span>
                <div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={templatePageNumber <= 1}
                    onClick={() => {
                      setSelectedTemplateId('');
                      setBulkOpen(false);
                      setTemplatePageNumber((current) =>
                        Math.max(1, current - 1),
                      );
                    }}
                  >
                    Previous
                  </button>
                  <strong>
                    {templates.length} shown · {templateTotal} total
                  </strong>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={
                      templatePageCount === 0 ||
                      templatePageNumber >= templatePageCount
                    }
                    onClick={() => {
                      setSelectedTemplateId('');
                      setBulkOpen(false);
                      setTemplatePageNumber((current) => current + 1);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="attribute-values-panel">
            {!selectedTemplate ? (
              <div className="catalog-empty">
                <h2>Select a Template</h2>
                <p>
                  Choose a Criteria Template to manage its canonical Attribute
                  criteria.
                </p>
              </div>
            ) : (
              <>
                <div className="attribute-values-panel__heading">
                  <div>
                    <span className="eyebrow">Template criteria</span>
                    <h2>{selectedTemplate.name}</h2>
                    <p>
                      {selectedTemplate.code} · {formatAdminEnumLabel(selectedTemplate.status)}
                    </p>
                  </div>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={openBulkSelector}
                  >
                    + Add criteria
                  </button>
                </div>

                {bulkOpen ? (
                  <div className="criteria-template-authoring">
                    {bulkError ? (
                      <div className="alert alert--error" role="alert">
                        {bulkError}
                      </div>
                    ) : null}

                    <div className="attribute-bulk-summary">
                      <div>
                        <span>Assigned criteria</span>
                        <strong>{items.length}</strong>
                      </div>
                      <div>
                        <span>Available to add</span>
                        <strong>{availableSummary.total}</strong>
                      </div>
                      <div>
                        <span>Current result</span>
                        <strong>{bulkCandidateTotal}</strong>
                      </div>
                      <div>
                        <span>Technical domains</span>
                        <strong>
                          {bulkGroupOptions.filter(
                            (option) => option.key !== 'ALL',
                          ).length}
                        </strong>
                      </div>
                    </div>

                    {availableSummary.total === 0 ? (
                      <div className="vehicle-form__context">
                        Every active Product Attribute is already included in
                        this Criteria Template.
                      </div>
                    ) : null}

                    <div className="attribute-bulk-toolbar">
                      <label className="field">
                        <span className="field__label">Find Attribute</span>
                        <div className="field__control">
                          <input
                            value={bulkSearch}
                            placeholder="Search name, code, description, or unit"
                            onChange={(event) => {
                              setBulkSearch(event.target.value);
                              setBulkPageNumber(1);
                            }}
                          />
                        </div>
                      </label>
                      <label className="field">
                        <span className="field__label">Requirement</span>
                        <select
                          className="category-form__select"
                          value={bulkRequirement}
                          onChange={(event) =>
                            setBulkRequirement(
                              event.target
                                .value as ProductTypeAttributeRequirement,
                            )
                          }
                        >
                          <option value="OPTIONAL">Optional</option>
                          <option value="MANDATORY">Mandatory</option>
                        </select>
                      </label>
                      <label className="field">
                        <span className="field__label">Status</span>
                        <select
                          className="category-form__select"
                          value={bulkStatus}
                          onChange={(event) =>
                            setBulkStatus(
                              event.target.value as MasterDataStatus,
                            )
                          }
                        >
                          <option value="DRAFT">Draft</option>
                          <option
                            value="ACTIVE"
                            disabled={selectedTemplate.status !== 'ACTIVE'}
                          >
                            Active
                          </option>
                        </select>
                      </label>
                      <label className="field">
                        <span className="field__label">Start order</span>
                        <div className="field__control">
                          <input
                            type="number"
                            min="0"
                            value={bulkStartOrder}
                            onChange={(event) =>
                              setBulkStartOrder(event.target.value)
                            }
                          />
                        </div>
                      </label>
                    </div>

                    <div className="catalog-setup-note">
                      <strong>Fast path:</strong> choose a technical domain,
                      use <strong>Select page</strong> when most visible
                      Attributes are needed, keep selecting across pages, then
                      add once. One bulk action is safely limited to 200
                      Attributes.
                    </div>

                    <div className="attribute-bulk-flags">
                      {[
                        ['Searchable', bulkSearchable, setBulkSearchable],
                        ['Filterable', bulkFilterable, setBulkFilterable],
                        ['Comparable', bulkComparable, setBulkComparable],
                        [
                          'Variant-defining',
                          bulkVariantDefining,
                          setBulkVariantDefining,
                        ],
                        [
                          'Marketplace visible',
                          bulkMarketplaceVisible,
                          setBulkMarketplaceVisible,
                        ],
                        [
                          'Seller editable',
                          bulkSellerEditable,
                          setBulkSellerEditable,
                        ],
                      ].map(([label, checked, setter]) => (
                        <label key={String(label)}>
                          <input
                            type="checkbox"
                            checked={Boolean(checked)}
                            onChange={(event) =>
                              (
                                setter as (value: boolean) => void
                              )(event.target.checked)
                            }
                          />
                          {String(label)}
                        </label>
                      ))}
                    </div>

                    <div className="criteria-attribute-browser criteria-attribute-browser--compact-groups">
                      <aside className="criteria-attribute-browser__groups criteria-attribute-browser__groups--compact">
                        <div className="criteria-attribute-browser__groups-heading">
                          <strong>Technical domains</strong>
                          <small>
                            {bulkGroupOptions.filter(
                              (option) => option.key !== 'ALL',
                            ).length}{' '}
                            groups
                          </small>
                        </div>

                        <div className="criteria-attribute-domain-selector">
                          <AdminSearchableCombobox
                            id="criteria-attribute-domain"
                            value={bulkGroupKey}
                            options={bulkGroupOptions.map((option) => ({
                              id: option.key,
                              label: option.name,
                              meta: `${option.count} available`,
                              keywords: option.group?.code
                                ? [option.group.code]
                                : undefined,
                            }))}
                            placeholder="All Attributes"
                            searchPlaceholder="Search technical domains…"
                            onChange={(value) => {
                              setBulkGroupKey(value);
                              setBulkPageNumber(1);
                            }}
                          />
                        </div>

                        {activeBulkGroupOption ? (
                          <div className="criteria-attribute-domain-context">
                            <span>Current domain</span>
                            <strong>{activeBulkGroupOption.name}</strong>
                            <small>
                              {activeBulkGroupOption.count} available Attributes
                            </small>
                          </div>
                        ) : null}
                      </aside>

                      <section className="criteria-attribute-browser__content">
                        {bulkCandidatesLoading ? (
                          <div className="catalog-state" aria-live="polite">
                            <span
                              className="spinner spinner--dark"
                              aria-hidden="true"
                            />
                            <p>Loading available Attributes…</p>
                          </div>
                        ) : null}

                        {bulkCandidatesError ? (
                          <div className="alert alert--error" role="alert">
                            {bulkCandidatesError}
                          </div>
                        ) : null}

                        {!bulkCandidatesLoading &&
                        !bulkCandidatesError &&
                        activeBulkGroupOption &&
                        availableAttributes.length > 0 ? (() => {
                          const selectableIds = availableAttributes
                            .filter(
                              (attribute) =>
                                bulkStatus !== 'ACTIVE' ||
                                attribute.status === 'ACTIVE',
                            )
                            .map((attribute) => attribute.id);
                          const selectedCount = selectableIds.filter((id) =>
                            bulkSelectedIds.includes(id),
                          ).length;

                          return (
                            <>
                              <div className="criteria-attribute-browser__content-heading">
                                <div>
                                  <span className="eyebrow">
                                    Attribute group
                                  </span>
                                  <h3>{activeBulkGroupOption.name}</h3>
                                  <p>
                                    Showing {availableAttributes.length} of{' '}
                                    {bulkCandidateTotal} matching unassigned
                                    Attributes. Selections remain checked while
                                    you move between pages.
                                  </p>
                                </div>
                                <button
                                  className="button button--quiet"
                                  type="button"
                                  disabled={selectableIds.length === 0}
                                  onClick={() => togglePage(selectableIds)}
                                >
                                  {selectedCount === selectableIds.length &&
                                  selectableIds.length > 0
                                    ? 'Clear page'
                                    : 'Select page'}
                                </button>
                              </div>

                              <div className="criteria-attribute-browser__grid">
                                {availableAttributes.map((attribute) => (
                                  <label
                                    className={
                                      bulkSelectedIds.includes(attribute.id)
                                        ? 'criteria-attribute-card is-selected'
                                        : 'criteria-attribute-card'
                                    }
                                    key={attribute.id}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={bulkSelectedIds.includes(
                                        attribute.id,
                                      )}
                                      disabled={
                                        (bulkStatus === 'ACTIVE' &&
                                          attribute.status !== 'ACTIVE') ||
                                        (!bulkSelectedIds.includes(
                                          attribute.id,
                                        ) &&
                                          bulkSelectedIds.length >= 200)
                                      }
                                      onChange={() =>
                                        toggleAttribute(attribute.id)
                                      }
                                    />
                                    <span>
                                      <strong>{attribute.name}</strong>
                                      <small>{attribute.code}</small>
                                      <em>
                                        {attribute.dataType}
                                        {attribute.unit
                                          ? ` · ${attribute.unit}`
                                          : ''}
                                      </em>
                                    </span>
                                  </label>
                                ))}
                              </div>

                              {bulkCandidateTotal > 0 ? (
                                <div className="attribute-library-pagination">
                                  <span>
                                    Page{' '}
                                    {bulkPageCount === 0
                                      ? 0
                                      : bulkPageNumber}{' '}
                                    of {bulkPageCount}
                                  </span>
                                  <div>
                                    <button
                                      className="button button--quiet"
                                      type="button"
                                      disabled={bulkPageNumber <= 1}
                                      onClick={() =>
                                        setBulkPageNumber((current) =>
                                          Math.max(1, current - 1),
                                        )
                                      }
                                    >
                                      Previous
                                    </button>
                                    <strong>
                                      {availableAttributes.length} shown ·{' '}
                                      {bulkSelectedIds.length} selected
                                    </strong>
                                    <button
                                      className="button button--quiet"
                                      type="button"
                                      disabled={
                                        bulkPageCount === 0 ||
                                        bulkPageNumber >= bulkPageCount
                                      }
                                      onClick={() =>
                                        setBulkPageNumber(
                                          (current) => current + 1,
                                        )
                                      }
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          );
                        })() : !bulkCandidatesLoading &&
                          !bulkCandidatesError &&
                          availableSummary.total > 0 ? (
                          <div className="catalog-empty">
                            <h3>No Attributes match this view</h3>
                            <p>
                              Change the technical domain or clear the search
                              text.
                            </p>
                          </div>
                        ) : null}
                      </section>
                    </div>

                    {bulkSelectedIds.length >= 200 ? (
                      <div className="vehicle-form__context">
                        The safe bulk limit of 200 Attributes has been reached.
                        Add this batch, then continue with the remaining
                        Attributes.
                      </div>
                    ) : null}

                    <div className="attribute-bulk-panel__actions">
                      <button
                        className="button button--quiet"
                        type="button"
                        disabled={bulkSaving}
                        onClick={() => setBulkOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={
                          bulkSaving || bulkSelectedIds.length === 0
                        }
                        onClick={() => void addBulkCriteria()}
                      >
                        {bulkSaving
                          ? 'Adding…'
                          : `Add selected (${bulkSelectedIds.length})`}
                      </button>
                    </div>
                  </div>
                ) : null}

                {itemsLoading ? (
                  <div className="catalog-state">
                    <span
                      className="spinner spinner--dark"
                      aria-hidden="true"
                    />
                    <p>Loading Template criteria…</p>
                  </div>
                ) : null}

                {itemsError ? (
                  <div className="alert alert--error" role="alert">
                    {itemsError}
                  </div>
                ) : null}

                {!itemsLoading && !itemsError && sortedItems.length === 0 ? (
                  <div className="catalog-empty">
                    <h3>No criteria yet</h3>
                    <p>
                      Add canonical Attributes by group to define this Template.
                    </p>
                  </div>
                ) : null}

                {!itemsLoading && !itemsError && sortedItems.length > 0 ? (
                  <div className="allowed-value-list">
                    {sortedItems.map((item) => {
                      const attribute = attributeById.get(item.attributeId);
                      return (
                        <div className="allowed-value-row" key={item.id}>
                          <div>
                            <strong>
                              {attribute?.name ?? item.attributeId}
                            </strong>
                            <span>{attribute?.code ?? item.attributeId}</span>
                          </div>
                          <AdminStatusBadge status={item.status} />
                          <small>
                            {item.requirement} · Order {item.displayOrder}
                            {item.filterable ? ' · Filter' : ''}
                            {item.comparable ? ' · Compare' : ''}
                          </small>
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={
                              item.status !== 'ACTIVE' &&
                              selectedTemplate.status !== 'ACTIVE'
                            }
                            onClick={() => void toggleItemStatus(item)}
                          >
                            {item.status === 'ACTIVE'
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
