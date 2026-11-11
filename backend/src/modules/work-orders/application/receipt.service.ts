/**
 * Objetivo: caso de uso del comprobante de ingreso (requerimiento 3).
 *  - generate(): arma los datos visibles al cliente y produce el PDF.
 *  - getReceipt(): devuelve el PDF almacenado; si no existe (datos migrados),
 *    lo regenera al vuelo.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { DataSource } from 'typeorm';
import { NotFoundError } from '../../../common/errors/domain.errors';
import { FILE_STORAGE, FileStorage } from '../../../infrastructure/storage/file-storage.port';
import {
  AttachmentCategory,
  PHYSICAL_CONDITION_LABELS,
  POWER_STATUS_LABELS,
} from '../domain/work-order.enums';
import type { WorkOrderEntity } from '../infrastructure/entities';
import { ReceiptData, ReceiptPdfGenerator } from '../infrastructure/receipt-pdf.generator';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { formatDate, formatDateTime } from './formatters';
import type { ValidatedFile } from './file-upload.policy';
import { specsWithLabels } from './work-order.mapper';

@Injectable()
export class ReceiptService {
  constructor(
    private readonly generator: ReceiptPdfGenerator,
    private readonly config: ConfigService,
    private readonly workOrders: WorkOrdersRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  buildData(wo: WorkOrderEntity, photo?: Pick<ValidatedFile, 'buffer' | 'mimeType'>): ReceiptData {
    const timeZone = this.config.get<string>('workOrders.timezone') ?? 'America/Guayaquil';
    const rc = wo.receptionCondition;
    return {
      company: this.config.get('company') ?? { name: 'PINTOTECH' },
      code: wo.code,
      receivedAt: formatDateTime(wo.receivedAt, timeZone),
      receivedBy: wo.receivedBy?.fullName ?? '',
      client: {
        fullName: wo.client.fullName,
        documentId: wo.client.documentId,
        email: wo.client.email,
        phone: wo.client.phone,
        address: wo.client.address,
      },
      equipment: {
        typeName: wo.equipment.equipmentType?.name ?? '',
        brand: wo.equipment.brand,
        model: wo.equipment.model,
        serialNumber: wo.equipment.serialNumber,
        specs: specsWithLabels(wo.equipment.equipmentType?.specSchema, wo.specsSnapshot),
      },
      reportedIssue: wo.reportedIssue,
      reception: {
        powerStatus: rc ? POWER_STATUS_LABELS[rc.powerStatus] : '',
        physicalCondition: rc ? PHYSICAL_CONDITION_LABELS[rc.physicalCondition] : '',
        visibleDamage: rc?.visibleDamage,
        functionalNotes: rc?.functionalNotes,
      },
      accessories: (wo.accessories ?? []).map((a) => ({
        name: a.name,
        quantity: a.quantity,
        notes: a.notes,
      })),
      estimatedDeliveryDate: wo.estimatedDeliveryDate ? formatDate(wo.estimatedDeliveryDate) : null,
      photo: photo ? { content: photo.buffer, mimeType: photo.mimeType } : undefined,
    };
  }

  generate(wo: WorkOrderEntity, photo?: Pick<ValidatedFile, 'buffer' | 'mimeType'>): Promise<Buffer> {
    return this.generator.generate(this.buildData(wo, photo));
  }

  async getReceipt(workOrderId: string): Promise<{ filename: string; stream: Readable }> {
    const manager = this.dataSource.manager;
    const wo = await this.workOrders.findForClientDocuments(workOrderId, manager);
    if (!wo) throw new NotFoundError('Orden de trabajo', workOrderId);
    const filename = `comprobante-${wo.code}.pdf`;
    const [stored] = await this.workOrders.findAttachmentsByCategory(
      workOrderId,
      [AttachmentCategory.RECEIPT_PDF],
      manager,
    );
    if (stored) {
      try {
        return { filename, stream: await this.storage.stream(stored.storageKey) };
      } catch {
        // si el archivo físico se perdió, se regenera abajo
      }
    }
    return { filename, stream: Readable.from(await this.generate(wo)) };
  }
}
