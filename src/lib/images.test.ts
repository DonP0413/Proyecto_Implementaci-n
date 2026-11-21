import { vi } from 'vitest';
import { convertWebpToJpeg } from './images';

describe('convertWebpToJpeg', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deja intactas las fotos JPG y PNG', async () => {
    const jpg = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    expect(await convertWebpToJpeg(jpg)).toBe(jpg);
  });

  it('convierte una foto WEBP a JPG con el mismo nombre y extensión .jpg', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4, height: 3, close: vi.fn() }));
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback) {
      callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
    });

    const result = await convertWebpToJpeg(new File(['webp'], 'Foto Equipo.webp', { type: 'image/webp' }));
    expect(result.name).toBe('Foto Equipo.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(context.drawImage).toHaveBeenCalled();
  });

  it('si el navegador no puede convertir, deja la foto como estaba', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no soportado')));
    const webp = new File(['webp'], 'foto.webp', { type: 'image/webp' });
    expect(await convertWebpToJpeg(webp)).toBe(webp);
  });
});
