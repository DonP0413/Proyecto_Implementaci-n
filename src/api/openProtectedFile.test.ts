import { vi } from 'vitest';
import { openProtectedFile } from './endpoints';
import { http } from './http';

describe('openProtectedFile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('abre el archivo con su URL real (no blob:) y un enlace temporal ligado a la ruta', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { token: 'abc123', expiresIn: 120 } });

    await openProtectedFile('/work-orders/11111111-1111-4111-8111-111111111111/receipt');

    expect(post).toHaveBeenCalledWith('/auth/download-token', {
      path: '/work-orders/11111111-1111-4111-8111-111111111111/receipt',
    });
    expect(tab.location.href).toMatch(/\/api\/v1\/work-orders\/1{8}-1{4}-41{3}-81{3}-1{12}\/receipt\?dl=abc123$/);
    expect(tab.location.href.startsWith('blob:')).toBe(false);
    expect(tab.opener).toBeNull();
  });

  it('cierra la pestaña si no se pudo obtener el enlace', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    vi.spyOn(http, 'post').mockRejectedValue(new Error('sin conexión'));

    await expect(openProtectedFile('/work-orders/x/receipt')).rejects.toThrow('sin conexión');
    expect(tab.close).toHaveBeenCalled();
  });
});
