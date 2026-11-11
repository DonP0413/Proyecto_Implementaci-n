/**
 * Objetivo: punto de entrada del backend. Configura seguridad HTTP (helmet,
 * CORS), prefijo y versionado de la API, validación global, Swagger,
 * logger estructurado y apagado ordenado (SIGTERM en Docker).
 */
import 'reflect-metadata';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

export const configureApp = (app: NestExpressApplication): void => {
  const config = app.get(ConfigService);

  app.set('trust proxy', 1); // detrás de Nginx: IP real para rate limiting
  app.disable('x-powered-by');
  app.use(helmet());
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition', 'x-request-id'],
  });
  app.setGlobalPrefix(config.get<string>('apiPrefix') ?? 'api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  app.enableShutdownHooks();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get(ConfigService);
  if (config.get<boolean>('swaggerEnabled')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('PINTOTECH API')
        .setDescription('Gestión y seguimiento de reparación de equipos electrónicos')
        .setVersion(process.env.APP_VERSION ?? '0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`PINTOTECH API escuchando en el puerto ${port}`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap();
}
