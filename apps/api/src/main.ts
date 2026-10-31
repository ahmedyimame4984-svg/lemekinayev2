import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApplication } from './app.setup.js';
import { validateEnvironment } from './config/environment.js';

async function bootstrap() {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '2mb' });

  configureApplication(app);

  await app.listen(environment.port);
}

await bootstrap();
