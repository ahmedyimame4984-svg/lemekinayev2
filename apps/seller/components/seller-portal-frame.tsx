'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import {
  BookOpenText, ChevronRight, ClipboardList, LayoutDashboard,
  LockKeyhole, LogOut, Menu, Package, Settings2, ShieldCheck,
  Truck, X,
} from 'lucide-react';
import { getJson, postJson } from '@/lib/client-api';
import { SellerSessionGuard } from './seller-session';
import { SellerReadonlyArticleBrowser } from './seller-readonly-article-browser';

interface Status {
  canSell: boolean;
  application: { status: string; referenceCode: string } | null;
}

const nav = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { title: 'My Application', href: '/onboarding/apply', icon: ClipboardList, key: 'application' },
  { title: 'Browse Parts', href: '/articles', icon: BookOpenText, key: 'articles' },
  { title: 'Products', href: '/products', icon: Package, key: 'products', selling: true },
  { title: 'RFQs & Orders', href: '', icon: Truck, key: 'orders', selling: true, upcoming: true },
  { title: 'Account', href: '/account', icon: Settings2, key: 'account' },
] as const;

const protectedPaths = ['/dashboard', '/onboarding', '/articles', '/products', '/account'];

function isProtected(pathname: string) {
  return protectedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function SellerSidebar({
  pathname, status, onNavigate, onLogout, busy,
}: {
  pathname: string;
  status: Status;
  onNavigate: () => void;
  onLogout: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-[#181d25] text-white">
      <div className="border-b border-white/10 px-6 py-6">
        <Link href="/dashboard" onClick={onNavigate}
          className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b51d26] text-xl font-bold">L</span>
          <span>
            <span className="block text-base font-bold tracking-tight">LEMEKINAYE</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Seller Portal</span>
          </span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
        <nav aria-label="Seller navigation" className="mt-3 space-y-1">
          {nav.map(({ title, href, icon: Icon, key, ...rest }) => {
            const upcoming = 'upcoming' in rest && rest.upcoming;
            const selling = 'selling' in rest && rest.selling;
            const active = pathname === href.split('?')[0] || pathname.startsWith(href.split('?')[0] + '/');
            const classes = `group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active
              ? 'bg-white/12 font-semibold text-white'
              : 'font-medium text-slate-300 hover:bg-white/6 hover:text-white'}`;
            return upcoming ? (
              <span key={key} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-slate-500"
                aria-label={title + ', coming later'}>
                <Icon size={18} aria-hidden="true"/><span className="flex-1">{title}</span><span className="text-[10px]">Soon</span>
              </span>
            ) : (
              <Link key={key} href={href} onClick={onNavigate} className={classes}
                aria-current={active ? 'page' : undefined}>
                <Icon size={18} aria-hidden="true" className={active ? 'text-rose-300' : 'text-slate-400'}/>
                <span className="flex-1">{title}</span>
                {selling && !status.canSell ? <LockKeyhole size={14} aria-label="Selling access locked pending approval" className="text-slate-500"/> : null}
                {key === 'application' && status.application ? (
                  <span className="h-2 w-2 rounded-full bg-amber-400" aria-label={'Application status: ' + status.application.status}/>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {!status.canSell ? (
          <Link href="/onboarding/apply" onClick={onNavigate}
            className="mt-8 block rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
            <span className="flex items-center gap-2 text-xs font-semibold text-rose-200">
              <ShieldCheck size={15}/> Business verification
            </span>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {status.application
                ? status.application.status.replaceAll('_', ' ') + ' — view progress'
                : 'Complete your application to unlock selling.'}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white">
              My Application <ChevronRight size={14}/>
            </span>
          </Link>
        ) : null}
      </div>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-900/70 text-xs font-bold">S</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">Seller account</p>
            <p className="text-[11px] text-slate-400">{status.canSell ? 'Approved' : 'Verification pending'}</p>
          </div>
          <button type="button" disabled={busy} onClick={onLogout} title="Sign out" aria-label="Sign out"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50">
            <LogOut size={17}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceContent({
  children, pathname, status,
}: {
  children: ReactNode;
  pathname: string;
  status: Status;
}) {
  if (!status.canSell && (pathname === '/articles' || pathname.startsWith('/articles/'))) {
    return <SellerReadonlyArticleBrowser />;
  }
  if (!status.canSell && (pathname === '/products' || pathname.startsWith('/products/'))) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-[#a71920]">
          <LockKeyhole size={25}/>
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">Available after verification</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">
          Your products, inventory and marketplace listings will be managed here once your business is approved.
          You can explore approved Manufacturer Articles while you wait.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/onboarding/apply" className="rounded-xl bg-[#a71920] px-5 py-3 text-sm font-semibold text-white hover:bg-[#851318]">
            Track application
          </Link>
          <Link href="/articles" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Browse Articles
          </Link>
        </div>
      </section>
    );
  }
  return <>{children}</>;
}

function AuthorizedSellerFrame({ children, pathname }: { children: ReactNode; pathname: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    let active = true;
    void getJson<Status>('/api/seller/onboarding/status')
      .then(value => { if (active) setStatus(value); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load Seller status.'); });
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [menuOpen]);

  async function logout() {
    setLoggingOut(true);
    setError('');
    try {
      await postJson('/api/seller/auth/logout', {});
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Could not sign out. Try again.');
      setLoggingOut(false);
    }
  }

  if (error && !status) return (
    <main className="min-h-screen p-8">
      <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">{error}</p>
      <button type="button" className="mt-4 text-sm font-semibold text-[#a71920]" onClick={() => {
        setError(''); router.refresh();
      }}>Try again</button>
    </main>
  );
  if (!status) return <div role="status" className="flex min-h-screen items-center justify-center text-sm text-slate-500">Opening Seller workspace…</div>;

  return (
    <div className="min-h-screen bg-[#f7f8fa] lg:pl-[270px]">
      <a href="#seller-main" className="sr-only rounded bg-white px-4 py-2 text-black focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50">Skip to main content</a>
      {menuOpen ? <button type="button" onClick={() => setMenuOpen(false)}
        aria-label="Close sidebar navigation" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"/> : null}
      <aside id="seller-sidebar" aria-label="Seller sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-[270px] transform transition-transform duration-200 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SellerSidebar pathname={pathname} status={status} busy={loggingOut} onNavigate={() => setMenuOpen(false)} onLogout={() => void logout()}/>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open navigation" aria-controls="seller-sidebar"
              aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#a71920] lg:hidden">
              {menuOpen ? <X size={20}/> : <Menu size={20}/>}
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Seller workspace</p>
              <p className="text-sm font-semibold text-slate-950">{nav.find(item => item.href === pathname)?.title ?? 'Lemekinaye'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/articles" className="hidden rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">
              Browse catalog
            </Link>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${status.canSell
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              {status.canSell ? 'Approved Seller' : 'Pending approval'}
            </span>
          </div>
        </header>
        {error ? <div role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</div> : null}
        <main id="seller-main" className="min-h-[calc(100vh-72px)] px-4 py-7 sm:px-7 lg:px-9">
          <WorkspaceContent pathname={pathname} status={status}>{children}</WorkspaceContent>
        </main>
      </div>
    </div>
  );
}

export function SellerPortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isProtected(pathname)) return <>{children}</>;
  return (
    <SellerSessionGuard>
      <AuthorizedSellerFrame pathname={pathname}>{children}</AuthorizedSellerFrame>
    </SellerSessionGuard>
  );
}
