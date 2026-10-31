'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import type { ApplicantApplication } from '@/lib/application-contracts';
import { applicationCanEdit } from '@/lib/application-contracts';
import { ClientApiError, patchFormData, postJson } from '@/lib/client-api';
import { ReactSelect } from '@/components/common/react-select';
import { DocumentField, Field } from './registration-ui';

const documentTypes = [
  ['commercialRegistrationDocument', 'COMMERCIAL_REGISTRATION', 'Commercial Registration Certificate'],
  ['tradeLicenseDocument', 'TRADE_LICENSE', 'Trade / Business Licence'],
  ['tinCertificateDocument', 'TIN_CERTIFICATE', 'TIN Certificate'],
  ['vatRegistrationDocument', 'VAT_REGISTRATION', 'VAT Registration Certificate'],
] as const;

const sellerTypes = [
  ['IMPORTER', 'Importer'],
  ['DISTRIBUTOR', 'Distributor'],
  ['WHOLESALER', 'Wholesaler'],
  ['RETAILER', 'Retailer'],
  ['HYBRID', 'Hybrid'],
  ['OTHER', 'Other'],
] as const;

type EditFields = Pick<ApplicantApplication,
  | 'contactName' | 'contactEmail' | 'contactPhone'
  | 'businessName' | 'displayName' | 'sellerType'
  | 'businessEmail' | 'businessPhone' | 'region' | 'city'
  | 'address' | 'commercialRegistrationNumber' | 'tradeLicenseNumber'
  | 'tinNumber' | 'vatRegistrationNumber'
>;

function editValues(application: ApplicantApplication): EditFields {
  const {
    contactName, contactEmail, contactPhone, businessName, displayName,
    sellerType, businessEmail, businessPhone, region, city, address,
    commercialRegistrationNumber, tradeLicenseNumber, tinNumber,
    vatRegistrationNumber,
  } = application;
  return {
    contactName, contactEmail, contactPhone, businessName, displayName,
    sellerType, businessEmail, businessPhone, region, city, address,
    commercialRegistrationNumber, tradeLicenseNumber, tinNumber, vatRegistrationNumber,
  };
}

type FileField = (typeof documentTypes)[number][0];

