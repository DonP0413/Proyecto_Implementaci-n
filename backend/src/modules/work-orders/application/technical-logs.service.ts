/**
 * Objetivo: caso de uso del REGISTRO INTERNO DEL TÉCNICO (requerimiento 7).
 * Diagnósticos, procedimientos, configuraciones, repuestos y novedades, con
 * documentos de respaldo. Visibilidad INTERNAL forzada por dominio y por
 * CHECK constraint en la BD.
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import { InvalidInputError, NotFoundError } from '../../../common/errors/domain.errors';
import { AttachmentCategory } from '../domain/work-order.enums';
import { WorkOrdersRepository } from '../infrastructure/work-orders.repository';
import { AttachmentsService } from './attachments.service';
import { CreateTechnicalLogDto } from './dto/work-order-input.dto';
import type { TechnicalLogDto } from './dto/work-order-output.dto';
import type { UploadedFileLike } from './file-upload.policy';
import { WorkOrderMapper } from './work-order.mapper';

@Injectable()
export class TechnicalLogsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly workOrders: WorkOrdersRepository,
    private readonly attachments: AttachmentsService,
  ) {}

  async create(
    workOrderId: string,
    dto: CreateTechnicalLogDto,
    documents: UploadedFileLike[] | undefined,
    actor: AuthUser,
  ): Promise<TechnicalLogDto> {
    const hasContent = [
      dto.diagnosis,
      dto.procedures,
      dto.configurations,
      dto.spareParts,
      dto.observations,
    ].some((value) => value && value.length > 0);
    if (!hasContent) {
      throw new InvalidInputError('Complete al menos un campo del registro técnico', 'TECHNICAL_LOG_EMPTY');
    }
    const files = this.attachments.validateAll(documents, AttachmentCategory.TECHNICAL_DOCUMENT);
    const tracker: string[] = [];
    try {
      return await this.dataSource.transaction(async (manager) => {
        const wo = await this.workOrders.lockById(workOrderId, manager);
        if (!wo) throw new NotFoundError('Orden de trabajo', workOrderId);

        const log = await this.workOrders.saveTechnicalLog(
          {
            workOrderId,
            authorId: actor.id,
            diagnosis: dto.diagnosis ?? null,
            procedures: dto.procedures ?? null,
            configurations: dto.configurations ?? null,
            spareParts: dto.spareParts ?? null,
            observations: dto.observations ?? null,
          },
          manager,
        );
        const saved = await this.attachments.persist(
          {
            workOrderId,
            category: AttachmentCategory.TECHNICAL_DOCUMENT,
            files,
            uploadedById: actor.id,
            technicalLogId: log.id,
          },
          manager,
          tracker,
        );
        return {
          id: log.id,
          author: { id: actor.id, fullName: actor.fullName },
          diagnosis: log.diagnosis,
          procedures: log.procedures,
          configurations: log.configurations,
          spareParts: log.spareParts,
          observations: log.observations,
          createdAt: log.createdAt.toISOString(),
          attachments: saved.map(WorkOrderMapper.attachment),
        };
      });
    } catch (error) {
      await this.attachments.cleanup(tracker);
      throw error;
    }
  }
}
