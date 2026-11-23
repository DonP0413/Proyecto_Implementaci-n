/**
 * Objetivo: Repository del lado de ESCRITURA (Command side) del agregado
 * WorkOrder. Todas las operaciones reciben el EntityManager de la
 * transacción en curso: un caso de uso = una transacción atómica.
 */
import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AttachmentCategory } from '../domain/work-order.enums';
import {
  AttachmentEntity,
  DeliveryRecordEntity,
  QuotationEntity,
  ReceptionConditionEntity,
  StatusHistoryEntity,
  TechnicalLogEntity,
  WorkOrderAccessoryEntity,
  WorkOrderEntity,
} from './entities';

@Injectable()
export class WorkOrdersRepository {
  /** Consecutivo del ID de trabajo (tabla `sequences`). */
  async nextSequence(manager: EntityManager): Promise<number> {
    const rows: Array<{ value: number }> = await manager.query(
      `UPDATE sequences SET value = value + 1 WHERE name = 'work_order_code' RETURNING value`,
    );
    return Number(rows[0].value);
  }

  /**
   * Lee la orden dentro de la transacción. En SQLite las transacciones de la
   * aplicación ya se ejecutan de una en una (ver DatabaseModule), por lo que no
   * hace falta SELECT ... FOR UPDATE.
   */
  lockById(id: string, manager: EntityManager): Promise<WorkOrderEntity | null> {
    return manager.getRepository(WorkOrderEntity).findOne({ where: { id } });
  }

  saveWorkOrder(entity: Partial<WorkOrderEntity>, manager: EntityManager): Promise<WorkOrderEntity> {
    const repo = manager.getRepository(WorkOrderEntity);
    return repo.save(repo.create(entity));
  }

  async updateWorkOrder(
    id: string,
    changes: Partial<WorkOrderEntity>,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(WorkOrderEntity).update({ id }, changes);
  }

  saveReception(
    data: Partial<ReceptionConditionEntity>,
    manager: EntityManager,
  ): Promise<ReceptionConditionEntity> {
    const repo = manager.getRepository(ReceptionConditionEntity);
    return repo.save(repo.create(data));
  }

  async updateReception(
    workOrderId: string,
    changes: Partial<ReceptionConditionEntity>,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(ReceptionConditionEntity).update({ workOrderId }, changes);
  }

  async deleteAttachmentsByCategory(
    workOrderId: string,
    categories: AttachmentCategory[],
    manager: EntityManager,
  ): Promise<void> {
    if (categories.length === 0) return;
    await manager.getRepository(AttachmentEntity).delete({ workOrderId, category: In(categories) });
  }

  saveAccessories(
    items: Array<Partial<WorkOrderAccessoryEntity>>,
    manager: EntityManager,
  ): Promise<WorkOrderAccessoryEntity[]> {
    if (items.length === 0) return Promise.resolve([]);
    const repo = manager.getRepository(WorkOrderAccessoryEntity);
    return repo.save(items.map((item) => repo.create(item)));
  }

  async markAccessoriesReturned(workOrderId: string, ids: string[], manager: EntityManager): Promise<void> {
    if (ids.length === 0) return;
    await manager
      .getRepository(WorkOrderAccessoryEntity)
      .update({ workOrderId, id: In(ids) }, { returned: true });
  }

  saveQuotation(data: Partial<QuotationEntity>, manager: EntityManager): Promise<QuotationEntity> {
    const repo = manager.getRepository(QuotationEntity);
    return repo.save(repo.create(data));
  }

  findLatestQuotation(workOrderId: string, manager: EntityManager): Promise<QuotationEntity | null> {
    return manager
      .getRepository(QuotationEntity)
      .findOne({ where: { workOrderId }, order: { createdAt: 'DESC' } });
  }

  async markQuotationNotified(id: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(QuotationEntity).update({ id }, { notifiedAt: new Date() });
  }

  saveTechnicalLog(data: Partial<TechnicalLogEntity>, manager: EntityManager): Promise<TechnicalLogEntity> {
    const repo = manager.getRepository(TechnicalLogEntity);
    return repo.save(repo.create(data));
  }

  saveDelivery(data: Partial<DeliveryRecordEntity>, manager: EntityManager): Promise<DeliveryRecordEntity> {
    const repo = manager.getRepository(DeliveryRecordEntity);
    return repo.save(repo.create(data));
  }

  saveAttachment(data: Partial<AttachmentEntity>, manager: EntityManager): Promise<AttachmentEntity> {
    const repo = manager.getRepository(AttachmentEntity);
    return repo.save(repo.create(data));
  }

  addStatusHistory(data: Partial<StatusHistoryEntity>, manager: EntityManager): Promise<StatusHistoryEntity> {
    const repo = manager.getRepository(StatusHistoryEntity);
    return repo.save(repo.create(data));
  }

  findAttachmentsByCategory(
    workOrderId: string,
    categories: AttachmentCategory[],
    manager: EntityManager,
  ): Promise<AttachmentEntity[]> {
    return manager.getRepository(AttachmentEntity).find({
      where: { workOrderId, category: In(categories) },
      order: { createdAt: 'ASC' },
    });
  }

  /** Carga el agregado con lo necesario para los PDF del cliente (sin el registro técnico interno). */
  findForClientDocuments(id: string, manager: EntityManager): Promise<WorkOrderEntity | null> {
    return manager.getRepository(WorkOrderEntity).findOne({
      where: { id },
      relations: {
        client: true,
        equipment: { equipmentType: true },
        receptionCondition: true,
        accessories: true,
        quotations: { createdBy: true },
        deliveryRecord: { deliveredBy: true },
        receivedBy: true,
      },
    });
  }
}
