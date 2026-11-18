/**
 * Objetivo: generar los documentos PDF para el cliente:
 *   1. Comprobante de INGRESO del equipo (al registrar la orden).
 *   2. COTIZACIÓN de la reparación.
 *   3. Equipo LISTO PARA ENTREGAR (incluye los datos de la entrega si ya se registró).
 * Todos comparten encabezado, datos del cliente y del equipo, las POLÍTICAS DE
 * GARANTÍA y las líneas de firma. Reemplazan a los correos al cliente.
 */
import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { WARRANTY_POLICIES } from '../domain/warranty-policies';

interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

/** Datos comunes a los tres documentos. */
export interface WorkOrderPdfBase {
  company: CompanyInfo;
  code: string;
  receivedAt: string;
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
  accessories: Array<{ name: string; quantity: number; notes?: string | null }>;
}

export interface ReceiptData extends WorkOrderPdfBase {
  receivedBy: string;
  reception: {
    powerStatus: string;
    physicalCondition: string;
    visibleDamage?: string | null;
    functionalNotes?: string | null;
  };
  estimatedDeliveryDate?: string | null;
  photo?: { content: Buffer; mimeType: string };
}

export interface QuotationPdfData extends WorkOrderPdfBase {
  issuedAt: string;
  quotation: {
    amount: string;
    description: string;
    estimatedDays?: number | null;
    createdAt: string;
    createdBy?: string | null;
  };
}

export interface ReadyForPickupPdfData extends WorkOrderPdfBase {
  issuedAt: string;
  /** Última cotización (valor referencial a cancelar). */
  quotation?: { amount: string; description: string } | null;
  /** Presente cuando la entrega ya fue registrada. */
  delivery?: {
    deliveredAt: string;
    workSummary: string;
    amountCharged: string;
    returnCondition: string;
    accessoriesNotes?: string | null;
    receivedByName: string;
    receivedByDocument?: string | null;
    deliveredBy?: string | null;
  } | null;
}

const PRIMARY = '#0f4c81';
const MUTED = '#6b7280';
/** Caja máxima de la foto de recepción (puntos PDF; A4 = 595 x 842). */
const PHOTO_BOX = { width: 220, height: 150 };
/** Alto aproximado del título de sección (moveDown + texto + línea). */
const SECTION_HEIGHT = 34;
/** Alto reservado para las políticas de garantía + líneas de firma del pie. */
const FOOTER_HEIGHT = 235;
/** Espacio vertical libre sobre las líneas de firma (puntos PDF; ~2,5 cm). */
const SIGNATURE_SPACE = 70;
/** Interlineado adicional de las políticas de garantía. */
const POLICY_LINE_GAP = 4;

type ImageSrc = PDFKit.Mixins.ImageSrc & { width: number; height: number };
type Doc = PDFKit.PDFDocument;

@Injectable()
export class ReceiptPdfGenerator {
  private readonly logger = new Logger(ReceiptPdfGenerator.name);

  /** 1. Comprobante de ingreso. */
  generate(data: ReceiptData): Promise<Buffer> {
    return this.render(`Comprobante de ingreso ${data.code}`, data.company, (doc) => {
      this.header(doc, data.company, 'COMPROBANTE DE INGRESO DE EQUIPO', data.code, [
        `Fecha de ingreso: ${data.receivedAt}`,
        `Recibido por: ${data.receivedBy}`,
        data.estimatedDeliveryDate ? `Fecha estimada de entrega: ${data.estimatedDeliveryDate}` : '',
      ]);
      this.clientSection(doc, data);
      this.equipmentSection(doc, data, true);

      this.section(doc, 'Estado de recepción');
      this.row(doc, '¿Enciende?', data.reception.powerStatus);
      this.row(doc, 'Estado físico', data.reception.physicalCondition);
      this.row(doc, 'Daños visibles', data.reception.visibleDamage ?? 'Ninguno registrado');
      this.row(doc, 'Observaciones', data.reception.functionalNotes);

      this.accessoriesSection(doc, data.accessories, 'Accesorios recibidos');

      if (data.photo && ['image/jpeg', 'image/png'].includes(data.photo.mimeType)) {
        // Una foto dañada (cabecera válida, contenido corrupto) NO debe impedir registrar el ingreso:
        // se omite del PDF y queda igualmente guardada como adjunto.
        try {
          // openImage (API pública de pdfkit, ausente en @types/pdfkit) valida la imagen antes de dibujar.
          const image = (doc as Doc & { openImage(src: Buffer): ImageSrc }).openImage(data.photo.content);
          this.photo(doc, image);
        } catch (error) {
          this.logger.warn({ code: data.code, err: error }, 'No se pudo incrustar la foto en el comprobante');
        }
      }

      this.footer(
        doc,
        'Conserve este comprobante: es necesario para retirar su equipo.',
        'Firma del cliente',
        `Recibido por ${data.company.name}`,
      );
    });
  }

