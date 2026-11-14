export function assertSameDatabase(databaseUrl: string, directUrl: string): void;
export function resolveDatasource(exported: {DATABASE_URL?: string; DIRECT_URL?: string}, loaded: {DATABASE_URL?: string; DIRECT_URL?: string}): string;
