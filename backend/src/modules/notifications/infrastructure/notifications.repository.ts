/**
 * Objetivo: Repository de la cola outbox. `claimBatch` usa
 * FOR UPDATE SKIP LOCKED: varias réplicas del backend pueden procesar la
 * cola en paralelo sin enviar dos veces el mismo correo.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { NotificationStatus, NotificationType } from '../domain/notification.enums';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(NotificationEntity) private readonly repository: Repository<NotificationEntity>,
  ) {}

  private repo(manager?: EntityManager): Repository<NotificationEntity> {
    return manager ? manager.getRepository(NotificationEntity) : this.repository;
  }

  create(data: Partial<NotificationEntity>, manager?: EntityManager): NotificationEntity {
    return this.repo(manager).create(data);
  }

  save(entity: NotificationEntity, manager?: EntityManager): Promise<NotificationEntity> {
    return this.repo(manager).save(entity);
  }

  findById(id: string): Promise<NotificationEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  listByWorkOrder(workOrderId: string): Promise<NotificationEntity[]> {
    return this.repository.find({ where: { workOrderId }, order: { createdAt: 'DESC' } });
  }

  listByStatus(status: NotificationStatus, limit = 100): Promise<NotificationEntity[]> {
    return this.repository.find({ where: { status }, order: { createdAt: 'DESC' }, take: limit });
  }

  async hasActive(workOrderId: string, type: NotificationType, manager?: EntityManager): Promise<boolean> {
    const count = await this.repo(manager).count({
      where: { workOrderId, type, status: In([NotificationStatus.PENDING, NotificationStatus.SENDING]) },
    });
    return count > 0;
  }

  async claimBatch(limit: number): Promise<NotificationEntity[]> {
    const rows: Array<{ id: string }> = await this.repository.query(
      `WITH claimed AS (
         UPDATE notifications
            SET status = 'SENDING', attempts = attempts + 1, updated_at = now()
          WHERE id IN (
            SELECT id FROM notifications
             WHERE status = 'PENDING' AND next_attempt_at <= now()
             ORDER BY next_attempt_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED)
         RETURNING id)
       SELECT id FROM claimed`,
      [limit],
    );
    if (rows.length === 0) return [];
    return this.repository.find({ where: { id: In(rows.map((r) => r.id)) } });
  }

  async releaseStuck(olderThanMinutes: number): Promise<void> {
    await this.repository.query(
      `UPDATE notifications SET status = 'PENDING', next_attempt_at = now()
        WHERE status = 'SENDING' AND updated_at < now() - make_interval(mins => $1)`,
      [olderThanMinutes],
    );
  }

  async markSent(id: string, providerMessageId: string): Promise<void> {
    await this.repository.update(
      { id },
      { status: NotificationStatus.SENT, providerMessageId, sentAt: new Date(), lastError: null },
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.repository.update(
      { id },
      { status: NotificationStatus.FAILED, lastError: error.slice(0, 2000) },
    );
  }

  async scheduleRetry(id: string, error: string, nextAttemptAt: Date): Promise<void> {
    await this.repository.update(
      { id },
      { status: NotificationStatus.PENDING, lastError: error.slice(0, 2000), nextAttemptAt },
    );
  }

  async resetForManualRetry(id: string): Promise<void> {
    await this.repository.update(
      { id },
      { status: NotificationStatus.PENDING, attempts: 0, nextAttemptAt: new Date() },
    );
  }

  countPending(): Promise<number> {
    return this.repository.count({ where: { status: NotificationStatus.PENDING } });
  }
}
