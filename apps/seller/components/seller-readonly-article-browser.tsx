'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, LockKeyhole, Search, ShieldCheck } from 'lucide-react';
import { getJson } from '@/lib/client-api';

interface ArticlePreview {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  publishedAt: string | null;
  brand: { name: string } | null;
  productType: { name: string };
}

export function SellerReadonlyArticleBrowser() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (searched.length >= 2) params.set('q', searched);
    void getJson<{ articles: ArticlePreview[] }>(
      `/api/seller/catalog/browse${params.size ? '?' + params.toString() : ''}`,
    ).then(result => {
      if (mounted) setArticles(result.articles);
    }).catch(err => {
      if (mounted) setError(err instanceof Error ? err.message : 'Could not browse approved spare parts.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [searched]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim() && query.trim().length < 2) return;
    setSearched(query.trim());
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#a71920]">Shared parts catalog</span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Browse spare parts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Explore approved spare parts while your business application is under review.
            Product listings and selling are available after approval.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <LockKeyhole size={14}/> Read-only access
        </span>
      </div>
      <form onSubmit={search} className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <label htmlFor="approved-article-search" className="sr-only">Search approved spare parts</label>
          <input id="approved-article-search" type="search" maxLength={120}
            value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search product name or Brand"
            className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-3 text-sm outline-none focus:border-[#a71920] focus:ring-4 focus:ring-rose-100"/>
        </div>
        <button type="submit" className="rounded-xl bg-[#a71920] px-5 py-3 text-sm font-semibold text-white hover:bg-[#851318] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
          Search parts
        </button>
      </form>
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p> : null}
      {loading ? <p role="status" className="text-sm text-slate-600">Loading approved catalog…</p> : (
        articles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <BookOpen className="mx-auto text-slate-400" size={32}/>
            <p className="mt-4 text-sm text-slate-600">No approved spare parts found. Try a different search.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map(article => (
              <article key={article.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{article.productType.name}</span>
                  <ShieldCheck size={18} className="text-emerald-700" aria-label="Approved marketplace product"/>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">{article.name}</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">{article.brand?.name ?? 'Unbranded'}</p>
                {article.shortDescription ? <p className="mt-3 text-sm leading-6 text-slate-600">{article.shortDescription}</p> : null}
                {expanded === article.id && article.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{article.description}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  {article.description ? (
                    <button type="button" onClick={() => setExpanded(expanded === article.id ? null : article.id)}
                      aria-expanded={expanded === article.id}
                      className="text-sm font-semibold text-[#a71920] hover:underline">
                      {expanded === article.id ? 'Less detail' : 'Read details'}
                    </button>
                  ) : <span className="text-xs text-slate-500">Approved product</span>}
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><LockKeyhole size={13}/> View only</span>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </div>
  );
}
