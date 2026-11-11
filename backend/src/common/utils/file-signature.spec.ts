import { detectFileType, extensionFor, isPlainText } from './file-signature';

describe('file-signature', () => {
  const pad = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

  it('detecta JPEG', () => expect(detectFileType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg'));
  it('detecta PNG', () =>
    expect(detectFileType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png'));
  it('detecta PDF', () =>
    expect(detectFileType(Buffer.from('%PDF-1.7 xxxxxxxxxxxx'))).toBe('application/pdf'));
  it('detecta WEBP', () => expect(detectFileType(Buffer.from('RIFF0000WEBPVP8 '))).toBe('image/webp'));
  it('rechaza un ejecutable disfrazado', () =>
    expect(detectFileType(Buffer.from('MZ\x90\x00xxxxxxxxxxxx'))).toBeNull());
  it('reconoce texto plano', () => expect(isPlainText(Buffer.from('hola mundo'))).toBe(true));
  it('mapea extensiones', () => expect(extensionFor('image/png')).toBe('png'));
});
