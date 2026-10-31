'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { ClientApiError, postJson } from '@/lib/client-api';

const input = 'w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#a71920] focus:ring-4 focus:ring-rose-100';

export function SellerLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await postJson('/api/seller/auth/login', { identifier: identifier.trim(), password });
      router.replace('/dashboard');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ClientApiError
        ? requestError.message : 'Seller sign in could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900">{error}</p> : null}
      <div>
        <label htmlFor="seller-identifier" className="mb-2 block text-sm font-semibold text-slate-800">Email address</label>
        <div className="relative">
          <Mail size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input id="seller-identifier" type="email" autoComplete="username" value={identifier} required maxLength={254}
            onChange={event => setIdentifier(event.target.value)} placeholder="you@company.com" className={input}/>
        </div>
      </div>
      <div>
        <label htmlFor="seller-password" className="mb-2 block text-sm font-semibold text-slate-800">Password</label>
        <div className="relative">
          <LockKeyhole size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input id="seller-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required
            value={password} onChange={event => setPassword(event.target.value)}
            placeholder="Enter your password" className={input}/>
          <button type="button" onClick={() => setVisible(value => !value)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-[#a71920]">
            {visible ? <EyeOff size={18}/> : <Eye size={18}/>}
          </button>
        </div>
      </div>
      <button type="submit" disabled={busy || !identifier.trim() || !password}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#a71920] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/10 transition hover:bg-[#851318] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:cursor-wait disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in to Seller Portal'} <ArrowRight size={17}/>
      </button>
      <p className="pt-3 text-center text-sm text-slate-600">
        New to Lemekinaye?{' '}
        <Link href="/register" className="font-semibold text-[#a71920] hover:underline focus-visible:outline-2 focus-visible:outline-[#a71920]">Create a Seller account</Link>
      </p>
    </form>
  );
}
