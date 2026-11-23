import { InvalidInputError } from '../../../common/errors/domain.errors';
import { AttachmentCategory } from '../domain/work-order.enums';
import { FileUploadPolicy, sanitizeFileName } from './file-upload.policy';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const pdf = Buffer.from('%PDF-1.7 ......................');

describe('FileUploadPolicy', () => {
  it('acepta una foto JPEG real', () => {
    const result = FileUploadPolicy.validate(
      { originalname: 'foto.jpg', mimetype: 'image/jpeg', size: jpeg.length, buffer: jpeg },
      AttachmentCategory.RECEPTION_PHOTO,
    );
    expect(result.extension).toBe('jpg');
  });

  it('rechaza un PDF como foto de recepción', () => {
    expect(() =>
      FileUploadPolicy.validate(
        { originalname: 'doc.pdf', mimetype: 'application/pdf', size: pdf.length, buffer: pdf },
        AttachmentCategory.RECEPTION_PHOTO,
      ),
    ).toThrow(InvalidInputError);
  });

  it('acepta PDF como documento técnico', () => {
    expect(
      FileUploadPolicy.validate(
        { originalname: 'informe.pdf', mimetype: 'application/pdf', size: pdf.length, buffer: pdf },
        AttachmentCategory.TECHNICAL_DOCUMENT,
      ).mimeType,
    ).toBe('application/pdf');
  });

  it('rechaza contenido que no coincide con el tipo declarado', () => {
    expect(() =>
      FileUploadPolicy.validate(
        { originalname: 'virus.jpg', mimetype: 'image/jpeg', size: pdf.length, buffer: pdf },
        AttachmentCategory.RECEPTION_PHOTO,
      ),
    ).toThrow('no corresponde');
  });

  it('rechaza archivos que superan el peso máximo permitido', () => {
    expect(() =>
      FileUploadPolicy.validate(
        { originalname: 'pesada.jpg', mimetype: 'image/jpeg', size: 9 * 1024 * 1024, buffer: jpeg },
        AttachmentCategory.RECEPTION_PHOTO,
      ),
    ).toThrow('peso máximo');
  });

  it('sanea nombres de archivo', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('/');
  });
});
