/**
 * Objetivo: casos de uso de clientes. `resolveForWorkOrder` implementa la
 * regla de negocio de recepción: si llega un clientId se usa; si llegan
 * datos y existe un cliente con el mismo documento, se reutiliza y se
 * actualizan sus datos de contacto; si no, se crea uno nuevo.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { InvalidInputError, ConflictError, NotFoundError } from '../../common/errors/domain.errors';
import { paginate, Paginated } from '../../common/pagination/pagination';
import { todayLocalDate } from '../../common/time/local-date';
import { ClientEntity } from './client.entity';
import { ClientsRepository } from './clients.repository';
import { ClientQueryDto, ClientResponseDto, CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly clients: ClientsRepository,
    private readonly config: ConfigService,
  ) {}

  async search(query: ClientQueryDto): Promise<Paginated<ClientResponseDto>> {
    const [items, total] = await this.clients.search(query.q, query.page, query.limit);
    return paginate(items.map(ClientResponseDto.from), total, query.page, query.limit);
  }

  async get(id: string): Promise<ClientResponseDto> {
    return ClientResponseDto.from(await this.getEntity(id));
  }

  async create(dto: CreateClientDto): Promise<ClientResponseDto> {
    if (dto.documentId && (await this.clients.findByDocumentId(dto.documentId))) {
      throw new ConflictError('Ya existe un cliente con ese documento', 'CLIENT_DOCUMENT_TAKEN');
    }
    const saved = await this.clients.save(this.clients.create(this.toNewEntityData(dto)));
    return ClientResponseDto.from(saved);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const client = await this.getEntity(id);
    if (dto.documentId && dto.documentId !== client.documentId) {
      const other = await this.clients.findByDocumentId(dto.documentId);
      if (other && other.id !== id) {
        throw new ConflictError('Ya existe un cliente con ese documento', 'CLIENT_DOCUMENT_TAKEN');
      }
    }
    Object.assign(client, this.toEntityData(dto));
    const saved = await this.clients.save(client);
    return ClientResponseDto.from(saved);
  }

  async resolveForWorkOrder(
    input: { clientId?: string; client?: CreateClientDto },
    manager: EntityManager,
  ): Promise<ClientEntity> {
    if (input.clientId) {
      const existing = await this.clients.findById(input.clientId, manager);
      if (!existing) throw new NotFoundError('Cliente', input.clientId);
      if (!existing.documentId) {
        throw new InvalidInputError(
          'El cliente seleccionado no tiene cédula / RUC registrado. Actualice sus datos antes de registrar el ingreso.',
          'CLIENT_DOCUMENT_REQUIRED',
        );
      }
      return existing;
    }
    if (!input.client) {
      throw new InvalidInputError('Debe indicar clientId o los datos del cliente', 'CLIENT_REQUIRED');
    }
    const data = input.client;
    if (!data.documentId) {
      throw new InvalidInputError('La cédula / RUC del cliente es obligatoria', 'CLIENT_DOCUMENT_REQUIRED');
    }
    const byDocument = await this.clients.findByDocumentId(data.documentId, manager);
    if (byDocument) {
      // Cliente ya registrado: se actualiza su CONTACTO (correo, teléfono, dirección), pero se
      // conservan su nombre y su fecha de ingreso. Antes se sobrescribía el nombre sin avisar.
      Object.assign(byDocument, this.toEntityData({ ...data, fullName: undefined, registeredAt: undefined }));
      return this.clients.save(byDocument, manager);
    }
    return this.clients.save(this.clients.create(this.toNewEntityData(data), manager), manager);
  }

  async updateForIntake(id: string, dto: UpdateClientDto, manager: EntityManager): Promise<ClientEntity> {
    const client = await this.clients.findById(id, manager);
    if (!client) throw new NotFoundError('Cliente', id);
    if (dto.documentId && dto.documentId !== client.documentId) {
      const other = await this.clients.findByDocumentId(dto.documentId, manager);
      if (other && other.id !== id) {
        throw new ConflictError('Ya existe un cliente con ese documento', 'CLIENT_DOCUMENT_TAKEN');
      }
    }
    Object.assign(client, this.toEntityData(dto));
    return this.clients.save(client, manager);
  }

  async getEntity(id: string): Promise<ClientEntity> {
    const client = await this.clients.findById(id);
    if (!client) throw new NotFoundError('Cliente', id);
    return client;
  }

  /** Alta: si no se indica la fecha de ingreso, es hoy (zona horaria del negocio). */
  private toNewEntityData(dto: CreateClientDto): Partial<ClientEntity> {
    return { ...this.toEntityData(dto), registeredAt: dto.registeredAt ?? this.today() };
  }

  private today(): string {
    return todayLocalDate(this.config.get<string>('workOrders.timezone'));
  }

  private toEntityData(dto: Partial<CreateClientDto>): Partial<ClientEntity> {
    const data: Partial<ClientEntity> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.documentId !== undefined) data.documentId = dto.documentId ?? null;
    if (dto.phone !== undefined) data.phone = dto.phone ?? null;
    if (dto.address !== undefined) data.address = dto.address ?? null;
    if (dto.registeredAt !== undefined) {
      // Formato AAAA-MM-DD: la comparación de cadenas equivale a la de fechas.
      if (dto.registeredAt > this.today()) {
        throw new InvalidInputError(
          'La fecha de ingreso del cliente no puede ser futura',
          'REGISTERED_AT_IN_FUTURE',
        );
      }
      data.registeredAt = dto.registeredAt;
    }
    return data;
  }
}