  /** 2. Cotización de la reparación. */
  generateQuotation(data: QuotationPdfData): Promise<Buffer> {
    return this.render(`Cotización ${data.code}`, data.company, (doc) => {
      this.header(doc, data.company, 'COTIZACIÓN DE REPARACIÓN', data.code, [
        `Fecha de emisión: ${data.issuedAt}`,
        `Fecha de ingreso del equipo: ${data.receivedAt}`,
      ]);
      this.clientSection(doc, data);
      this.equipmentSection(doc, data, false);

      this.section(doc, 'Detalle de la cotización');
      doc.font('Helvetica').fontSize(10).fillColor('black').text(data.quotation.description);
      doc.moveDown(0.5);
      if (data.quotation.estimatedDays) {
        this.row(
          doc,
          'Tiempo estimado',
          `${data.quotation.estimatedDays} día(s) laborable(s) desde la aprobación`,
        );
      }
      this.row(doc, 'Cotizado por', data.quotation.createdBy);
      this.row(doc, 'Fecha de cotización', data.quotation.createdAt);
      doc.moveDown(0.4);
      doc
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(`VALOR TOTAL: ${data.quotation.amount}`);
      doc.fillColor('black');

      this.footer(
        doc,
        'Esta cotización requiere la aprobación del cliente para iniciar la reparación.',
        'Aprobación del cliente',
        `Emitido por ${data.company.name}`,
      );
    });
  }

  /** 3. Equipo listo para entregar (y comprobante de entrega si ya se registró). */
  generateReadyForPickup(data: ReadyForPickupPdfData): Promise<Buffer> {
    const delivered = !!data.delivery;
    return this.render(`Equipo listo para entregar ${data.code}`, data.company, (doc) => {
      this.header(
        doc,
        data.company,
        delivered ? 'COMPROBANTE DE ENTREGA DE EQUIPO' : 'EQUIPO LISTO PARA ENTREGAR',
        data.code,
        [
          `Fecha de emisión: ${data.issuedAt}`,
          `Fecha de ingreso del equipo: ${data.receivedAt}`,
          delivered ? `Fecha de entrega: ${data.delivery!.deliveredAt}` : '',
        ],
      );
      if (!delivered) {
        doc.moveDown(0.5);
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('black')
          .text(
            'Su equipo está reparado y disponible para retiro. Presente este documento o el comprobante de ingreso al retirarlo.',
          );
      }
      this.clientSection(doc, data);
      this.equipmentSection(doc, data, false);

      if (data.delivery) {
        this.section(doc, 'Trabajo realizado');
        doc.font('Helvetica').fontSize(10).fillColor('black').text(data.delivery.workSummary);
        this.section(doc, 'Condiciones de entrega');
        doc.font('Helvetica').fontSize(10).fillColor('black').text(data.delivery.returnCondition);
        if (data.delivery.accessoriesNotes)
          this.row(doc, 'Notas de accesorios', data.delivery.accessoriesNotes);
        this.row(
          doc,
          'Retirado por',
          `${data.delivery.receivedByName}${data.delivery.receivedByDocument ? ` (${data.delivery.receivedByDocument})` : ''}`,
        );
        this.row(doc, 'Entregado por', data.delivery.deliveredBy);
        doc.moveDown(0.4);
        doc
          .fillColor(PRIMARY)
          .font('Helvetica-Bold')
          .fontSize(16)
          .text(`VALOR COBRADO: ${data.delivery.amountCharged}`);
        doc.fillColor('black');
      } else if (data.quotation) {
        this.section(doc, 'Servicio cotizado');
        doc.font('Helvetica').fontSize(10).fillColor('black').text(data.quotation.description);
        doc.moveDown(0.4);
        doc
          .fillColor(PRIMARY)
          .font('Helvetica-Bold')
          .fontSize(16)
          .text(`VALOR A CANCELAR: ${data.quotation.amount}`);
        doc.fillColor('black');
      }

      this.accessoriesSection(doc, data.accessories, 'Accesorios a devolver');

      this.footer(
        doc,
        delivered
          ? 'El cliente declara recibir el equipo y sus accesorios en las condiciones descritas.'
          : 'Recuerde retirar su equipo dentro del plazo indicado en las políticas.',
        delivered ? 'Firma del cliente (recibí conforme)' : 'Firma del cliente',
        `Entregado por ${data.company.name}`,
      );
    });
  }

