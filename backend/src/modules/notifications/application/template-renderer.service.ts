/**
 * Objetivo: renderizar plantillas Handlebars de correo.
 * - Las plantillas viven en /templates (versionadas, revisables en PR).
 * - Handlebars escapa HTML por defecto ({{ }}) -> previene inyección de
 *   HTML con datos ingresados por el personal o el cliente.
 * - Se genera además una versión texto plano (mejor entregabilidad y
 *   accesibilidad; los filtros anti-spam penalizan correos sólo-HTML).
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import Handlebars from 'handlebars';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

export const htmlToText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/tr|\/h[1-6]|\/li|\/div)\s*\/?>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

@Injectable()
export class TemplateRendererService implements OnModuleInit {
  private readonly handlebars = Handlebars.create();
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  private layout?: Handlebars.TemplateDelegate;

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async load(templatesDir: string = TEMPLATES_DIR): Promise<void> {
    this.handlebars.registerHelper('nl2br', (text: unknown) => {
      const escaped = this.handlebars.escapeExpression(String(text ?? ''));
      return new this.handlebars.SafeString(escaped.replace(/\n/g, '<br>'));
    });
    const files = (await fs.readdir(templatesDir)).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      const source = await fs.readFile(path.join(templatesDir, file), 'utf8');
      const name = file.replace(/\.hbs$/, '');
      const compiled = this.handlebars.compile(source, { strict: false });
      if (name === 'layout') this.layout = compiled;
      else this.templates.set(name, compiled);
    }
  }

  render(template: string, data: Record<string, unknown>): { html: string; text: string } {
    const compiled = this.templates.get(template);
    if (!compiled) throw new Error(`Plantilla de correo no encontrada: ${template}`);
    const body = compiled(data);
    const html = this.layout ? this.layout({ ...data, body }) : body;
    return { html, text: htmlToText(body) };
  }
}
