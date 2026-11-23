import PDFDocument from 'pdfkit';
import { WARRANTY_POLICIES } from '../domain/warranty-policies';
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
      photos: [{ content: corrupt, mimeType: 'image/jpeg' }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  describe('foto de recepción', () => {
    // PNG válido de 1x1 px.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const data = (
      specCount: number,
      photoCount = 1,
      extra: Array<{ content: Buffer; mimeType: string }> = [],
    ) => ({
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
      photos: [
        ...Array.from({ length: photoCount }, () => ({ content: png, mimeType: 'image/png' })),
        ...extra,
      ],
    });

    /** Registra dónde se dibujó la foto y en qué altura se escribe cada texto. */
    const capture = () => {
      const images: Array<{ y: number; height: number; pageBottom: number; page: unknown }> = [];
      const texts: Array<{ y: number; text: string; page: unknown }> = [];
      const originalImage = PDFDocument.prototype.image;
      const originalText = PDFDocument.prototype.text;
      const imageSpy = jest.spyOn(PDFDocument.prototype, 'image').mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: unknown[]
      ) {
        const [, , y, options] = args as [unknown, number, number, { height: number }];
        images.push({
          y,
          height: options.height,
          pageBottom: this.page.height - this.page.margins.bottom,
          page: this.page,
        });
        return (originalImage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
      });
      const textSpy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: unknown[]
      ) {
        const y = typeof args[2] === 'number' ? args[2] : this.y;
        texts.push({ y, text: String(args[0]), page: this.page });
        return (originalText as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
      });
      return { images, texts, restore: () => (imageSpy.mockRestore(), textSpy.mockRestore()) };
    };

    it('el aviso, las políticas y las firmas se escriben debajo de la foto (no encima)', async () => {
      const { images, texts, restore } = capture();
      try {
        await new ReceiptPdfGenerator().generate(data(3));
        expect(images).toHaveLength(1);
        const imageBottom = images[0].y + images[0].height;
        const after = texts.filter((t) =>
          /^(Conserve este comprobante|POLÍTICAS DE GARANTÍA|Firma del cliente|Recibido por PINTOTECH)/.test(
            t.text,
          ),
        );
        expect(after).toHaveLength(4);
        // En la misma página van debajo de la foto; si no caben, pasan a la siguiente.
        after.forEach((t) => {
          if (t.page === images[0].page) expect(t.y).toBeGreaterThanOrEqual(imageBottom);
        });
      } finally {
        restore();
      }
    });

    it('incluye TODAS las fotos cargadas (no sólo la primera) sin salirse de la página', async () => {
      const { images, restore } = capture();
      try {
        await new ReceiptPdfGenerator().generate(data(3, 6));
        expect(images).toHaveLength(6);
        images.forEach((img) => expect(img.y + img.height).toBeLessThanOrEqual(img.pageBottom));
      } finally {
        restore();
      }
    });

    it('omite las fotos WEBP (pdfkit no las admite) y lo indica con una nota', async () => {
      const webp = Buffer.from('RIFF0000WEBPVP8 ', 'ascii');
      const { images, texts, restore } = capture();
      try {
        await new ReceiptPdfGenerator().generate(data(3, 2, [{ content: webp, mimeType: 'image/webp' }]));
        expect(images).toHaveLength(2);
        expect(texts.some((t) => t.text.startsWith('1 fotografía(s) no se pudieron incluir'))).toBe(true);
      } finally {
        restore();
      }
    });

    it('el comprobante de entrega incluye la foto de la entrega', async () => {
      const { images, texts, restore } = capture();
      try {
        const base = data(0, 0);
        await new ReceiptPdfGenerator().generateReadyForPickup({
          ...base,
          issuedAt: 'hoy',
          delivery: {
            deliveredAt: 'hoy',
            workSummary: 'Cambio de batería',
            amountCharged: '$85,50',
            returnCondition: 'Funcional',
            receivedByName: 'María Pérez',
          },
          photos: [{ content: png, mimeType: 'image/png' }],
        });
        expect(images).toHaveLength(1);
        expect(texts.some((t) => t.text === 'FOTOGRAFÍA DE LA ENTREGA')).toBe(true);
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

  describe('políticas de garantía y otros documentos', () => {
    const base = {
      company: { name: 'PINTOTECH' },
      code: 'PT-2026-000009',
      receivedAt: '7 de noviembre de 2026, 10:00',
      client: { fullName: 'María Pérez', email: 'maria@example.com' },
      equipment: { typeName: 'Laptop', brand: 'HP', model: 'Pavilion', specs: [] },
      reportedIssue: 'No enciende',
      accessories: [{ name: 'Cargador', quantity: 1 }],
    };

    const textsOf = async (render: () => Promise<Buffer>) => {
      const texts: string[] = [];
      const originalText = PDFDocument.prototype.text;
      const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (
        this: PDFKit.PDFDocument,
        ...args: unknown[]
      ) {
        texts.push(String(args[0]));
        return (originalText as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
      });
      try {
        const pdf = await render();
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      } finally {
        spy.mockRestore();
      }
      return texts;
    };

    const expectPolicies = (texts: string[]) => {
      expect(texts).toContain('POLÍTICAS DE GARANTÍA');
      WARRANTY_POLICIES.forEach((policy) => expect(texts).toContain(`•  ${policy}`));
    };

    it('el comprobante de ingreso incluye las políticas', async () => {
      const texts = await textsOf(() =>
        new ReceiptPdfGenerator().generate({
          ...base,
          receivedBy: 'Ana',
          reception: { powerStatus: 'Sí', physicalCondition: 'Bueno' },
        }),
      );
      expect(texts).toContain('COMPROBANTE DE INGRESO DE EQUIPO');
      expectPolicies(texts);
    });

    it('la cotización incluye valor, detalle y políticas', async () => {
      const texts = await textsOf(() =>
        new ReceiptPdfGenerator().generateQuotation({
          ...base,
          issuedAt: 'hoy',
          quotation: {
            amount: '$35,50',
            description: 'Cambio de pantalla',
            estimatedDays: 2,
            createdAt: 'hoy',
          },
        }),
      );
      expect(texts).toContain('COTIZACIÓN DE REPARACIÓN');
      expect(texts).toContain('VALOR TOTAL: $35,50');
      expect(texts).toContain('Cambio de pantalla');
      expectPolicies(texts);
    });

    it('listo para entregar incluye valor a cancelar y políticas', async () => {
      const texts = await textsOf(() =>
        new ReceiptPdfGenerator().generateReadyForPickup({
          ...base,
          issuedAt: 'hoy',
          quotation: { amount: '$35,50', description: 'Cambio de pantalla' },
        }),
      );
      expect(texts).toContain('EQUIPO LISTO PARA ENTREGAR');
      expect(texts).toContain('VALOR A CANCELAR: $35,50');
      expectPolicies(texts);
    });

    it('con la entrega registrada se emite como comprobante de entrega', async () => {
      const texts = await textsOf(() =>
        new ReceiptPdfGenerator().generateReadyForPickup({
          ...base,
          issuedAt: 'hoy',
          delivery: {
            deliveredAt: 'hoy',
            workSummary: 'Se cambió la pantalla',
            amountCharged: '$35,50',
            returnCondition: 'Funcional',
            receivedByName: 'María Pérez',
          },
        }),
      );
      expect(texts).toContain('COMPROBANTE DE ENTREGA DE EQUIPO');
      expect(texts).toContain('VALOR COBRADO: $35,50');
      expectPolicies(texts);
    });
  });
});
