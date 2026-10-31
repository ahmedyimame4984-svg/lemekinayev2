'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, ClipboardCheck, Clock3, Package, ShieldCheck, Store } from 'lucide-react';
import { getJson } from '@/lib/client-api';
import type { SellerApplicationWorkspace } from '@/lib/seller-application-workspace';
import { applicationSteps } from '@/lib/seller-application-workspace';

interface Status {
  canSell: boolean;
  application: { status: string; referenceCode: string; correctionReason: string | null } | null;
}

export function SellerOnboardingDashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [workspace, setWorkspace] = useState<SellerApplicationWorkspace | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      getJson<Status>('/api/seller/onboarding/status'),
      getJson<SellerApplicationWorkspace>('/api/seller/application/workspace'),
    ]).then(([nextStatus, nextWorkspace]) => {
      if (!active) return;
      setStatus(nextStatus);
      setWorkspace(nextWorkspace);
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load your dashboard.'); });
    return () => { active = false; };
  }, []);

  const step = workspace?.draft?.step ?? 0;
  const label = status?.application?.status.replaceAll('_', ' ') ?? (workspace?.draft ? 'Draft in progress' : 'Not started');

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a71920]">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Seller Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Your business verification and marketplace workspace at a glance.</p>
        </div>
        {status ? <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${status.canSell
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{status.canSell ? 'Approved Seller' : label}</span> : null}
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p> : null}
      {!error && !status ? <p role="status" className="text-sm text-slate-600">Loading your Seller dashboard…</p> : null}
      {status && workspace ? (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-50 blur-2xl"/>
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-[#a71920]"><ShieldCheck size={20}/><span className="text-xs font-bold uppercase tracking-wider">Business verification</span></div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {status.canSell ? 'Your business is approved' :
                    status.application ? 'Track your application' : 'Complete your Seller application'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {status.canSell
                    ? 'You can now add products, manage your stock and publish marketplace Listings.'
                    : status.application
                      ? 'Your application has been received. Track review progress and edit until Admin starts reviewing.'
                      : 'Save your progress at each step and continue anytime. Your verified contact email is filled automatically.'}
                </p>
                {!status.canSell && !status.application ? (
                  <div className="mt-5 max-w-md">
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>{workspace.draft ? 'Continue where you stopped' : 'Ready to get started'}</span>
                      <span>Step {step + 1} of {applicationSteps.length}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#a71920]" style={{ width: `${(step + 1) / applicationSteps.length * 100}%` }}/>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Next: {applicationSteps[step]}</p>
                  </div>
                ) : null}
                {status.application?.correctionReason ? (
                  <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <strong>Admin feedback:</strong> {status.application.correctionReason}
                  </p>
                ) : null}
                <Link href={status.canSell ? '/products' : '/onboarding/apply'}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#a71920] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#851318] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
                  {status.canSell ? 'Manage Products & Inventory' : status.application ? 'View application & timeline' : workspace.draft ? 'Resume application' : 'Start application'}
                  <ArrowRight size={17}/>
                </Link>
              </div>
              <div className="hidden h-28 w-28 items-center justify-center rounded-3xl border border-rose-100 bg-rose-50 text-[#a71920] sm:flex">
                {status.canSell ? <Store size={48} strokeWidth={1.4}/> : <ClipboardCheck size={48} strokeWidth={1.4}/>}
              </div>
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Browse Parts', description: 'Explore approved automotive spare parts.',
                href: '/articles', icon: BookOpenText, restricted: false,
              },
              {
                title: 'Products & Inventory', description: status.canSell ? 'Manage your stock and Locations.' : 'Opens after business approval.',
                href: '/products', icon: Package, restricted: !status.canSell,
              },
              {
                title: 'Marketplace Listings', description: status.canSell ? 'Manage your online offers.' : 'Opens after business approval.',
                href: '/products?tab=listings', icon: Store, restricted: !status.canSell,
              },
            ].map(card => (
              <Link key={card.title} href={card.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-rose-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#a71920]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#a71920]">
                  <card.icon size={21}/>
                </span>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-950">{card.title}</h3>
                  {card.restricted ? <Clock3 size={15} className="text-amber-600"/> : <ArrowRight size={16} className="text-slate-400 group-hover:text-[#a71920]"/>}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
