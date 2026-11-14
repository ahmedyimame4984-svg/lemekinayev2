/** Prisma CLI target policy. Credentials may differ; connection targets may not. */
function identity(value) {
  let url;
  let database;
  try {
    url = new URL(value);
    database = decodeURIComponent(url.pathname.slice(1));
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new Error('Refusing Prisma datasource: invalid PostgreSQL URL.');
  }
  const allowed = new Set(['schema', 'sslmode', 'sslaccept', 'sslcert', 'sslidentity',
    'sslpassword', 'sslrootcert', 'connection_limit', 'connect_timeout', 'socket_timeout',
    'pool_timeout', 'pgbouncer', 'statement_cache_size', 'application_name', 'channel_binding']);
  const seen = new Set();
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || seen.has(key)) {
      throw new Error('Refusing Prisma datasource: unsupported or repeated connection option.');
    }
    seen.add(key);
  }
  const schema = url.searchParams.get('schema') ?? 'public';
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname ||
      !database || database.includes('/') || !schema || url.hash ||
      [...database, ...schema].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error('Refusing Prisma datasource: explicit PostgreSQL host, database and schema required.');
  }
  return JSON.stringify([url.hostname.toLowerCase(), String(Number(url.port || 5432)), database, schema]);
}

/** @param {string} databaseUrl @param {string} directUrl */
export function assertSameDatabase(databaseUrl, directUrl) {
  if (identity(databaseUrl) !== identity(directUrl)) {
    throw new Error('Refusing Prisma datasource: DATABASE_URL and DIRECT_URL must select the same host, port, database and schema.');
  }
}

/** Exported connection variables win as a group; dotenv never supplies a competing direct target.
 * @param {{ DATABASE_URL?: string, DIRECT_URL?: string }} exported
 * @param {{ DATABASE_URL?: string, DIRECT_URL?: string }} loaded
 */
export function resolveDatasource(exported, loaded) {
  const source = exported.DATABASE_URL !== undefined || exported.DIRECT_URL !== undefined ? exported : loaded;
  for (const value of [source.DATABASE_URL, source.DIRECT_URL]) {
    if (value !== undefined && !value.trim()) throw new Error('Refusing Prisma datasource: empty connection setting.');
  }
  const selected = source.DIRECT_URL?.trim() ?? source.DATABASE_URL?.trim();
  if (!selected) throw new Error('Refusing Prisma datasource: DATABASE_URL or DIRECT_URL required.');
  assertSameDatabase(source.DATABASE_URL?.trim() ?? selected, selected);
  return selected;
}
