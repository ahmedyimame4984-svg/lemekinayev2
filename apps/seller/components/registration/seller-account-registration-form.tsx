'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { ClientApiError, postJson } from '@/lib/client-api';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#a71920] focus:ring-4 focus:ring-rose-100';

export function SellerAccountRegistrationForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('Your passwords do not match.');
      return;
    }
    if (password.length < 12 || password.length > 128 || !/\S/u.test(password)) {
      setError('Choose a password of 12–128 characters including a non-space character.');
      return;
    }
    setBusy(true);
    try {
      await postJson('/api/seller/auth/register', { email: email.trim(), password });
      setSent(true);
      setPassword('');
      setConfirmation('');
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'We could not create your account. Please try again.');
    } finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true);
    setError('');
    try {
      await postJson('/api/seller/auth/resend-verification', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Email verification could not be requested.');
    } finally { setBusy(false); }
  }

  if (sent) {
    return <div role="status" className="space-y-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <CheckCircle2 size={28} aria-hidden="true"/>
        <h2 className="mt-3 text-lg font-semibold">Check your inbox</h2>
        <p className="mt-2 text-sm leading-6">
          If eligible, a verification email has been requested for <strong className="break-all">{email}</strong>.
          Open the link within 30 minutes to verify your account.
        </p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void resend()}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50">
        {busy ? 'Requesting…' : 'Resend verification email'}
      </button>
      <Link href="/login" className="block text-center text-sm font-semibold text-[#a71920] hover:underline">
        Go to Seller login
      </Link>
    </div>;
  }

  return (
    <form onSubmit={register} className="space-y-5">
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900">{error}</p> : null}
      <div>
        <label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-slate-800">Email address</label>
        <div className="relative">
          <Mail size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input id="register-email" type="email" autoComplete="email" maxLength={254} required
            value={email} onChange={event => setEmail(event.target.value)}
            placeholder="you@company.com" className={inputClass}/>
        </div>
      </div>
      <div>
        <label htmlFor="register-password" className="mb-2 block text-sm font-semibold text-slate-800">Create password</label>
        <div className="relative">
          <LockKeyhole size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input id="register-password" type={visible ? 'text' : 'password'}
            minLength={12} maxLength={128} autoComplete="new-password" required
            value={password} onChange={event => setPassword(event.target.value)}
            aria-describedby="register-password-hint" className={inputClass} placeholder="At least 12 characters"/>
          <button type="button" onClick={() => setVisible(x => !x)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 focus-visible:outline-2 focus-visible:outline-[#a71920]">
            {visible ? <EyeOff size={18}/> : <Eye size={18}/>}
          </button>
        </div>
        <p id="register-password-hint" className="mt-2 text-xs leading-5 text-slate-500">
          Use 12–128 characters, including at least one non-space character.
        </p>
      </div>
      <div>
        <label htmlFor="register-confirmation" className="mb-2 block text-sm font-semibold text-slate-800">Confirm password</label>
        <div className="relative">
          <LockKeyhole size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input id="register-confirmation" type={visible ? 'text' : 'password'}
            minLength={12} maxLength={128} autoComplete="new-password" required
            value={confirmation} onChange={event => setConfirmation(event.target.value)}
            className={inputClass} placeholder="Repeat your password"/>
        </div>
      </div>
      <button type="submit" disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#a71920] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/10 transition hover:bg-[#851318] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:opacity-60">
        {busy ? 'Creating account…' : 'Create Seller account'} <ArrowRight size={17}/>
      </button>
      <p className="pt-3 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#a71920] hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
