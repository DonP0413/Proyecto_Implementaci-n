import { WorkOrderCodeFactory } from './work-order-code';

describe('WorkOrderCodeFactory', () => {
  it('genera el formato PREFIJO-AÑO-SECUENCIA', () => {
    expect(WorkOrderCodeFactory.build('pt', new Date('2026-11-07T15:00:00Z'), 123)).toBe('PT-2026-000123');
  });

  it('usa la zona horaria de la tienda para el año', () => {
    // 1 ene 2027 02:00 UTC = 31 dic 2026 21:00 en Ecuador
    expect(WorkOrderCodeFactory.build('PT', new Date('2027-01-01T02:00:00Z'), 1)).toBe('PT-2026-000001');
  });

  it('rechaza secuencias inválidas', () => {
    expect(() => WorkOrderCodeFactory.build('PT', new Date(), 0)).toThrow();
  });

  it('valida códigos', () => {
    expect(WorkOrderCodeFactory.isValid('PT-2026-000123')).toBe(true);
    expect(WorkOrderCodeFactory.isValid('pt-26-1')).toBe(false);
  });
});
