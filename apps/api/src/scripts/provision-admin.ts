import 'dotenv/config';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { isEmail } from 'class-validator';
import { AppModule } from '../app.module.js';
import { AdminAuthService } from '../auth/admin-auth.service.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
  },
  strict: true,
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || email.length > 254 || !isEmail(email)) {
  throw new Error('--email must be a valid email address');
}
if (!name || name.length < 2 || name.length > 100) {
  throw new Error('--name must contain between 2 and 100 characters');
}

const application = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error'],
});

try {
  const adminAuth = application.get(AdminAuthService);
  const result = await adminAuth.provisionAdmin({ email, name }, null);
  process.stdout.write(
    [
      `Admin user: ${result.userId}`,
      `Activation expires: ${result.expiresAt.toISOString()}`,
      'Activation token (shown once):',
      result.activationToken,
      '',
    ].join('\n'),
  );
} finally {
  await application.close();
}
