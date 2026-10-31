'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';

const steps = ['Contact', 'Business', 'Registration & Tax', 'Documents', 'Review'];

export function RegistrationProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol className="grid grid-cols-5 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      {steps.map((label, index) => (
        <li key={label} className="min-w-0">
          <div
            className={`h-1.5 rounded-full ${
              index <= currentStep ? 'bg-[#a71920]' : 'bg-slate-200'
            }`}
          />
          <span
            className={`mt-2 hidden truncate text-center text-xs font-medium sm:block ${
              index === currentStep ? 'text-slate-950' : 'text-slate-500'
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#a71920] focus:ring-2 focus:ring-red-100"
      />
    </label>
  );
}

export function DocumentField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-4 transition">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">{label}</span>
          <span className="mt-1 block truncate text-xs text-slate-500">
            {file ? file.name : 'Required · PDF, JPG or PNG'}
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          {file ? 'Replace' : 'Choose file'}
        </span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={onChange}
          className="sr-only"
        />
      </label>
      {file ? (
        <div className="mt-4">
          <DocumentPreview file={file} />
        </div>
      ) : null}
    </div>
  );
}

export function DocumentPreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const previewUrl = preview?.file === file ? preview.url : '';
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    /\.(jpe?g|png)$/iu.test(file.name);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!isPdf && !isImage) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Preview is not available for this file type.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {previewUrl ? (
        isPdf ? (
          <iframe
            src={previewUrl}
            title={`Preview of ${file.name}`}
            className="h-64 w-full bg-white"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Preview of ${file.name}`}
            className="h-64 w-full object-contain"
          />
        )
      ) : (
        <div
          role="status"
          className="flex h-64 items-center justify-center text-sm text-slate-500"
        >
          Preparing preview…
        </div>
      )}
    </div>
  );
}

export function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <dl className="mt-2 grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

export function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

export function RegistrationSuccess({
  result,
  email,
}: {
  result: { referenceCode: string; submittedAt: string };
  email: string;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50">
          <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20">
            <circle cx="48" cy="48" r="34" fill="#DCFCE7" />
            <path
              d="M31 49.5 42.5 61 66 36.5"
              fill="none"
              stroke="#15803D"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="7"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
          Application submitted successfully
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
          Lemekinaye will review your business information and verification
          documents. Your account at {email} remains available for signing in.
          If approved, your selling permissions will be enabled automatically.
        </p>

        <div className="mx-auto mt-7 max-w-md rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Application reference
          </p>
          <p className="mt-2 break-all text-lg font-semibold text-slate-950">
            {result.referenceCode}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Keep this reference for future communication about your application.
          </p>
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-600">
          You may update your application until review begins. If corrections
          are requested later, you can revise the full application securely.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex w-full max-w-md items-center justify-center rounded-lg bg-[#a71920] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#8f151b]"
        >
          Return to Seller dashboard
        </Link>
      </div>
    </div>
  );
}
