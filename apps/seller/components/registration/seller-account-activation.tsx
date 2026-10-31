'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';

export function SellerAccountActivation() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const invitation = new URLSearchParams(url.hash.slice(1)).get('token') || '';
    window.history.replaceState(window.history.state, '', url.pathname);
    setToken(invitation);
    setReady(true);
  }, []);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 12 || password.length > 128) {
      setError('Choose a password between 12 and 128 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await postJson<void>('/api/seller/auth/activate', {
        activationToken: token,
        password,
      });
      setComplete(true);
      setToken('');
      setPassword('');
      setConfirmation('');
    } catch (requestError) {
      setError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'We could not activate your account. Please request a new invitation.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <meta name="referrer" content="no-referrer" />
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-[#a71920]">Lemekinaye Seller</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Activate your Seller account</h1>
        {!ready ? <p role="status" className="mt-4 text-sm text-slate-600">Checking your invitation…</p> :
          complete ? (
            <div role="status" className="mt-5 space-y-4">
              <p className="text-sm text-emerald-800">Your password was saved and your approved Seller account is ready.</p>
              <Link href="/login" className="inline-block rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white">Sign in</Link>
            </div>
          ) : !token ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              This invitation link is missing or invalid. Use the activation link sent to your email.
            </p>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={activate}>
              <p className="text-sm leading-6 text-slate-600">
                Choose your password. Your one-time invitation is not a password.
              </p>
              <label className="block text-sm font-medium text-slate-800">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
              </label>
              {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
              <button
                disabled={busy}
                type="submit"
                className="w-full rounded-lg bg-[#a71920] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Activating…' : 'Activate Seller account'}
              </button>
            </form>
          )}
      </div>
    </main>
  );
}
