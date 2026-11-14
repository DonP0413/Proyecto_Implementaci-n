/**
 * Objetivo: Repository del lado de LECTURA (Query side, CQRS ligero).
 * Consultas optimizadas para búsqueda (requerimiento 9) y vistas de
 * detalle; no modifican estado. Los filtros usan los índices definidos en
 * V1 (trigram para búsquedas parciales, compuesto status+received_at).
 */
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource } from 'typeorm';
import { WorkOrderStatus } from '../domain/work-order-status';
import { AttachmentEntity, WorkOrderEntity } from './entities';

export interface WorkOrderSearchFilters {
  q?: string;
  code?: string;
  client?: string;
  clientId?: string;
  equipmentId?: string;
  serial?: string;
  status?: WorkOrderStatus[];
  dateFrom?: string;
  dateTo?: string;
  technicianId?: string;
  page: number;
  limit: number;
}

const like = (value: string) => `%${value.replace(/[%_\\]/g, '\\$&')}%`;

@Injectable()
export class WorkOrdersQueryRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async search(filters: WorkOrderSearchFilters): Promise<[WorkOrderEntity[], number]> {
    const qb = this.dataSource
      .getRepository(WorkOrderEntity)
      .createQueryBuilder('wo')
      .innerJoinAndSelect('wo.client', 'c')
      .innerJoinAndSelect('wo.equipment', 'e')
      .innerJoinAndSelect('e.equipmentType', 't')
      .leftJoinAndSelect('wo.assignedTechnician', 'tech')
      .orderBy('wo.receivedAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (filters.q) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('wo.code ILIKE :q', { q: like(filters.q!) })
            .orWhere('c.fullName ILIKE :q')
            .orWhere('c.email ILIKE :q')
            .orWhere('c.documentId ILIKE :q')
            .orWhere('e.serialNumber ILIKE :q')
            .orWhere('e.model ILIKE :q'),
        ),
      );
    }
    if (filters.code) qb.andWhere('wo.code ILIKE :code', { code: like(filters.code) });
    if (filters.client) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('c.fullName ILIKE :client', { client: like(filters.client!) })
            .orWhere('c.email ILIKE :client')
            .orWhere('c.documentId ILIKE :client'),
        ),
      );
    }
    if (filters.clientId) qb.andWhere('wo.clientId = :clientId', { clientId: filters.clientId });
    if (filters.equipmentId) qb.andWhere('wo.equipmentId = :equipmentId', { equipmentId: filters.equipmentId });
    if (filters.serial) qb.andWhere('e.serialNumber ILIKE :serial', { serial: like(filters.serial) });
    if (filters.status?.length) qb.andWhere('wo.status IN (:...status)', { status: filters.status });
    if (filters.technicianId) {
      qb.andWhere('wo.assignedTechnicianId = :technicianId', { technicianId: filters.technicianId });
    }
    const timeZone = this.config?.get<string>('workOrders.timezone') ?? 'America/Guayaquil';
    if (filters.dateFrom) {
      qb.andWhere('wo.receivedAt >= (CAST(:dateFrom AS timestamp) AT TIME ZONE :timeZone)', {
        dateFrom: filters.dateFrom.slice(0, 10),
        timeZone,
      });
    }
    if (filters.dateTo) {
      // dateTo inclusivo: se compara contra el inicio del día siguiente en la zona horaria del negocio
      qb.andWhere(
        `wo.receivedAt < ((CAST(:dateTo AS timestamp) + INTERVAL '1 day') AT TIME ZONE :timeZone)`,
        {
          dateTo: filters.dateTo.slice(0, 10),
          timeZone,
        },
      );
    }
    return qb.getManyAndCount();
  }

  findDetail(id: string): Promise<WorkOrderEntity | null> {
    return this.dataSource.getRepository(WorkOrderEntity).findOne({
      where: { id },
      relations: {
        client: true,
        equipment: { equipmentType: true },
        receivedBy: true,
        assignedTechnician: true,
        receptionCondition: true,
        accessories: true,
        quotations: { createdBy: true },
        technicalLogs: { author: true },
        deliveryRecord: { deliveredBy: true },
        attachments: true,
        statusHistory: { changedBy: true },
      },
      order: {
        quotations: { createdAt: 'DESC' },
        technicalLogs: { createdAt: 'DESC' },
        attachments: { createdAt: 'ASC' },
        statusHistory: { changedAt: 'ASC' },
      },
    });
  }

  findByCode(code: string): Promise<WorkOrderEntity | null> {
    return this.dataSource.getRepository(WorkOrderEntity).findOne({ where: { code: code.toUpperCase() } });
  }

  findAttachment(workOrderId: string, attachmentId: string): Promise<AttachmentEntity | null> {
    return this.dataSource
      .getRepository(AttachmentEntity)
      .findOne({ where: { id: attachmentId, workOrderId } });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.dataSource.getRepository(WorkOrderEntity).count({ where: { id } })) > 0;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows: Array<{ status: string; total: string }> = await this.dataSource.query(
      'SELECT status, count(*)::int AS total FROM work_orders GROUP BY status',
    );
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
  }
}
