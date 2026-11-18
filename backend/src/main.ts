/**
 * Objetivo: punto de entrada del backend. Configura seguridad HTTP (helmet,
 * CORS), prefijo y versionado de la API, validación global, Swagger,
 * logger estructurado y apagado ordenado (SIGTERM en Docker).
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
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

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Fotos y PDF protegidos se muestran como blob: tras descargarlos con el token.
          imgSrc: ["'self'", 'data:', 'blob:'],
          // App local por http://localhost: no forzar https.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
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

/**
 * Sirve la SPA compilada (carpeta dist de la raíz) desde el mismo puerto que
 * la API: la aplicación local queda en un solo proceso (ver iniciar.bat).
 */
const serveFrontend = (app: NestExpressApplication): string | null => {
  const dist = app.get(ConfigService).get<string>('frontendDist');
  if (!dist || !existsSync(path.join(dist, 'index.html'))) return null;
  app.useStaticAssets(dist, { index: false });
  const indexHtml = path.join(dist, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isApi = /^\/(api|health|metrics)(\/|$)/.test(req.path);
    if (req.method !== 'GET' || isApi || !req.accepts('html')) return next();
    res.sendFile(indexHtml);
  });
  return dist;
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  const frontendDist = serveFrontend(app);

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
  // Sólo en este equipo: la aplicación local no se expone a la red.
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
  app.get(Logger).log(`PINTOTECH API escuchando en el puerto ${port}`, 'Bootstrap');
  if (frontendDist) {
    app.get(Logger).log(`Aplicación disponible en http://localhost:${port}`, 'Bootstrap');
  }
}

if (require.main === module) {
  void bootstrap();
}
