/** Objetivo: mapeo ORM del catálogo `equipment_types`. */
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface SpecField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  /** Agrupa campos en el formulario y al mostrarlos ("Memoria RAM"). */
  group?: string;
  placeholder?: string;
  hint?: string;
  /** Unidad que se agrega al mostrar valores numéricos ("GB", "%"). */
  unit?: string;
  /** Opciones válidas cuando type = 'select'. */
  options?: string[];
  min?: number;
  max?: number;
  /** Campo de una versión anterior: no se pide, pero conserva su etiqueta. */
  legacy?: boolean;
}

/**
 * Especificaciones adicionales libres ("Lector de huella" -> "Sí"): se guardan
 * en el mismo JSON con la clave prefijada, p. ej. "+Lector de huella".
 */
export const EXTRA_SPEC_PREFIX = '+';
export const MAX_EXTRA_SPECS = 10;
export const MAX_EXTRA_SPEC_NAME = 40;

@Entity({ name: 'equipment_types' })
export class EquipmentTypeEntity {
  @PrimaryGeneratedColumn({ type: 'smallint' })
  id: number;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'spec_schema', type: 'jsonb' })
  specSchema: SpecField[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
