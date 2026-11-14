import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { resolveDatasource } from './prisma-url-policy.mjs';

// Capture explicit operator/test settings before dotenv fills missing variables.
const exported = { DATABASE_URL: process.env.DATABASE_URL, DIRECT_URL: process.env.DIRECT_URL };
loadDotenv({ path: process.env.DOTENV_CONFIG_PATH || undefined, quiet: true });
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: resolveDatasource(exported, process.env) },
});
