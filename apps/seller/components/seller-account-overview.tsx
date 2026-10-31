'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { getJson } from '@/lib/client-api';
import type { SellerApplicationWorkspace } from '@/lib/seller-application-workspace';

export function SellerAccountOverview() {
  const [workspace, setWorkspace] = useState<SellerApplicationWorkspace | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getJson<SellerApplicationWorkspace>('/api/seller/application/workspace')
      .then(result => { if (active) setWorkspace(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load account.'); });
    return () => { active = false; };
  }, []);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a71920]">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Your Seller account</h1>
        <p className="mt-2 text-sm text-slate-600">Your verified identity and application are connected securely.</p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">{error}</p> : null}
      {!error && !workspace ? <p role="status" className="text-sm text-slate-600">Loading your account…</p> : null}
      {workspace ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Mail className="text-[#a71920]" size={24}/>
            <h2 className="mt-4 text-base font-semibold text-slate-950">Verified email address</h2>
            <p className="mt-2 break-all text-sm text-slate-700">{workspace.contactEmail}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 size={15}/> Verified
            </span>
            <p className="mt-4 text-xs leading-5 text-slate-500">Your contact email is used automatically in your business application and cannot be changed through that form.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ShieldCheck className="text-[#a71920]" size={24}/>
            <h2 className="mt-4 text-base font-semibold text-slate-950">Business verification</h2>
            <p className="mt-2 text-sm text-slate-700">{workspace.application?.status.replaceAll('_', ' ') ?? 'Not submitted'}</p>
            <Link href="/onboarding/apply"
              className="mt-5 inline-flex rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#a71920] hover:bg-slate-50">
              View My Application
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
