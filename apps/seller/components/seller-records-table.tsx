'use client';

import { useState, type ReactNode } from 'react';
import { sellerTablePage } from '@/lib/seller-table';

export interface SellerRecordColumn<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

interface SellerRecordsTableProps<T> {
  label: string;
  rows: readonly T[];
  columns: readonly SellerRecordColumn<T>[];
  rowKey: (row: T) => string;
  searchText: (row: T) => string;
  emptyMessage: string;
  searchPlaceholder?: string;
}

export function SellerRecordsTable<T>({
  label,
  rows,
  columns,
  rowKey,
  searchText,
  emptyMessage,
  searchPlaceholder = 'Search by product, SKU or status',
}: SellerRecordsTableProps<T>) {
  const [query, setQuery] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const result = sellerTablePage(rows, query, searchText, requestedPage);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Search {label}
          <input type="search" value={query}
            onChange={event => { setQuery(event.target.value); setRequestedPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"/>
        </label>
        <p role="status" className="text-xs text-slate-600">
          Showing {result.rows.length} of {result.totalMatches} matching records
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[740px] border-collapse text-left text-sm">
          <caption className="sr-only">{label} records</caption>
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>{columns.map(column => (
              <th key={column.key} scope="col"
                className={`border-b border-slate-200 px-4 py-3 ${column.numeric ? 'text-right' : 'text-left'}`}>
                {column.title}
              </th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.rows.map(row => (
              <tr key={rowKey(row)} className="align-top hover:bg-slate-50">
                {columns.map(column => (
                  <td key={column.key} className={`px-4 py-3 text-slate-800 ${column.numeric ? 'text-right tabular-nums' : ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length === 0 ? (
        <p className="p-6 text-sm text-slate-600">{rows.length === 0 ? emptyMessage : 'No records match your search.'}</p>
      ) : null}
      {result.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3">
          <button type="button" disabled={result.page <= 1}
            onClick={() => setRequestedPage(result.page - 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">Previous</button>
          <p className="text-xs text-slate-600">Page {result.page} of {result.totalPages}</p>
          <button type="button" disabled={result.page >= result.totalPages}
            onClick={() => setRequestedPage(result.page + 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">Next</button>
        </div>
      ) : null}
    </div>
  );
}
