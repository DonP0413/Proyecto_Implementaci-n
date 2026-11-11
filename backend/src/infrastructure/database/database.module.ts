/**
 * Objetivo: configurar la conexión a PostgreSQL vía TypeORM.
 * - synchronize SIEMPRE false: el esquema lo gobiernan las migraciones SQL
 *   versionadas en /database/migrations (fuente única de verdad).
 * - autoLoadEntities: cada módulo registra sus entidades con forFeature.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('database.host'),
        port: config.getOrThrow<number>('database.port'),
        username: config.getOrThrow<string>('database.user'),
        password: config.getOrThrow<string>('database.password'),
        database: config.getOrThrow<string>('database.name'),
        ssl: config.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        logging: config.get<boolean>('database.logging') ? ['query', 'error'] : ['error'],
        extra: {
          max: config.get<number>('database.poolMax'),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          application_name: 'pintotech-backend',
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