export function ApplicationEditForm() {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicantApplication | null>(null);
  const [values, setValues] = useState<EditFields | null>(null);
  const [files, setFiles] = useState<Partial<Record<FileField, File>>>({});
  const [contactEmailCode, setContactEmailCode] = useState('');
  const [emailCodeRequested, setEmailCodeRequested] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/seller/application/status', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace('/application');
          return;
        }
        if (!response.ok) throw new Error('Could not load the application.');
        const current = (await response.json()) as ApplicantApplication;
        if (!controller.signal.aborted) {
          setApplication(current);
          setValues(editValues(current));
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(
          loadError instanceof Error ? loadError.message : 'Could not load the application.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [router]);

  function update(field: keyof EditFields, value: string) {
    setValues((current) => current ? { ...current, [field]: value } : current);
    if (field === 'contactEmail') {
      setContactEmailCode('');
      setEmailCodeRequested(false);
    }
    setError('');
  }

  function chooseFile(field: FileField, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFiles((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      event.target.value = '';
      setError('Each business verification document must be no larger than 8 MB.');
      return;
    }
    setFiles((current) => ({ ...current, [field]: file }));
  }

  async function requestEmailCode() {
    if (!values || !application) return;
    const newEmail = values.contactEmail.trim().toLowerCase();
    if (newEmail === application.contactEmail.toLowerCase()) return;
    setBusy(true);
    setError('');
    try {
      await postJson('/api/seller/application/contact-email/request', {
        contactEmail: newEmail,
      });
      setEmailCodeRequested(true);
      setNotice('If eligible, a verification code will be emailed to the new address.');
    } catch (requestError) {
      setError(requestError instanceof ClientApiError
        ? requestError.message : 'Could not request an email verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || !application || busy) return;
    setError('');
    const emailChanged =
      values.contactEmail.trim().toLowerCase() !== application.contactEmail.toLowerCase();
    if (emailChanged && !/^\d{6}$/u.test(contactEmailCode)) {
      setError('Verify your new contact email using its six-digit code.');
      return;
    }
    if (!agreed) {
      setError('Confirm the declaration before resubmitting.');
      return;
    }

    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.append(key, value);
    for (const [key, file] of Object.entries(files)) {
      if (file) data.append(key, file);
    }
    data.append('version', String(application.version));
    data.append('termsAccepted', 'true');
    if (emailChanged) data.append('contactEmailCode', contactEmailCode);

    setBusy(true);
    try {
      const result = await patchFormData<{ emailReverificationRequired: boolean }>(
        '/api/seller/application/edit',
        data,
      );
      router.replace(result.emailReverificationRequired ? '/application' : '/application/status');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ClientApiError
        ? requestError.message : 'Your updates could not be submitted. Reload and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10" role="status">Loading application…</main>;
  if (!application || !values) return <main className="mx-auto max-w-3xl px-4 py-10"><p role="alert">{error || 'Application unavailable.'}</p></main>;
  if (!applicationCanEdit(application.status)) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-semibold">Application under review</h1>
        <p className="text-sm text-slate-600">Editing is locked during review or after a final decision.</p>
        <Link href="/application/status" className="font-semibold text-[#a71920]">Return to application status</Link>
      </main>
    );
  }
  const changedEmail = values.contactEmail.trim().toLowerCase() !== application.contactEmail.toLowerCase();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/application/status" className="text-sm font-semibold text-[#a71920] hover:underline">← Application status</Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Edit your application</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reference {application.referenceCode}. Update any information before review begins or while corrections are requested.
          The application will lock again when Admin starts reviewing.
        </p>

        {application.correctionReason ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Admin feedback: {application.correctionReason}
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Contact details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={values.contactName} onChange={(v) => update('contactName', v)} />
              <Field label="Contact phone" value={values.contactPhone} onChange={(v) => update('contactPhone', v)} />
              <div className="sm:col-span-2">
                <Field label="Contact email" type="email" value={values.contactEmail} onChange={(v) => update('contactEmail', v)} />
                {changedEmail ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-900">Changing this email requires verification of the new address. Your current email session proves your existing identity.</p>
                    <button
                      type="button"
                      onClick={() => void requestEmailCode()}
                      disabled={busy}
                      className="mt-2 rounded-lg bg-[#a71920] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Send code to new email
                    </button>
                    {emailCodeRequested ? (
                      <label className="mt-3 block text-sm font-medium text-slate-700">
                        Six-digit code from new email
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          value={contactEmailCode}
                          maxLength={6}
                          onChange={(event) => setContactEmailCode(event.target.value.replace(/[^0-9]/gu, '').slice(0, 6))}
                          required
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Business details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Registered business name" value={values.businessName} onChange={(v) => update('businessName', v)} />
              <Field label="Marketplace display name" value={values.displayName} onChange={(v) => update('displayName', v)} />
              <ReactSelect
                label="Seller type"
                options={sellerTypes.map(([value, label]) => ({ value, label }))}
                value={values.sellerType}
                isClearable={false}
                onChange={(choice) => update('sellerType', String(choice?.value || ''))}
              />
              <Field label="Business email" type="email" value={values.businessEmail} onChange={(v) => update('businessEmail', v)} />
              <Field label="Business phone" value={values.businessPhone} onChange={(v) => update('businessPhone', v)} />
              <Field label="Region" value={values.region} onChange={(v) => update('region', v)} />
              <Field label="City" value={values.city} onChange={(v) => update('city', v)} />
              <Field label="Physical address" value={values.address} onChange={(v) => update('address', v)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Business registration and tax</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Commercial registration number" value={values.commercialRegistrationNumber} onChange={(v) => update('commercialRegistrationNumber', v)} />
              <Field label="Trade licence number" value={values.tradeLicenseNumber} onChange={(v) => update('tradeLicenseNumber', v)} />
              <Field label="TIN" value={values.tinNumber} onChange={(v) => update('tinNumber', v)} />
              <Field label="VAT registration number" value={values.vatRegistrationNumber} onChange={(v) => update('vatRegistrationNumber', v)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Verification documents</h2>
            <p className="mt-2 text-sm text-slate-600">Optional replacements: unchanged files remain attached. PDF, JPG or PNG; 8 MB maximum per file.</p>
            <div className="mt-4 space-y-4">
              {documentTypes.map(([field, type, title]) => {
                const current = application.documents.find((document) => document.documentType === type);
                return (
                  <div key={field} className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
                      <span>Current: {current?.originalName || 'Missing'}</span>
                      {current ? (
                        <a
                          href={`/api/seller/application/documents/${current.id}/download`}
                          className="font-semibold text-[#a71920] hover:underline"
                        >
                          Download current document
                        </a>
                      ) : null}
                    </div>
                    <DocumentField label={`Replace ${title} (optional)`} file={files[field] || null} onChange={(event) => chooseFile(field, event)} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Review and resubmit</h2>
            <p className="mt-2 text-sm text-slate-600">
              You are submitting a new application revision. Old records remain in the review history;
              legally significant changes may require documents to be verified again.
            </p>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required className="mt-1 accent-[#a71920]" />
              <span>I confirm that all information and attached documents are correct, and I agree to the Lemekinaye Seller verification review.</span>
            </label>
            {notice ? <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p> : null}
            {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            <button type="submit" disabled={busy || !agreed} className="mt-5 w-full rounded-lg bg-[#a71920] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Submitting updates…' : 'Submit corrected application'}
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}
