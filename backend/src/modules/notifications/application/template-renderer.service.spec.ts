import { htmlToText, TemplateRendererService } from './template-renderer.service';

describe('TemplateRendererService', () => {
  const renderer = new TemplateRendererService();
  beforeAll(() => renderer.load());

  const data = {
    company: { name: 'PINTOTECH', phone: '0999999999' },
    client: { fullName: '<script>alert(1)</script>' },
    workOrder: { code: 'PT-2026-000001', receivedAt: '07/11/2026 10:00' },
    equipment: { typeName: 'Laptop', brand: 'HP', model: 'Pavilion', serialNumber: 'SN1', specs: [] },
    reportedIssue: 'No enciende',
    reception: { powerStatus: 'No', physicalCondition: 'Bueno' },
    accessories: [{ name: 'Cargador', quantity: 1 }],
    quotation: { amount: '$ 45,00', description: 'Cambio de pantalla', estimatedDays: 3 },
  };

  it.each(['reception', 'quotation', 'ready-for-pickup', 'delivery'])(
    'renderiza la plantilla %s',
    (template) => {
      const { html, text } = renderer.render(template, data);
      expect(html).toContain('PT-2026-000001');
      expect(html).toContain('PINTOTECH');
      expect(text.length).toBeGreaterThan(20);
    },
  );

  it('escapa HTML de los datos (anti-inyección)', () => {
    const { html } = renderer.render('reception', data);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falla con plantilla inexistente', () => {
    expect(() => renderer.render('no-existe', data)).toThrow('Plantilla de correo no encontrada');
  });

  it('htmlToText elimina etiquetas', () => {
    expect(htmlToText('<p>Hola <strong>Ana</strong></p><p>Chao</p>')).toBe('Hola Ana\nChao');
  });
});
