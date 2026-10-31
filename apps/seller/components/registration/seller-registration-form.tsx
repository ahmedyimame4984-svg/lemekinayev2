'use client';

import Link from 'next/link';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import {
  DocumentPreview,
  DocumentField,
  Field,
  RegistrationProgress,
  RegistrationSuccess,
  ReviewItem,
  ReviewSection,
} from './registration-ui';
import { ReactSelect } from '../common/react-select';
import { ClientApiError, getJson, patchFormData, patchJson, postFormData } from '@/lib/client-api';
import {
  type SellerApplicationWorkspace,
  type ApplicationDocumentRecord,
} from '@/lib/seller-application-workspace';
import { SellerApplicationTracker } from './seller-application-tracker';

const steps = ['Contact', 'Business', 'Registration & Tax', 'Documents', 'Review'];

const sellerTypes = [
  ['IMPORTER', 'Importer'],
  ['DISTRIBUTOR', 'Distributor'],
  ['WHOLESALER', 'Wholesaler'],
  ['RETAILER', 'Retailer'],
  ['HYBRID', 'Hybrid'],
  ['OTHER', 'Other'],
] as const;

interface RegistrationValues {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessName: string;
  displayName: string;
  sellerType: string;
  businessEmail: string;
  businessPhone: string;
  region: string;
  city: string;
  address: string;
  commercialRegistrationNumber: string;
  tradeLicenseNumber: string;
  tinNumber: string;
  vatRegistrationNumber: string;
}

interface RegistrationFiles {
  commercialRegistrationDocument: File | null;
  tradeLicenseDocument: File | null;
  tinCertificateDocument: File | null;
  vatRegistrationDocument: File | null;
}

interface SubmissionResult {
  referenceCode: string;
  submittedAt: string;
}

const initialValues: RegistrationValues = {
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  businessName: '',
  displayName: '',
  sellerType: 'RETAILER',
  businessEmail: '',
  businessPhone: '',
  region: '',
  city: '',
  address: '',
  commercialRegistrationNumber: '',
  tradeLicenseNumber: '',
  tinNumber: '',
  vatRegistrationNumber: '',
};

const initialFiles: RegistrationFiles = {
  commercialRegistrationDocument: null,
  tradeLicenseDocument: null,
  tinCertificateDocument: null,
  vatRegistrationDocument: null,
};