  // ------------------------------------------------------------------ bloques

  private render(title: string, company: CompanyInfo, draw: (doc: Doc) => void): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 45, info: { Title: title, Author: company.name } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        draw(doc);
        doc.end();
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  private header(doc: Doc, company: CompanyInfo, title: string, code: string, lines: string[]): void {
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(20).text(company.name);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9);
    [company.address, company.phone, company.email, company.website]
      .filter(Boolean)
      .forEach((line) => doc.text(line as string));
    doc.moveDown(0.8);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(15).text(title);
    doc.moveDown(0.3);
    doc.fillColor(PRIMARY).fontSize(18).text(`ID de trabajo: ${code}`);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    lines.filter(Boolean).forEach((line) => doc.text(line));
  }

  private clientSection(doc: Doc, data: WorkOrderPdfBase): void {
    this.section(doc, 'Datos del cliente');
    this.row(doc, 'Nombre', data.client.fullName);
    this.row(doc, 'Documento', data.client.documentId);
    this.row(doc, 'Correo', data.client.email);
    this.row(doc, 'Teléfono', data.client.phone);
    this.row(doc, 'Dirección', data.client.address);
  }

  private equipmentSection(doc: Doc, data: WorkOrderPdfBase, withSpecs: boolean): void {
    this.section(doc, withSpecs ? 'Características del equipo' : 'Equipo');
    this.row(doc, 'Tipo', data.equipment.typeName);
    this.row(doc, 'Marca / Modelo', `${data.equipment.brand} ${data.equipment.model}`);
    this.row(doc, 'N.º de serie', data.equipment.serialNumber ?? 'No registrado');
    if (withSpecs) data.equipment.specs.forEach((spec) => this.row(doc, spec.label, spec.value));
    this.section(doc, 'Falla reportada por el cliente');
    doc.font('Helvetica').fontSize(10).fillColor('black').text(data.reportedIssue);
  }

  private accessoriesSection(doc: Doc, accessories: WorkOrderPdfBase['accessories'], title: string): void {
    this.section(doc, title);
    if (accessories.length === 0) {
      doc.font('Helvetica').fontSize(10).text('Sin accesorios.');
      return;
    }
    accessories.forEach((a) =>
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`•  ${a.name} (x${a.quantity})${a.notes ? ` — ${a.notes}` : ''}`),
    );
  }

  private section(doc: Doc, title: string): void {
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

  private row(doc: Doc, label: string, value?: string | null): void {
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
  private photo(doc: Doc, image: ImageSrc): void {
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
  private ensureSpace(doc: Doc, needed: number): void {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + needed > bottom) {
      doc.addPage();
    }
  }

  /** Aviso + políticas de garantía + firmas: se mantienen juntos y nunca quedan sobre otros elementos. */
  private footer(doc: Doc, notice: string, leftSignature: string, rightSignature: string): void {
    this.ensureSpace(doc, FOOTER_HEIGHT);
    doc.moveDown(1);
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(notice, left, doc.y, { width });

    doc.moveDown(0.6);
    doc
      .fillColor(PRIMARY)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('POLÍTICAS DE GARANTÍA', left, doc.y, { width });
    doc.moveDown(0.4);
    doc.fillColor('black').font('Helvetica').fontSize(9);
    WARRANTY_POLICIES.forEach((policy) =>
      doc.text(`•  ${policy}`, left, doc.y, { width, lineGap: POLICY_LINE_GAP }),
    );

    // Espacio amplio para que el cliente y el personal firmen sobre la línea.
    const y = doc.y + SIGNATURE_SPACE;
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
      .text(leftSignature, left, y + 4, { width: 200, align: 'center' });
    doc.text(rightSignature, left + 290, y + 4, { width: 200, align: 'center' });
  }
}
