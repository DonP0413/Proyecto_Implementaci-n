/**
 * Objetivo: casos de uso de equipos.
 * - normalizeSpecs: sólo acepta las claves definidas en el spec_schema del
 *   tipo (evita basura en JSONB), valida listas de opciones y rangos
 *   numéricos, y admite hasta 10 especificaciones adicionales libres.
 * - resolveForWorkOrder: reutiliza el equipo si ya existe (mismo cliente,
 *   serie y marca) para conservar el historial de reparaciones.
 */
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { InvalidInputError, NotFoundError } from '../../common/errors/domain.errors';
import { EquipmentInputDto, EquipmentResponseDto, EquipmentTypeResponseDto } from './dto/equipment.dto';
import {
  EquipmentTypeEntity,
  EXTRA_SPEC_PREFIX,
  MAX_EXTRA_SPEC_NAME,
  MAX_EXTRA_SPECS,
  SpecField,
} from './equipment-type.entity';
import { EquipmentEntity } from './equipment.entity';
import { EquipmentRepository } from './equipment.repository';

const MAX_SPEC_LENGTH = 500;

@Injectable()
export class EquipmentService {
  constructor(private readonly equipment: EquipmentRepository) {}

  async listTypes(): Promise<EquipmentTypeResponseDto[]> {
    return (await this.equipment.listActiveTypes()).map(EquipmentTypeResponseDto.from);
  }

  async findBySerial(serial: string): Promise<EquipmentResponseDto[]> {
    return (await this.equipment.findBySerial(serial)).map(EquipmentResponseDto.from);
  }

  normalizeSpecs(type: EquipmentTypeEntity, specs: Record<string, unknown> = {}): Record<string, string> {
    const fields = new Map(
      type.specSchema.filter((field) => !field.legacy).map((field) => [field.key, field]),
    );
    const result: Record<string, string> = {};
    let extras = 0;
    for (const [rawKey, raw] of Object.entries(specs)) {
      if (raw === null || raw === undefined) continue;
      const value = String(raw).trim();
      if (!value) continue;
      if (value.length > MAX_SPEC_LENGTH) {
        throw new InvalidInputError(`La característica "${rawKey}" supera ${MAX_SPEC_LENGTH} caracteres`);
      }
      if (rawKey.startsWith(EXTRA_SPEC_PREFIX)) {
        const name = rawKey.slice(EXTRA_SPEC_PREFIX.length).trim();
        if (!name) continue;
        if (name.length > MAX_EXTRA_SPEC_NAME) {
          throw new InvalidInputError(
            `El nombre de la especificación adicional "${name}" supera ${MAX_EXTRA_SPEC_NAME} caracteres`,
          );
        }
        if (++extras > MAX_EXTRA_SPECS) {
          throw new InvalidInputError(`Máximo ${MAX_EXTRA_SPECS} especificaciones adicionales`);
        }
        result[EXTRA_SPEC_PREFIX + name] = value;
        continue;
      }
      const field = fields.get(rawKey);
      if (!field) continue;
      result[rawKey] = this.validateSpecValue(field, value);
    }
    return result;
  }

  private validateSpecValue(field: SpecField, value: string): string {
    const name = field.group ? `${field.group} · ${field.label}` : field.label;
    if (field.type === 'select' && field.options?.length && !field.options.includes(value)) {
      throw new InvalidInputError(`"${value}" no es una opción válida para ${name}`, 'INVALID_SPEC_OPTION');
    }
    if (field.type === 'number') {
      const number = Number(value.replace(',', '.'));
      if (!Number.isFinite(number)) {
        throw new InvalidInputError(`${name} debe ser un número`, 'INVALID_SPEC_NUMBER');
      }
      if (
        (field.min !== undefined && number < field.min) ||
        (field.max !== undefined && number > field.max)
      ) {
        throw new InvalidInputError(
          `${name} debe estar entre ${field.min ?? '−∞'} y ${field.max ?? '∞'}`,
          'INVALID_SPEC_NUMBER',
        );
      }
      return String(number);
    }
    return value;
  }

  async resolveForWorkOrder(
    clientId: string,
    input: EquipmentInputDto,
    manager: EntityManager,
  ): Promise<{ equipment: EquipmentEntity; type: EquipmentTypeEntity }> {
    const type = await this.equipment.findTypeById(input.equipmentTypeId, manager);
    if (!type || !type.isActive) throw new NotFoundError('Tipo de equipo', String(input.equipmentTypeId));

    const specs = this.normalizeSpecs(type, input.technicalSpecs);
    const serial = input.serialNumber ?? null;

    let equipment = serial
      ? await this.equipment.findMatching({ clientId, serialNumber: serial, brand: input.brand }, manager)
      : null;

    if (equipment) {
      equipment.model = input.model;
      equipment.equipmentTypeId = type.id;
      equipment.technicalSpecs = { ...equipment.technicalSpecs, ...specs };
    } else {
      equipment = this.equipment.create(
        {
          clientId,
          equipmentTypeId: type.id,
          brand: input.brand,
          model: input.model,
          serialNumber: serial,
          technicalSpecs: specs,
        },
        manager,
      );
    }
    const saved = await this.equipment.save(equipment, manager);
    saved.equipmentType = type;
    return { equipment: saved, type };
  }
}
