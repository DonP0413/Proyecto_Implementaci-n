/**
 * Objetivo: casos de uso de los documentos PDF para el cliente:
 *  - generate() / getReceipt(): comprobante de INGRESO (requerimiento 3). Se
 *    guarda al registrar la orden; si el archivo no existe, se regenera.
 *  - getQuotationPdf(): COTIZACIÓN vigente (la más reciente).
 *  - getReadyForPickupPdf(): equipo LISTO PARA ENTREGAR (o comprobante de
 *    entrega si la orden ya fue entregada).
 * Los PDF de cotización y de entrega se generan al vuelo con los datos actuales.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { DataSource } from 'typeorm';
import { BusinessRuleError, NotFoundError } from '../../../common/errors/domain.errors';
import { FILE_STORAGE, FileStorage } from '../../../infrastructure/storage/file-storage.port';
import { WORK_ORDER_STATUS_LABELS, WorkOrderStatus } from '../domain/work-order-status';
import {
  AttachmentCategory,
  PHYSICAL_CONDITION_LABELS,
  POWER_STATUS_LABELS,
} from '../domain/work-order.enums';
import type { WorkOrderEntity } from '../infrastructure/entities';
import { ReceiptData, ReceiptPdfGenerator, WorkOrderPdfBase } from '../infrastructure/receipt-pdf.generator';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { formatDate, formatDateTime, formatMoney } from './formatters';
import type { ValidatedFile } from './file-upload.policy';
import { specsWithLabels } from './work-order.mapper';

export interface PdfFile {
  filename: string;
  stream: Readable;
}

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
    const rc = wo.receptionCondition;
    return {
      ...this.base(wo),
      receivedBy: wo.receivedBy?.fullName ?? '',
      reception: {
        powerStatus: rc ? POWER_STATUS_LABELS[rc.powerStatus] : '',
        physicalCondition: rc ? PHYSICAL_CONDITION_LABELS[rc.physicalCondition] : '',
        visibleDamage: rc?.visibleDamage,
        functionalNotes: rc?.functionalNotes,
      },
      estimatedDeliveryDate: wo.estimatedDeliveryDate ? formatDate(wo.estimatedDeliveryDate) : null,
      photo: photo ? { content: photo.buffer, mimeType: photo.mimeType } : undefined,
    };
  }

  generate(wo: WorkOrderEntity, photo?: Pick<ValidatedFile, 'buffer' | 'mimeType'>): Promise<Buffer> {
    return this.generator.generate(this.buildData(wo, photo));
  }

  async getReceipt(workOrderId: string): Promise<PdfFile> {
    const manager = this.dataSource.manager;
    const wo = await this.load(workOrderId);
    const filename = `comprobante-ingreso-${wo.code}.pdf`;
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

  async getQuotationPdf(workOrderId: string): Promise<PdfFile> {
    const wo = await this.load(workOrderId);
    const quotation = this.latestQuotation(wo);
    if (!quotation) {
      throw new BusinessRuleError(
        'La orden todavía no tiene una cotización registrada',
        'QUOTATION_REQUIRED',
      );
    }
    const pdf = await this.generator.generateQuotation({
      ...this.base(wo),
      issuedAt: formatDateTime(new Date(), this.timeZone()),
      quotation: {
        amount: formatMoney(quotation.amount),
        description: quotation.description,
        estimatedDays: quotation.estimatedDays,
        createdAt: formatDateTime(quotation.createdAt, this.timeZone()),
        createdBy: quotation.createdBy?.fullName ?? null,
      },
    });
    return { filename: `cotizacion-${wo.code}.pdf`, stream: Readable.from(pdf) };
  }

  async getReadyForPickupPdf(workOrderId: string): Promise<PdfFile> {
    const wo = await this.load(workOrderId);
    if (![WorkOrderStatus.LISTO_PARA_RETIRAR, WorkOrderStatus.ENTREGADO].includes(wo.status)) {
      throw new BusinessRuleError(
        `El documento de entrega está disponible cuando la orden está "Listo para retirar" (estado actual: ${WORK_ORDER_STATUS_LABELS[wo.status]})`,
        'READY_PDF_NOT_ALLOWED',
        { status: wo.status },
      );
    }
    const quotation = this.latestQuotation(wo);
    const dr = wo.deliveryRecord;
    const pdf = await this.generator.generateReadyForPickup({
      ...this.base(wo),
      issuedAt: formatDateTime(new Date(), this.timeZone()),
      quotation: quotation
        ? { amount: formatMoney(quotation.amount), description: quotation.description }
        : null,
      delivery: dr
        ? {
            deliveredAt: formatDateTime(dr.deliveredAt, this.timeZone()),
            workSummary: dr.workSummary,
            amountCharged: formatMoney(dr.amountCharged),
            returnCondition: dr.returnCondition,
            accessoriesNotes: dr.accessoriesNotes,
            receivedByName: dr.receivedByName,
            receivedByDocument: dr.receivedByDocument,
            deliveredBy: dr.deliveredBy?.fullName ?? null,
          }
        : null,
    });
    const prefix = dr ? 'comprobante-entrega' : 'listo-para-entregar';
    return { filename: `${prefix}-${wo.code}.pdf`, stream: Readable.from(pdf) };
  }

  // ---------------------------------------------------------------- helpers

  private async load(workOrderId: string): Promise<WorkOrderEntity> {
    const wo = await this.workOrders.findForClientDocuments(workOrderId, this.dataSource.manager);
    if (!wo) throw new NotFoundError('Orden de trabajo', workOrderId);
    return wo;
  }

  private latestQuotation(wo: WorkOrderEntity) {
    return [...(wo.quotations ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private timeZone(): string {
    return this.config.get<string>('workOrders.timezone') ?? 'America/Guayaquil';
  }

  private base(wo: WorkOrderEntity): WorkOrderPdfBase {
    return {
      company: this.config.get('company') ?? { name: 'PINTOTECH' },
      code: wo.code,
      receivedAt: formatDateTime(wo.receivedAt, this.timeZone()),
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
      accessories: (wo.accessories ?? []).map((a) => ({
        name: a.name,
        quantity: a.quantity,
        notes: a.notes,
      })),
    };
  }
}
