/**
 * Objetivo: Repository Pattern para clientes. Todos los métodos aceptan un
 * EntityManager opcional para participar en transacciones de otros casos de
 * uso (p. ej. el registro de una orden crea el cliente en la misma transacción).
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClientEntity } from './client.entity';

@Injectable()
export class ClientsRepository {
  constructor(@InjectRepository(ClientEntity) private readonly repository: Repository<ClientEntity>) {}

  private repo(manager?: EntityManager): Repository<ClientEntity> {
    return manager ? manager.getRepository(ClientEntity) : this.repository;
  }

  create(data: Partial<ClientEntity>, manager?: EntityManager): ClientEntity {
    return this.repo(manager).create(data);
  }

  save(client: ClientEntity, manager?: EntityManager): Promise<ClientEntity> {
    return this.repo(manager).save(client);
  }

  findById(id: string, manager?: EntityManager): Promise<ClientEntity | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  findByDocumentId(documentId: string, manager?: EntityManager): Promise<ClientEntity | null> {
    return this.repo(manager).findOne({ where: { documentId } });
  }

  async search(q: string | undefined, page: number, limit: number): Promise<[ClientEntity[], number]> {
    const qb = this.repository.createQueryBuilder('c').orderBy('c.fullName', 'ASC');
    if (q) {
      qb.where(
        '(c.fullName ILIKE :like OR c.email ILIKE :like OR c.documentId ILIKE :like OR c.phone ILIKE :like)',
        { like: `%${q.replace(/[%_]/g, '\\$&')}%` },
      );
    }
    return qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }
}
