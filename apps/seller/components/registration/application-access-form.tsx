'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';
import { parseApplicationAccessInput } from '@/lib/application-access';

interface AccessRequested {
  message: string;
}

export function ApplicationAccessForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    let input;
    try {
      input = parseApplicationAccessInput({ referenceCode, contactEmail });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check the details entered.');
      return;
    }

    setBusy(true);
    try {
      await postJson<AccessRequested>('/api/seller/application/access/request', input);
      setRequested(true);
    } catch (requestError) {
      setError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'Could not request an access code. Please try again later.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postJson<{ verified: true }>('/api/seller/application/access/verify', {
        referenceCode,
        contactEmail,
        code,
      });
      setCode('');
      router.replace('/application/status');
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'We could not verify the code. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-7 text-center">
          <Link href="/register" className="text-sm font-semibold text-[#a71920] hover:underline">
            Lemekinaye Seller
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Track your application
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Access to an application is separate from Seller account sign-in.
            You will need your reference and the contact email used during registration.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {requested ? (
            <div className="space-y-4">
              <p role="status" className="text-sm leading-6 text-slate-600">
                If the reference and email match, a one-time code has been requested.
              </p>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl font-semibold text-emerald-700" aria-hidden="true">
                ✓
              </div>
              <h2 className="text-xl font-semibold text-slate-950">Check your email</h2>
              <form onSubmit={verifyCode} className="space-y-3">
                <label htmlFor="application-access-code" className="block text-sm font-medium text-slate-800">
                  Six-digit verification code
                </label>
                <input
                  id="application-access-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/[^0-9]/gu, '').slice(0, 6))}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
                {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="w-full rounded-lg bg-[#a71920] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Verify and view application'}
                </button>
              </form>
              <p className="text-sm leading-6 text-slate-600">
                If the reference and contact email match a registration application,
                a verification code will be sent. Never share the code with anyone.
              </p>
              <button
                type="button"
                className="text-sm font-semibold text-[#a71920] hover:underline"
                onClick={() => setRequested(false)}
              >
                Use different details
              </button>
            </div>
          ) : (
            <form onSubmit={requestCode} className="space-y-5">
              <div>
                <label htmlFor="application-reference" className="block text-sm font-medium text-slate-800">
                  Application reference
                </label>
                <input
                  id="application-reference"
                  type="text"
                  value={referenceCode}
                  onChange={(event) => setReferenceCode(event.target.value)}
                  autoComplete="off"
                  placeholder="SLR-APP-2026-XXXXXXXXXXXX"
                  maxLength={40}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-[#a71920] focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div>
                <label htmlFor="application-email" className="block text-sm font-medium text-slate-800">
                  Registered contact email
                </label>
                <input
                  id="application-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="contact@example.com"
                  maxLength={254}
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-[#a71920] focus:ring-2 focus:ring-red-100"
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-[#a71920] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#8f151b] disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? 'Requesting code…' : 'Request verification code'}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                We do not disclose whether an application matches these details.
                Your reference alone does not grant access.
              </p>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          Haven’t registered?{' '}
          <Link href="/register" className="font-semibold text-[#a71920] hover:underline">
            Apply to become a Seller
          </Link>
        </div>
      </div>
    </main>
  );
}
