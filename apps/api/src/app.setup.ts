import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { HttpLoggingMiddleware } from './common/http-logging.middleware.js';

export function configureApplication(app: INestApplication): void {
  const httpLogging = new HttpLoggingMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => httpLogging.use(req, res, next));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const apiDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Lemekinaye API')
      .setDescription('Versioned Lemekinaye marketplace API')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, apiDocument);
}
