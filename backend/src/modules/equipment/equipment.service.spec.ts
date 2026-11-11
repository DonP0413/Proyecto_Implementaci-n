import { InvalidInputError } from '../../common/errors/domain.errors';
import type { EquipmentTypeEntity } from './equipment-type.entity';
import { EquipmentRepository } from './equipment.repository';
import { specsWithLabels } from '../work-orders/application/work-order.mapper';
import { EquipmentService } from './equipment.service';

describe('EquipmentService.normalizeSpecs', () => {
  const service = new EquipmentService({} as EquipmentRepository);
  const laptop = {
    id: 1,
    code: 'LAPTOP',
    name: 'Laptop',
    isActive: true,
    specSchema: [
      { key: 'ram', label: 'RAM', type: 'text' },
      { key: 'storage', label: 'Almacenamiento', type: 'text' },
    ],
  } as EquipmentTypeEntity;

  it('descarta claves no definidas en el esquema y valores vacíos', () => {
    expect(service.normalizeSpecs(laptop, { ram: ' 16 GB ', storage: '', hacker: 'x' })).toEqual({
      ram: '16 GB',
    });
  });

  it('convierte números a texto', () => {
    expect(service.normalizeSpecs(laptop, { ram: 16 })).toEqual({ ram: '16' });
  });

  it('rechaza valores demasiado largos', () => {
    expect(() => service.normalizeSpecs(laptop, { ram: 'x'.repeat(501) })).toThrow(InvalidInputError);
  });
});

describe('EquipmentService.normalizeSpecs — campos detallados', () => {
  const service = new EquipmentService({} as EquipmentRepository);
  const laptop = {
    id: 1,
    code: 'LAPTOP',
    name: 'Laptop',
    isActive: true,
    specSchema: [
      {
        key: 'ram_gb',
        group: 'Memoria RAM',
        label: 'Capacidad',
        type: 'number',
        unit: 'GB',
        min: 1,
        max: 512,
      },
      { key: 'ram_type', group: 'Memoria RAM', label: 'Tipo', type: 'select', options: ['DDR4', 'DDR5'] },
      { key: 'screen_size', group: 'Pantalla', label: 'Tamaño', type: 'number', min: 5, max: 40 },
      { key: 'ram', label: 'Memoria RAM', type: 'text', legacy: true },
    ],
  } as EquipmentTypeEntity;

  it('acepta opciones válidas y números con coma decimal', () => {
    expect(service.normalizeSpecs(laptop, { ram_gb: '16', ram_type: 'DDR4', screen_size: '15,6' })).toEqual({
      ram_gb: '16',
      ram_type: 'DDR4',
      screen_size: '15.6',
    });
  });

  it('rechaza una opción que no está en la lista', () => {
    expect(() => service.normalizeSpecs(laptop, { ram_type: 'DDR9' })).toThrow('no es una opción válida');
  });

  it('rechaza números no numéricos o fuera de rango', () => {
    expect(() => service.normalizeSpecs(laptop, { ram_gb: 'dieciséis' })).toThrow('debe ser un número');
    expect(() => service.normalizeSpecs(laptop, { ram_gb: '0' })).toThrow('debe estar entre 1 y 512');
  });

  it('no acepta campos antiguos (legacy) en registros nuevos', () => {
    expect(service.normalizeSpecs(laptop, { ram: '16 GB DDR4' })).toEqual({});
  });

  it('guarda especificaciones adicionales con prefijo y limita su cantidad', () => {
    expect(service.normalizeSpecs(laptop, { '+Lector de huella': ' Sí ', '+ ': 'x' })).toEqual({
      '+Lector de huella': 'Sí',
    });
    const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`+Extra ${i}`, 'x']));
    expect(() => service.normalizeSpecs(laptop, many)).toThrow('Máximo 10');
  });
});

describe('specsWithLabels', () => {
  it('ordena por catálogo, agrega unidades, conserva campos antiguos y deja los adicionales al final', () => {
    const schema = [
      { key: 'ram_gb', group: 'Memoria RAM', label: 'Capacidad', type: 'number' as const, unit: 'GB' },
      { key: 'ram_type', group: 'Memoria RAM', label: 'Tipo', type: 'select' as const },
      { key: 'ram', label: 'Memoria RAM', type: 'text' as const, legacy: true },
    ];
    expect(
      specsWithLabels(schema, { '+Lector de huella': 'Sí', ram_type: 'DDR4', ram: '8 GB', ram_gb: '16' }),
    ).toEqual([
      { key: 'ram_gb', label: 'Memoria RAM · Capacidad', value: '16 GB' },
      { key: 'ram_type', label: 'Memoria RAM · Tipo', value: 'DDR4' },
      { key: 'ram', label: 'Memoria RAM', value: '8 GB' },
      { key: '+Lector de huella', label: 'Lector de huella', value: 'Sí' },
    ]);
  });
});
