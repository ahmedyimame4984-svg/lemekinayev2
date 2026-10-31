import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

export function SellerAuthShell({
  children, eyebrow, title, description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(480px,0.96fr)]">
      <section aria-label="About Lemekinaye for Sellers"
        className="relative isolate hidden min-h-screen flex-col overflow-hidden bg-[#171b22] px-10 py-11 text-white lg:flex xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-48 top-16 h-[500px] w-[500px] rounded-full border border-white/10 bg-gradient-to-br from-[#a71920]/40 via-[#a71920]/5 to-transparent blur-3xl"/>
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#8b1c24]/20 blur-3xl"/>
        <Link href="/" className="relative flex w-fit items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8202a] text-lg font-black tracking-tight">L</span>
          <span className="text-lg font-bold tracking-tight">LEMEKINAYE <span className="font-normal text-white/60">/ Seller</span></span>
        </Link>
        <div className="relative my-auto max-w-xl py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wide text-rose-100">
            <Sparkles size={14} /> Your automotive parts business, connected
          </span>
          <h2 className="mt-8 max-w-lg text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">
            A better way to grow your spare parts business.
          </h2>
          <p className="mt-6 max-w-md text-base leading-8 text-slate-300">
            Manage your products, stock and orders in one professional workspace.
            Explore Lemekinaye before your business verification is approved.
          </p>
          <div className="mt-10 space-y-5">
            {[
              'Browse a structured automotive parts catalog',
              'Complete business verification on your schedule',
              'Manage products and fulfillment after approval',
            ].map(item => (
              <div key={item} className="flex items-start gap-3 text-sm text-slate-200">
                <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-rose-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={16}/> Secure Seller workspace</span>
          <span className="inline-flex items-center gap-1">Built for automotive parts <ArrowUpRight size={14}/></span>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-20">
        <div className="w-full max-w-[460px]">
          <Link href="/" className="mb-10 flex items-center gap-2 text-base font-bold tracking-tight text-slate-950 lg:hidden">
            <span className="rounded-lg bg-[#a71920] px-2.5 py-1.5 font-black text-white">L</span>
            Lemekinaye Seller
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#a71920]">{eyebrow}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.45rem]">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
          <div className="mt-9">{children}</div>
          <p className="mt-9 text-center text-xs leading-6 text-slate-500">Protected Seller account · Your activity may be recorded for security.</p>
        </div>
      </section>
    </main>
  );
}
