/**
 * Objetivo: módulo raíz. Compone configuración validada, logging
 * estructurado, rate limiting, BD, almacenamiento, métricas y los
 * módulos de negocio. Registra los guards globales en orden:
 *   ThrottlerGuard -> JwtAuthGuard -> RolesGuard
 */
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { configuration } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { UsersModule } from './modules/users/users.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('env') === 'development';
        return {
          pinoHttp: {
            level: config.get<string>('logLevel') ?? 'info',
            transport: isDev
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const header = req.headers['x-request-id'];
              const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', '*.password'],
              censor: '[REDACTED]',
            },
            autoLogging: { ignore: (req: IncomingMessage) => /\/(health|metrics)/.test(req.url ?? '') },
            customProps: () => ({ service: 'pintotech-backend', env: config.get<string>('env') }),
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('throttle.ttlMs') ?? 60000,
          limit: config.get<number>('throttle.limit') ?? 120,
        },
      ],
    }),
    DatabaseModule,
    StorageModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    EquipmentModule,
    WorkOrdersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
