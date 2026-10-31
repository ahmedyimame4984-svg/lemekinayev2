'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';

export function SellerEmailVerification() {
  const started = useRef(false);
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const tokens = params.getAll('token');
    const token = tokens.length === 1 && /^[A-Za-z0-9_-]{43}$/u.test(tokens[0]!)
      ? tokens[0]
      : null;
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
    if (!token) {
      setMessage('This verification link is missing or invalid. Request a new link from registration.');
      setState('failed');
      return;
    }

    void postJson('/api/seller/auth/verify-email', { token })
      .then(() => setState('done'))
      .catch((error: unknown) => {
        setMessage(error instanceof ClientApiError
          ? error.message
          : 'Email verification could not be completed. Please request a new link.');
        setState('failed');
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-[#a71920]">LEMEKINAYE SELLER</p>
        <h1 className="text-2xl font-semibold text-slate-950">Verify your email</h1>
        {state === 'checking'
          ? <p role="status" className="text-sm text-slate-600">Verifying your email address…</p>
          : state === 'done'
            ? <div role="status" className="space-y-4">
                <p className="text-sm text-emerald-800">Email verified. Your Seller account is ready for restricted sign-in.</p>
                <Link href="/login" className="inline-flex rounded-lg bg-[#a71920] px-4 py-3 text-sm font-semibold text-white">
                  Continue to login
                </Link>
              </div>
            : <div role="alert" className="space-y-3">
                <p className="text-sm text-red-700">{message}</p>
                <Link href="/register" className="text-sm font-semibold text-[#a71920] hover:underline">
                  Registration and verification help
                </Link>
              </div>}
      </div>
    </main>
  );
}
