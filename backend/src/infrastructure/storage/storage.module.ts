/**
 * Objetivo: proveer el adaptador de almacenamiento según STORAGE_DRIVER
 * (Factory Provider). Global porque varios módulos adjuntan archivos.
 */
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE } from './file-storage.port';
import { LocalFileStorageAdapter } from './local-file-storage.adapter';

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('storage.driver');
        switch (driver) {
          case 'local':
          default:
            return new LocalFileStorageAdapter(config.getOrThrow<string>('storage.localPath'));
        }
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