export function SellerRegistrationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [files, setFiles] = useState(initialFiles);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountEmail, setAccountEmail] = useState('');
  const [draftVersion, setDraftVersion] = useState(0);
  const [savedDocuments, setSavedDocuments] = useState<ApplicationDocumentRecord[]>([]);
  const [application, setApplication] = useState<SellerApplicationWorkspace['application']>(null);
  const [editing, setEditing] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  useEffect(() => {
    let active = true;
    void getJson<SellerApplicationWorkspace>('/api/seller/application/workspace')
      .then(workspace => {
        if (!active) return;
        setAccountEmail(workspace.contactEmail);
        setValues(current => ({
          ...current,
          ...(workspace.draft?.values ?? {}),
          ...(workspace.application ?? {}),
          contactEmail: workspace.contactEmail,
        }));
        setStep(workspace.application ? 0 : Math.min(4, Math.max(0, workspace.draft?.step ?? 0)));
        setDraftVersion(workspace.draft?.version ?? 0);
        setSavedDocuments(workspace.application?.documents ?? workspace.draft?.documents ?? []);
        setApplication(workspace.application);
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load your application.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function persistDraft(nextStep: number) {
    if (application) return;
    const draftFields = Object.fromEntries(
      Object.entries(values).filter(([key]) => key !== 'contactEmail'),
    );
    const updated = await patchJson<{ version: number; step: number }>(
      '/api/seller/application/draft', {
        step: nextStep,
        version: draftVersion,
        values: draftFields,
      },
    );
    setDraftVersion(updated.version);
  }

  async function persistDocuments() {
    if (application || Object.values(files).every(file => !file)) return;
    const upload = new FormData();
    Object.entries(files).forEach(([key, file]) => {
      if (file) upload.append(key, file);
    });
    const updated = await postFormData<{ documents: ApplicationDocumentRecord[] }>(
      '/api/seller/application/draft/documents', upload,
    );
    setSavedDocuments(updated.documents);
    setFiles(initialFiles);
  }

  async function saveProgress(nextStep = step) {
    setBusy(true);
    setError('');
    setSaveNotice('');
    try {
      await persistDraft(nextStep);
      await persistDocuments();
      setSaveNotice('Your progress is saved securely. You can continue later.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your progress.');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const documentTypes = [
    'COMMERCIAL_REGISTRATION', 'TRADE_LICENSE', 'TIN_CERTIFICATE', 'VAT_REGISTRATION',
  ] as const;

  const allDocumentsPresent = documentTypes.every((type, index) =>
    Boolean(Object.values(files)[index]) ||
    savedDocuments.some(doc => doc.documentType === type),
  );

  function updateValue(field: keyof RegistrationValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function continueToNextStep() {
    setError('');
    if (!formRef.current?.reportValidity()) return;
    if (step === 3 && !allDocumentsPresent) {
      setError('Upload all four required verification documents to continue.');
      return;
    }
    const next = Math.min(step + 1, steps.length - 1);
    try {
      if (!application) await saveProgress(next);
      setStep(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Keep the Seller on the current step when save fails.
    }
  }

  function goBack() {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectDocument(
    field: keyof RegistrationFiles,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > 8 * 1024 * 1024) {
      event.target.value = '';
      setError('Each verification document must be 8 MB or smaller.');
      return;
    }
    setError('');
    setFiles((current) => ({ ...current, [field]: file }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!termsAccepted) {
      setError('Please confirm the Seller declaration before submitting.');
      return;
    }
    if (!allDocumentsPresent) {
      setError('All four verification documents are required.');
      return;
    }

    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (key !== 'contactEmail') body.append(key, value);
    });
    if (application) body.append('version', String(application.version));
    Object.entries(files).forEach(([key, file]) => {
      if (file) body.append(key, file);
    });
    body.append('termsAccepted', 'true');

    setBusy(true);
    try {
      if (application) {
        await patchFormData('/api/seller/application/account-edit', body);
        const latest = await getJson<SellerApplicationWorkspace>('/api/seller/application/workspace');
        setApplication(latest.application);
        setSavedDocuments(latest.application?.documents ?? []);
        setEditing(false);
        setSaveNotice('Application changes saved and sent for review.');
      } else {
        const response = await postFormData<SubmissionResult>(
          '/api/seller/registration', body,
        );
        setResult(response);
      }
    } catch (requestError) {
      setError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'Your Seller application could not be submitted.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div role="status" className="mx-auto max-w-4xl p-8 text-sm text-slate-600">Restoring your application…</div>;
  }
  if (application && !editing) {
    return <div className="px-4 py-8 sm:px-6"><SellerApplicationTracker
      application={application}
      onEdit={() => { setEditing(true); setStep(0); setError(''); }}
    /></div>;
  }
  if (result) {
    return <RegistrationSuccess result={result} email={accountEmail} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-7 text-center">
        <p className="text-sm font-semibold text-[#a71920]">Lemekinaye Seller</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Register your business
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Submit your business information and the four required documents.
          You can track verification status from your Seller dashboard.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Back to your account{' '}
          <Link href="/dashboard" className="font-semibold text-[#a71920] hover:underline">
            Seller dashboard
          </Link>
        </p>
      </div>

      <RegistrationProgress currentStep={step} />
      {saveNotice ? <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{saveNotice}</p> : null}
      {application ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Changes are allowed until Admin starts review. If review begins while you edit, your next save will be rejected safely.
      </p> : null}

      <form
        ref={formRef}
        onSubmit={submit}
        className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {steps[step]}
          </h2>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {error ? (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          {step === 0 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Full name"
                value={values.contactName}
                onChange={(value) => updateValue('contactName', value)}
                autoComplete="name"
              />
              <label className="block text-sm font-medium text-slate-800">
                Verified account email
                <input type="email" value={accountEmail} readOnly aria-readonly="true"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600" />
                <span className="mt-1 block text-xs font-normal text-slate-500">Managed in account settings, not this application.</span>
              </label>
              <Field
                label="Phone number"
                value={values.contactPhone}
                onChange={(value) => updateValue('contactPhone', value)}
                placeholder="+251 9..."
                autoComplete="tel"
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Registered business name"
                value={values.businessName}
                onChange={(value) => updateValue('businessName', value)}
              />
              <Field
                label="Marketplace display name"
                value={values.displayName}
                onChange={(value) => updateValue('displayName', value)}
              />

              <div className="sm:col-span-2">
                <ReactSelect
                  label="Seller type"
                  options={sellerTypes.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={values.sellerType}
                  isClearable={false}
                  onChange={(option) =>
                    updateValue('sellerType', String(option?.value ?? ''))
                  }
                />
              </div>

              <Field
                label="Business email"
                type="email"
                value={values.businessEmail}
                onChange={(value) => updateValue('businessEmail', value)}
                autoComplete="email"
              />
              <Field
                label="Business phone"
                value={values.businessPhone}
                onChange={(value) => updateValue('businessPhone', value)}
                placeholder="+251 9..."
                autoComplete="tel"
              />
              <Field
                label="Region"
                value={values.region}
                onChange={(value) => updateValue('region', value)}
                autoComplete="address-level1"
              />
              <Field
                label="City"
                value={values.city}
                onChange={(value) => updateValue('city', value)}
                autoComplete="address-level2"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Physical business address"
                  value={values.address}
                  onChange={(value) => updateValue('address', value)}
                  autoComplete="street-address"
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Commercial registration number"
                value={values.commercialRegistrationNumber}
                onChange={(value) =>
                  updateValue('commercialRegistrationNumber', value)
                }
              />
              <Field
                label="Trade licence number"
                value={values.tradeLicenseNumber}
                onChange={(value) => updateValue('tradeLicenseNumber', value)}
              />
              <Field
                label="TIN number"
                value={values.tinNumber}
                onChange={(value) => updateValue('tinNumber', value)}
              />
              <Field
                label="VAT registration number"
                value={values.vatRegistrationNumber}
                onChange={(value) =>
                  updateValue('vatRegistrationNumber', value)
                }
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                Upload PDF, JPG, or PNG files. Each file must be 8 MB or smaller.
              </p>
              {savedDocuments.some(doc => doc.documentType === 'COMMERCIAL_REGISTRATION') && !files.commercialRegistrationDocument ? <p className="text-xs text-emerald-800">Saved: {savedDocuments.find(doc => doc.documentType === 'COMMERCIAL_REGISTRATION')?.originalName}</p> : null}
              <DocumentField
                label="Commercial Registration Certificate"
                file={files.commercialRegistrationDocument}
                onChange={(event) =>
                  selectDocument('commercialRegistrationDocument', event)
                }
              />
              {savedDocuments.some(doc => doc.documentType === 'TRADE_LICENSE') && !files.tradeLicenseDocument ? <p className="text-xs text-emerald-800">Saved: {savedDocuments.find(doc => doc.documentType === 'TRADE_LICENSE')?.originalName}</p> : null}
              <DocumentField
                label="Trade / Business Licence"
                file={files.tradeLicenseDocument}
                onChange={(event) =>
                  selectDocument('tradeLicenseDocument', event)
                }
              />
              {savedDocuments.some(doc => doc.documentType === 'TIN_CERTIFICATE') && !files.tinCertificateDocument ? <p className="text-xs text-emerald-800">Saved: {savedDocuments.find(doc => doc.documentType === 'TIN_CERTIFICATE')?.originalName}</p> : null}
              <DocumentField
                label="TIN Certificate"
                file={files.tinCertificateDocument}
                onChange={(event) =>
                  selectDocument('tinCertificateDocument', event)
                }
              />
              {savedDocuments.some(doc => doc.documentType === 'VAT_REGISTRATION') && !files.vatRegistrationDocument ? <p className="text-xs text-emerald-800">Saved: {savedDocuments.find(doc => doc.documentType === 'VAT_REGISTRATION')?.originalName}</p> : null}
              <DocumentField
                label="VAT Registration Certificate"
                file={files.vatRegistrationDocument}
                onChange={(event) =>
                  selectDocument('vatRegistrationDocument', event)
                }
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <ReviewSection title="Contact">
                <ReviewItem label="Name" value={values.contactName} />
                <ReviewItem label="Email" value={values.contactEmail} />
                <ReviewItem label="Phone" value={values.contactPhone} />
              </ReviewSection>
              <ReviewSection title="Business">
                <ReviewItem label="Registered name" value={values.businessName} />
                <ReviewItem label="Display name" value={values.displayName} />
                <ReviewItem
                  label="Seller type"
                  value={
                    sellerTypes.find(([value]) => value === values.sellerType)?.[1] ??
                    values.sellerType
                  }
                />
                <ReviewItem label="Location" value={`${values.city}, ${values.region}`} />
              </ReviewSection>
              <ReviewSection title="Registration & tax">
                <ReviewItem
                  label="Commercial registration"
                  value={values.commercialRegistrationNumber}
                />
                <ReviewItem label="Trade licence" value={values.tradeLicenseNumber} />
                <ReviewItem label="TIN" value={values.tinNumber} />
                <ReviewItem label="VAT" value={values.vatRegistrationNumber} />
              </ReviewSection>
              <ReviewSection title="Documents">
                {(
                  [
                    [
                      'Commercial registration',
                      files.commercialRegistrationDocument,
                    ],
                    ['Trade licence', files.tradeLicenseDocument],
                    ['TIN certificate', files.tinCertificateDocument],
                    ['VAT certificate', files.vatRegistrationDocument],
                  ] as const
                ).map(([label, file]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-medium text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1">
                      {file ? (
                        <>
                          <p className="mb-2 truncate text-sm text-slate-900">
                            {file.name}
                          </p>
                          <DocumentPreview file={file} />
                        </>
                      ) : (
                        <p className="text-sm text-slate-900">
                          {savedDocuments.find(doc => doc.documentType === (
                            label === 'Commercial registration' ? 'COMMERCIAL_REGISTRATION' :
                            label === 'Trade licence' ? 'TRADE_LICENSE' :
                            label === 'TIN certificate' ? 'TIN_CERTIFICATE' : 'VAT_REGISTRATION'
                          ))?.originalName ?? '—'}
                        </p>
                      )}
                    </dd>
                  </div>
                ))}
              </ReviewSection>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#a71920]"
                />
                <span>
                  I confirm that the information and documents submitted are
                  accurate, and I agree to the Lemekinaye Seller terms and
                  verification review.
                </span>
              </label>
            </div>
          ) : null}
        </div>

        {!application ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:px-8">
            <p className="text-xs text-slate-500">Step {step + 1} of 5 · Your saved progress is linked to your account.</p>
            <button type="button" disabled={busy}
              onClick={() => { void saveProgress().catch(() => undefined); }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#a71920] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save & continue later'}
            </button>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-8">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Back
            </button>
          ) : (
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-950">Return to dashboard</Link>
          )}

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => { void continueToNextStep(); }}
              className="rounded-lg bg-[#a71920] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8f151b]"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || !termsAccepted}
              className="rounded-lg bg-[#a71920] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8f151b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Saving…' : application ? 'Save application changes' : 'Submit application'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
