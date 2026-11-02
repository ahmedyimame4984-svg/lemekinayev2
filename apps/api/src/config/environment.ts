export interface Environment {
  databaseUrl: string;
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  authSessionTtlMinutes: number;
  authAdminSessionTtlMinutes: number;
  authAdminRefreshTtlMinutes: number;
  authAdminActivationTtlMinutes: number;
  authAdminChallengeTtlMinutes: number;
  authAdminMaxAttempts: number;
  authAdminLockMinutes: number;
  authAdminIpMaxAttempts: number;
  authAdminIpWindowMinutes: number;
  authSellerActivationTtlMinutes: number;
  authSellerMaxAttempts: number;
  authSellerLockMinutes: number;
  sellerDocumentStoragePath: string;
  authMfaEncryptionKey: Buffer;
}

const nodeEnvironments = new Set(['development', 'test', 'production']);

function readPositiveInteger(
  environment: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const value = Number(environment[key] ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
}

function readEncryptionKey(
  environment: NodeJS.ProcessEnv,
  key: string,
): Buffer {
  const encoded = environment[key];
  if (!encoded) {
    throw new Error(`${key} is required`);
  }

  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== encoded) {
    throw new Error(`${key} must be a canonical base64-encoded 32-byte key`);
  }

  return decoded;
}

export function validateEnvironment(
  environment: NodeJS.ProcessEnv,
): Environment {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error(
      'DATABASE_URL must use the postgresql:// or postgres:// protocol',
    );
  }

  const port = Number(environment.PORT ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (!nodeEnvironments.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const authSessionTtlMinutes = readPositiveInteger(
    environment,
    'AUTH_SESSION_TTL_MINUTES',
    1_440,
  );
  const authAdminSessionTtlMinutes = readPositiveInteger(
    environment,
    'AUTH_ADMIN_SESSION_TTL_MINUTES',
    30,
  );
  const authAdminRefreshTtlMinutes = readPositiveInteger(
    environment,
    'AUTH_ADMIN_REFRESH_TTL_MINUTES',
    480,
  );
  if (authAdminRefreshTtlMinutes <= authAdminSessionTtlMinutes) {
    throw new Error(
      'AUTH_ADMIN_REFRESH_TTL_MINUTES must be greater than AUTH_ADMIN_SESSION_TTL_MINUTES',
    );
  }

  const authAdminActivationTtlMinutes = readPositiveInteger(
    environment,
    'AUTH_ADMIN_ACTIVATION_TTL_MINUTES',
    1_440,
  );
  const authAdminChallengeTtlMinutes = readPositiveInteger(
    environment,
    'AUTH_ADMIN_CHALLENGE_TTL_MINUTES',
    5,
  );
  const authAdminMaxAttempts = readPositiveInteger(
    environment,
    'AUTH_ADMIN_MAX_ATTEMPTS',
    5,
  );
  const authAdminLockMinutes = readPositiveInteger(
    environment,
    'AUTH_ADMIN_LOCK_MINUTES',
    15,
  );
  const authAdminIpMaxAttempts = readPositiveInteger(
    environment,
    'AUTH_ADMIN_IP_MAX_ATTEMPTS',
    20,
  );
  const authAdminIpWindowMinutes = readPositiveInteger(
    environment,
    'AUTH_ADMIN_IP_WINDOW_MINUTES',
    15,
  );
  const authSellerActivationTtlMinutes = readPositiveInteger(
    environment,
    'AUTH_SELLER_ACTIVATION_TTL_MINUTES',
    1_440,
  );
  const authSellerMaxAttempts = readPositiveInteger(
    environment,
    'AUTH_SELLER_MAX_ATTEMPTS',
    5,
  );
  const authSellerLockMinutes = readPositiveInteger(
    environment,
    'AUTH_SELLER_LOCK_MINUTES',
    15,
  );
  const configuredSellerDocumentStoragePath =
    environment.SELLER_DOCUMENT_STORAGE_PATH?.trim();
  if (nodeEnv === 'production' && !configuredSellerDocumentStoragePath) {
    throw new Error(
      'SELLER_DOCUMENT_STORAGE_PATH is required in production',
    );
  }
  const sellerDocumentStoragePath =
    configuredSellerDocumentStoragePath || '.private/seller-documents';

  const authMfaEncryptionKey = readEncryptionKey(
    environment,
    'AUTH_MFA_ENCRYPTION_KEY',
  );

  return {
    databaseUrl,
    nodeEnv: nodeEnv as Environment['nodeEnv'],
    port,
    authSessionTtlMinutes,
    authAdminSessionTtlMinutes,
    authAdminRefreshTtlMinutes,
    authAdminActivationTtlMinutes,
    authAdminChallengeTtlMinutes,
    authAdminMaxAttempts,
    authAdminLockMinutes,
    authAdminIpMaxAttempts,
    authAdminIpWindowMinutes,
    authSellerActivationTtlMinutes,
    authSellerMaxAttempts,
    authSellerLockMinutes,
    sellerDocumentStoragePath,
    authMfaEncryptionKey,
  };
}
