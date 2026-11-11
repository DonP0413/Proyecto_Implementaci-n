import { emptyToUndefined, formatBytes, formatDate, formatMoney } from './format';

describe('format', () => {
  it('formatea montos en USD', () => {
    expect(formatMoney(85.5)).toMatch(/85,50/);
    expect(formatMoney(null)).toBe('—');
  });

  it('formatea fechas ISO sin desfase de zona horaria', () => {
    expect(formatDate('2026-11-07')).toMatch(/7/);
    expect(formatDate(null)).toBe('—');
  });

  it('formatea tamaños', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('convierte cadenas vacías en undefined', () => {
    expect(emptyToUndefined({ a: '', b: 'x', c: '  ' })).toEqual({ a: undefined, b: 'x', c: undefined });
  });
});
