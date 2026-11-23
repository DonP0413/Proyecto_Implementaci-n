/**
 * Objetivo: ensamblar el BOUNDED CONTEXT de órdenes de trabajo.
 * Multer usa memoryStorage (los archivos se validan por magic bytes antes de
 * tocar el disco) con límites de tamaño y cantidad configurables.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '../clients/clients.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { UsersModule } from '../users/users.module';
import { AttachmentsService } from './application/attachments.service';
import { ReceiptService } from './application/receipt.service';
import { TechnicalLogsService } from './application/technical-logs.service';
import { WorkOrderCommandService } from './application/work-order-command.service';
import { WorkOrderQueryService } from './application/work-order-query.service';
import { WORK_ORDER_ENTITIES } from './infrastructure/entities';
import { ReceiptPdfGenerator } from './infrastructure/receipt-pdf.generator';
import { WorkOrdersQueryRepository } from './infrastructure/work-orders-query.repository';
import { WorkOrdersRepository } from './infrastructure/work-orders.repository';
import { WorkOrderRecordsController } from './presentation/work-order-records.controller';
import { WorkOrdersController } from './presentation/work-orders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(WORK_ORDER_ENTITIES),
    MulterModule.registerAsync({
      inject: [ConfigService],
      // Sin `dest` ni `storage`, Multer usa memoria (Buffer) por defecto.
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: (config.get<number>('uploads.maxFileSizeMb') ?? 8) * 1024 * 1024,
          files: config.get<number>('uploads.maxFiles') ?? 6,
          fields: 10,
          fieldSize: 1024 * 1024,
        },
      }),
    }),
    ClientsModule,
    EquipmentModule,
    UsersModule,
  ],
  controllers: [WorkOrdersController, WorkOrderRecordsController],
  providers: [
    WorkOrdersRepository,
    WorkOrdersQueryRepository,
    WorkOrderCommandService,
    WorkOrderQueryService,
    TechnicalLogsService,
    AttachmentsService,
    ReceiptService,
    ReceiptPdfGenerator,
  ],
})
export class WorkOrdersModule {}
