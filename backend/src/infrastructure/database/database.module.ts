/**
 * Objetivo: configurar la base de datos SQLite local (archivo único) vía TypeORM.
 * - Antes de conectar se aplican las migraciones SQL versionadas de
 *   /database/migrations y se crea el administrador inicial (prepareDatabase).
 * - synchronize SIEMPRE false: el esquema lo gobiernan las migraciones.
 * - SQLite usa UNA sola conexión: las transacciones se serializan para que
 *   dos peticiones simultáneas no se mezclen en la misma transacción.
 */
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions, EntityManager } from 'typeorm';
import { prepareDatabase } from './database-bootstrap';

/** Cola simple: cada transacción espera a que termine la anterior. */
const serializeTransactions = (manager: EntityManager): void => {
  const original = manager.transaction.bind(manager) as (...args: unknown[]) => Promise<unknown>;
  let queue: Promise<unknown> = Promise.resolve();
  (manager as { transaction: unknown }).transaction = (...args: unknown[]) => {
    const run = queue.then(() => original(...args));
    queue = run.catch(() => undefined);
    return run;
  };
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const dbPath = config.getOrThrow<string>('database.path');
        await prepareDatabase(
          dbPath,
          config.getOrThrow<string>('database.migrationsDir'),
          config.get('admin') ?? {},
          (message) => new Logger('Database').log(message),
        );
        return {
          type: 'better-sqlite3' as const,
          database: dbPath,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          logging: config.get<boolean>('database.logging') ? ['query', 'error'] : ['error'],
        };
      },
      dataSourceFactory: async (options?: DataSourceOptions) => {
        const dataSource = await new DataSource(options!).initialize();
        serializeTransactions(dataSource.manager);
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}
