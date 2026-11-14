import { formatMailgunError, isPermanentStatus } from './mailgun-mail.adapter';

describe('isPermanentStatus', () => {
  it.each([
    [400, true],
    [401, true],
    [403, true],
    [404, true],
    [408, false],
    [429, false],
    [500, false],
    [503, false],
    [undefined, false],
  ])('status %s -> permanente=%s', (status, expected) => {
    expect(isPermanentStatus(status)).toBe(expected);
  });

  it('marca como permanente el rechazo de destinatarios no autorizados en Sandbox aunque details esté vacío', () => {
    const res = formatMailgunError({
      status: 403,
      details: '',
      message: 'Sandbox subdomains are for test purposes only. Please add authorized recipients.',
    });
    expect(res.permanent).toBe(true);
    expect(res.message).toContain('Sandbox');
  });
});
