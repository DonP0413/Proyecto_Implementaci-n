/**
 * Objetivo: gestionar adjuntos (fotos y documentos).
 * Coordina dos recursos que no comparten transacción (BD y disco):
 *   1. Escribe el archivo en el almacenamiento y registra la clave en un
 *      "tracker".
 *   2. Inserta la fila en `attachments` dentro de la transacción del caso de uso.
 *   3. Si la transacción falla, `cleanup(tracker)` borra los archivos huérfanos
 *      (compensación).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Readable } from 'node:stream';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import { BusinessRuleError, InvalidInputError, NotFoundError } from '../../../common/errors/domain.errors';
import { FILE_STORAGE, FileStorage } from '../../../infrastructure/storage/file-storage.port';
import { WorkOrderStatus } from '../domain/work-order-status';
import { ATTACHMENT_VISIBILITY, AttachmentCategory } from '../domain/work-order.enums';
import { AttachmentEntity, TechnicalLogEntity } from '../infrastructure/entities';
import { WorkOrdersQueryRepository } from '../infrastructure/work-orders-query.repository';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { AttachmentDto } from './dto/work-order-output.dto';
import { UploadAttachmentDto } from './dto/work-order-input.dto';
import { FileUploadPolicy, UploadedFileLike, ValidatedFile } from './file-upload.policy';
import { WorkOrderMapper } from './work-order.mapper';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly workOrders: WorkOrdersRepository,
    private readonly queries: WorkOrdersQueryRepository,
  ) {}

  validateAll(files: UploadedFileLike[] | undefined, category: AttachmentCategory): ValidatedFile[] {
    return (files ?? []).map((file) => FileUploadPolicy.validate(file, category));
  }

  async persist(
    params: {
      workOrderId: string;
      category: AttachmentCategory;
      files: ValidatedFile[];
      uploadedById: string | null;
      technicalLogId?: string | null;
    },
    manager: EntityManager,
    tracker: string[],
  ): Promise<AttachmentEntity[]> {
    const saved: AttachmentEntity[] = [];
    for (const file of params.files) {
      const stored = await this.storage.save(file.buffer, {
        folder: `work-orders/${params.workOrderId}`,
        extension: file.extension,
      });
      tracker.push(stored.key);
      saved.push(
        await this.workOrders.saveAttachment(
          {
            workOrderId: params.workOrderId,
            technicalLogId: params.technicalLogId ?? null,
            category: params.category,
            visibility: ATTACHMENT_VISIBILITY[params.category],
            originalName: file.originalName,
            storageKey: stored.key,
            mimeType: file.mimeType,
            sizeBytes: stored.sizeBytes,
            uploadedById: params.uploadedById,
          },
          manager,
        ),
      );
    }
    return saved;
  }

  async cleanup(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) =>
        this.storage
          .delete(key)
          .catch((error: Error) =>
            this.logger.error({ key, err: error }, 'No se pudo eliminar el archivo huérfano'),
          ),
      ),
    );
  }

  /** Caso de uso: subir un adjunto suelto a una orden existente. */
  async upload(
    workOrderId: string,
    dto: UploadAttachmentDto,
    file: UploadedFileLike | undefined,
    actor: AuthUser,
  ): Promise<AttachmentDto> {
    if (!file) throw new InvalidInputError('Debe adjuntar un archivo', 'FILE_REQUIRED');
    const category = dto.category as AttachmentCategory;
    const validated = FileUploadPolicy.validate(file, category);
    const tracker: string[] = [];
    try {
      const [saved] = await this.dataSource.transaction(async (manager) => {
        const wo = await this.workOrders.lockById(workOrderId, manager);
        if (!wo) throw new NotFoundError('Orden de trabajo', workOrderId);
        if (
          category === AttachmentCategory.DELIVERY_PHOTO &&
          wo.status !== WorkOrderStatus.ENTREGADO &&
          wo.status !== WorkOrderStatus.LISTO_PARA_RETIRAR
        ) {
          throw new BusinessRuleError('La foto de entrega sólo aplica a equipos listos o entregados');
        }
        if (dto.technicalLogId) {
          if (category !== AttachmentCategory.TECHNICAL_DOCUMENT) {
            throw new InvalidInputError('Sólo los documentos técnicos se asocian a un registro técnico');
          }
          const log = await manager
            .getRepository(TechnicalLogEntity)
            .findOne({ where: { id: dto.technicalLogId, workOrderId } });
          if (!log) throw new NotFoundError('Registro técnico', dto.technicalLogId);
        }
        return this.persist(
          {
            workOrderId,
            category,
            files: [validated],
            uploadedById: actor.id,
            technicalLogId: dto.technicalLogId,
          },
          manager,
          tracker,
        );
      });
      return WorkOrderMapper.attachment(saved);
    } catch (error) {
      await this.cleanup(tracker);
      throw error;
    }
  }

  async open(
    workOrderId: string,
    attachmentId: string,
  ): Promise<{ attachment: AttachmentEntity; stream: Readable }> {
    const attachment = await this.queries.findAttachment(workOrderId, attachmentId);
    if (!attachment) throw new NotFoundError('Adjunto', attachmentId);
    try {
      return { attachment, stream: await this.storage.stream(attachment.storageKey) };
    } catch {
      throw new NotFoundError('Archivo físico del adjunto', attachmentId);
    }
  }
}
