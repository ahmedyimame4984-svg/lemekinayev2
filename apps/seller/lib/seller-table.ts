/** Shared client-side pagination for the Seller's four record tables. */
export function sellerTablePage<T>(
  rows: readonly T[],
  query: string,
  getSearchText: (row: T) => string,
  requestedPage: number,
  pageSize = 10,
) {
  const term = query.trim().toLocaleLowerCase('en-US');
  const matching = term
    ? rows.filter(row => getSearchText(row).toLocaleLowerCase('en-US').includes(term))
    : [...rows];
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return {
    rows: matching.slice((page - 1) * pageSize, page * pageSize),
    page,
    totalPages,
    totalMatches: matching.length,
  };
}
