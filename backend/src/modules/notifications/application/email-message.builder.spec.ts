import { EmailMessageBuilder, MAX_TOTAL_ATTACHMENTS_BYTES } from './email-message.builder';

describe('EmailMessageBuilder', () => {
  const base = () =>
    new EmailMessageBuilder().to('cliente@example.com').subject('Hola').content('<p>x</p>', 'x');

  it('construye un correo válido con tags y variables', () => {
    const mail = base().tag('reception').variable('work_order', 'PT-2026-000001').build();
    expect(mail.to).toBe('cliente@example.com');
    expect(mail.tags).toEqual(['reception']);
    expect(mail.variables).toEqual({ work_order: 'PT-2026-000001' });
  });

  it('rechaza destinatario inválido', () => {
    expect(() => new EmailMessageBuilder().to('no-es-correo').subject('a').content('a', 'a').build()).toThrow(
      'Destinatario inválido',
    );
  });

  it('omite adjuntos que exceden el límite total', () => {
    const big = Buffer.alloc(MAX_TOTAL_ATTACHMENTS_BYTES - 10);
    const builder = base()
      .attach({ filename: 'a.jpg', content: big, contentType: 'image/jpeg' })
      .attach({ filename: 'b.jpg', content: Buffer.alloc(100), contentType: 'image/jpeg' });
    expect(builder.build().attachments).toHaveLength(1);
    expect(builder.skippedAttachments).toEqual(['b.jpg']);
  });
});
