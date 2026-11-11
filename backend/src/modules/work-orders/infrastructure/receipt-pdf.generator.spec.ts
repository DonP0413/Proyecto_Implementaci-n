import PDFDocument from 'pdfkit';
import { ReceiptPdfGenerator } from './receipt-pdf.generator';

describe('ReceiptPdfGenerator', () => {
  it('genera un PDF válido', async () => {
    const pdf = await new ReceiptPdfGenerator().generate({
      company: { name: 'PINTOTECH', phone: '0999999999' },
      code: 'PT-2026-000001',
      receivedAt: '7 de noviembre de 2026, 10:00',
      receivedBy: 'Ana Torres',
      client: { fullName: 'María Pérez', email: 'maria@example.com', documentId: '1718123456' },
      equipment: {
        typeName: 'Laptop',
        brand: 'HP',
        model: 'Pavilion',
        serialNumber: 'SN1',
        specs: [{ label: 'RAM', value: '16 GB' }],
      },
      reportedIssue: 'No enciende',
      reception: { powerStatus: 'No enciende', physicalCondition: 'Bueno', visibleDamage: 'Rayón en tapa' },
      accessories: [{ name: 'Cargador', quantity: 1 }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('no falla si la foto está corrupta (la omite)', async () => {
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]);
    const pdf = await new ReceiptPdfGenerator().generate({
      company: { name: 'PINTOTECH' },
      code: 'PT-2026-000002',
      receivedAt: 'hoy',
      receivedBy: 'Ana',
      client: { fullName: 'X', email: 'x@example.com' },
      equipment: { typeName: 'Laptop', brand: 'HP', model: 'X', specs: [] },
      reportedIssue: 'x',
      reception: { powerStatus: 'Sí', physicalCondition: 'Bueno' },
      accessories: [],
      photo: { content: corrupt, mimeType: 'image/jpeg' },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  describe('foto de recepción', () => {
    // PNG válido de 1x1 px.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const data = (specCount: number) => ({
      company: { name: 'PINTOTECH' },
      code: 'PT-2026-000003',
      receivedAt: 'hoy',
      receivedBy: 'Ana',
      client: { fullName: 'X', email: 'x@example.com' },
      equipment: {
        typeName: 'Laptop',
        brand: 'HP',
        model: 'X',
        specs: Array.from({ length: specCount }, (_, i) => ({ label: `Campo ${i}`, value: 'v' })),
      },
      reportedIssue: 'x',
      reception: { powerStatus: 'Sí', physicalCondition: 'Bueno' },
      accessories: [],
      photo: { content: png, mimeType: 'image/png' },
    });

    /** Registra dónde se dibujó la foto y en qué altura se escribe cada texto. */
    const capture = () => {
      const images: Array<{ y: number; height: number; pageBottom: number }> = [];
      const texts: Array<{ y: number; text: string }> = [];
      const originalImage = PDFDocument.prototype.image;
      const originalText = PDFDocument.prototype.text;
      const imageSpy = jest.spyOn(PDFDocument.prototype, 'image').mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: unknown[]
      ) {
        const [, , y, options] = args as [unknown, number, number, { height: number }];
        images.push({ y, height: options.height, pageBottom: this.page.height - this.page.margins.bottom });
        return (originalImage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
      });
      const textSpy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: unknown[]
      ) {
        const y = typeof args[2] === 'number' ? args[2] : this.y;
        texts.push({ y, text: String(args[0]) });
        return (originalText as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
      });
      return { images, texts, restore: () => (imageSpy.mockRestore(), textSpy.mockRestore()) };
    };

    it('el aviso y las firmas se escriben debajo de la foto (no encima)', async () => {
      const { images, texts, restore } = capture();
      try {
        await new ReceiptPdfGenerator().generate(data(3));
        expect(images).toHaveLength(1);
        const imageBottom = images[0].y + images[0].height;
        const after = texts.filter((t) =>
          /^(Conserve este comprobante|Firma del cliente|Recibido por PINTOTECH)/.test(t.text),
        );
        expect(after).toHaveLength(3);
        after.forEach((t) => expect(t.y).toBeGreaterThanOrEqual(imageBottom));
      } finally {
        restore();
      }
    });

    it('si la foto no cabe en la página, pasa completa a la siguiente', async () => {
      const { images, restore } = capture();
      try {
        await new ReceiptPdfGenerator().generate(data(45));
        expect(images).toHaveLength(1);
        expect(images[0].y + images[0].height).toBeLessThanOrEqual(images[0].pageBottom);
      } finally {
        restore();
      }
    });
  });
});
