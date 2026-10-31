/** Build one explicit local test target shared by Prisma and libpq. No I/O. */
export function stage01TestEnvironment(source) {
  if (source.DIRECT_URL?.trim()) {
    throw new Error('Unset DIRECT_URL; it overrides DATABASE_URL in Prisma.');
  }
  let urlText = source.DATABASE_URL?.trim();
  if (!urlText && source.EV_STAGE01_PASSWORD) {
    const testUrl = new URL('postgresql://lemekinaye@127.0.0.1:5432/lemekinaye_ev_stage01_test?schema=public');
    testUrl.password = encodeURIComponent(source.EV_STAGE01_PASSWORD);
    urlText = testUrl.toString();
  }
  if (!urlText) {
    throw new Error('Set EV_STAGE01_PASSWORD or DATABASE_URL for the isolated test database.');
  }
  let url, database, username, password;
  try {
    url = new URL(urlText);
    database = decodeURIComponent(url.pathname.slice(1));
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error('Invalid test DATABASE_URL.');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '::1'].includes(host) ||
      database !== 'lemekinaye_ev_stage01_test' || !username || url.hash ||
      (url.searchParams.get('schema') || 'public') !== 'public') {
    throw new Error('Refusing anything except localhost/lemekinaye_ev_stage01_test (public schema) with an explicit role.');
  }
  const keys = new Set();
  for (const [key] of url.searchParams) {
    if (!['schema', 'sslmode', 'connect_timeout'].includes(key) || keys.has(key)) {
      throw new Error('Unsupported or repeated test connection parameter.');
    }
    keys.add(key);
  }
  const connectTimeout = url.searchParams.get('connect_timeout') ?? '10';
  if (!/^[1-9]\d*$/.test(connectTimeout) || Number(connectTimeout) > 60) {
    throw new Error('Test connect_timeout must be an integer from 1 to 60 seconds.');
  }
  const env = { ...source };
  // PGHOSTADDR/PGSERVICE override libpq's PGHOST; dotenv override/path can
  // redirect Prisma. Do not inherit either family's connection settings.
  for (const key of Object.keys(env)) {
    const normalized = key.toUpperCase();
    if (normalized.startsWith('PG') || normalized.startsWith('DOTENV_CONFIG_')) delete env[key];
  }
  Object.assign(env, {
    DATABASE_URL: urlText, DIRECT_URL: '', PGHOST: host,
    PGPORT: url.port || '5432', PGDATABASE: database, PGUSER: username,
    PGPASSWORD: password, PGCONNECT_TIMEOUT: connectTimeout,
  });
  return { urlText, env };
}
