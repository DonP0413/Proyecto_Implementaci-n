/**
 * Objetivo: generar el COMPROBANTE DE INGRESO en PDF (requerimiento 3) con
 * el ID único de trabajo, datos del cliente, características del equipo y
 * estado de recepción. Se genera una sola vez al registrar la orden y se
 * guarda como documento inmutable (respaldo legal ante reclamos).
 */
import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface ReceiptData {
  company: { name: string; address?: string; phone?: string; email?: string; website?: string };
  code: string;
  receivedAt: string;
  receivedBy: string;
  client: {
    fullName: string;
    documentId?: string | null;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
  equipment: {
    typeName: string;
    brand: string;
    model: string;
    serialNumber?: string | null;
    specs: Array<{ label: string; value: string }>;
  };
  reportedIssue: string;
  reception: {
    powerStatus: string;
    physicalCondition: string;
    visibleDamage?: string | null;
    functionalNotes?: string | null;
  };
  accessories: Array<{ name: string; quantity: number; notes?: string | null }>;
  estimatedDeliveryDate?: string | null;
  photo?: { content: Buffer; mimeType: string };
}

const PRIMARY = '#0f4c81';
const MUTED = '#6b7280';
/** Caja máxima de la foto de recepción (puntos PDF; A4 = 595 x 842). */
const PHOTO_BOX = { width: 220, height: 150 };
/** Alto aproximado del título de sección (moveDown + texto + línea). */
const SECTION_HEIGHT = 34;
/** Alto reservado para el aviso legal + líneas de firma del pie. */
const FOOTER_HEIGHT = 95;

type ImageSrc = PDFKit.Mixins.ImageSrc & { width: number; height: number };

@Injectable()
export class ReceiptPdfGenerator {
  private readonly logger = new Logger(ReceiptPdfGenerator.name);

  generate(data: ReceiptData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        info: { Title: `Comprobante de ingreso ${data.code}`, Author: data.company.name },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.header(doc, data);
        this.section(doc, 'Datos del cliente');
        this.row(doc, 'Nombre', data.client.fullName);
        this.row(doc, 'Documento', data.client.documentId);
        this.row(doc, 'Correo', data.client.email);
        this.row(doc, 'Teléfono', data.client.phone);
        this.row(doc, 'Dirección', data.client.address);

        this.section(doc, 'Características del equipo');
        this.row(doc, 'Tipo', data.equipment.typeName);
        this.row(doc, 'Marca / Modelo', `${data.equipment.brand} ${data.equipment.model}`);
        this.row(doc, 'N.º de serie', data.equipment.serialNumber ?? 'No registrado');
        data.equipment.specs.forEach((spec) => this.row(doc, spec.label, spec.value));

        this.section(doc, 'Falla reportada por el cliente');
        doc.font('Helvetica').fontSize(10).fillColor('black').text(data.reportedIssue);

        this.section(doc, 'Estado de recepción');
        this.row(doc, '¿Enciende?', data.reception.powerStatus);
        this.row(doc, 'Estado físico', data.reception.physicalCondition);
        this.row(doc, 'Daños visibles', data.reception.visibleDamage ?? 'Ninguno registrado');
        this.row(doc, 'Observaciones', data.reception.functionalNotes);

        this.section(doc, 'Accesorios recibidos');
        if (data.accessories.length === 0) {
          doc.font('Helvetica').fontSize(10).text('Sin accesorios.');
        } else {
          data.accessories.forEach((a) =>
            doc
              .font('Helvetica')
              .fontSize(10)
              .text(`•  ${a.name} (x${a.quantity})${a.notes ? ` — ${a.notes}` : ''}`),
          );
        }

        if (data.photo && ['image/jpeg', 'image/png'].includes(data.photo.mimeType)) {
          // Una foto dañada (cabecera válida, contenido corrupto) NO debe impedir registrar el ingreso:
          // se omite del PDF y queda igualmente guardada como adjunto.
          try {
            // openImage (API pública de pdfkit, ausente en @types/pdfkit) valida la imagen antes de dibujar.
            const image = (doc as PDFKit.PDFDocument & { openImage(src: Buffer): ImageSrc }).openImage(
              data.photo.content,
            );
            this.photo(doc, image);
          } catch (error) {
            this.logger.warn(
              { code: data.code, err: error },
              'No se pudo incrustar la foto en el comprobante',
            );
          }
        }

        this.footer(doc, data);
        doc.end();
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  private header(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(20).text(data.company.name);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9);
    [data.company.address, data.company.phone, data.company.email, data.company.website]
      .filter(Boolean)
      .forEach((line) => doc.text(line as string));
    doc.moveDown(0.8);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(15).text('COMPROBANTE DE INGRESO DE EQUIPO');
    doc.moveDown(0.3);
    doc.fillColor(PRIMARY).fontSize(18).text(`ID de trabajo: ${data.code}`);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    doc.text(`Fecha de ingreso: ${data.receivedAt}`);
    doc.text(`Recibido por: ${data.receivedBy}`);
    if (data.estimatedDeliveryDate) doc.text(`Fecha estimada de entrega: ${data.estimatedDeliveryDate}`);
  }

  private section(doc: PDFKit.PDFDocument, title: string): void {
    doc.moveDown(0.8);
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase());
    const y = doc.y + 2;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor(PRIMARY)
      .stroke();
    doc.moveDown(0.4);
    doc.fillColor('black');
  }

  private row(doc: PDFKit.PDFDocument, label: string, value?: string | null): void {
    if (value === undefined || value === null || value === '') return;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value);
  }

  /**
   * Dibuja la foto en el flujo del documento. pdfkit no mueve el cursor de
   * forma fiable al usar `fit`, por eso se calcula el tamaño, se posiciona
   * explícitamente y se avanza `doc.y`. Título y foto van juntos: si no caben
   * en la página actual, pasan a la siguiente (nunca se cortan ni se solapan).
   */
  private photo(doc: PDFKit.PDFDocument, image: ImageSrc): void {
    const scale = Math.min(PHOTO_BOX.width / image.width, PHOTO_BOX.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensureSpace(doc, SECTION_HEIGHT + height);
    this.section(doc, 'Fotografía de recepción');
    const x = doc.page.margins.left;
    const y = doc.y + 4;
    doc.image(image, x, y, { width, height });
    doc.x = x;
    doc.y = y + height;
  }

  /** Agrega una página si el bloque siguiente no cabe en el espacio restante. */
  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + needed > bottom) {
      doc.addPage();
    }
  }

  private footer(doc: PDFKit.PDFDocument, data: ReceiptData): void {
    // Aviso y firmas se mantienen juntos y nunca quedan sobre otros elementos.
    this.ensureSpace(doc, FOOTER_HEIGHT);
    doc.moveDown(1.2);
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        `Conserve este comprobante: es necesario para retirar su equipo. ${data.company.name} no se responsabiliza ` +
          'por la información almacenada en el equipo; se recomienda respaldarla. Los equipos no retirados en 90 días ' +
          'desde la notificación de "listo para retirar" podrán generar cargos de bodegaje.',
      );
    doc.moveDown(2.5);
    const left = doc.page.margins.left;
    const y = doc.y;
    doc
      .strokeColor('black')
      .moveTo(left, y)
      .lineTo(left + 200, y)
      .stroke();
    doc
      .moveTo(left + 290, y)
      .lineTo(left + 490, y)
      .stroke();
    doc
      .fillColor('black')
      .fontSize(9)
      .text('Firma del cliente', left, y + 4, { width: 200, align: 'center' });
    doc.text(`Recibido por ${data.company.name}`, left + 290, y + 4, { width: 200, align: 'center' });
  }
}
