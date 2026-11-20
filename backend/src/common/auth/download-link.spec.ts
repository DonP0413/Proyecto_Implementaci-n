import { DOWNLOADABLE_PATH, redactDownloadToken } from './download-link';

describe('download-link', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('sólo permite PDF de la orden y descargas de adjuntos', () => {
    expect(DOWNLOADABLE_PATH.test(`/work-orders/${id}/receipt`)).toBe(true);
    expect(DOWNLOADABLE_PATH.test(`/work-orders/${id}/quotation-pdf`)).toBe(true);
    expect(DOWNLOADABLE_PATH.test(`/work-orders/${id}/ready-pdf`)).toBe(true);
    expect(DOWNLOADABLE_PATH.test(`/work-orders/${id}/attachments/${id}/download`)).toBe(true);
    expect(DOWNLOADABLE_PATH.test('/users')).toBe(false);
    expect(DOWNLOADABLE_PATH.test(`/work-orders/${id}`)).toBe(false);
    expect(DOWNLOADABLE_PATH.test(`/work-orders/${id}/receipt/../../users`)).toBe(false);
  });

  it('oculta el token en los registros', () => {
    expect(redactDownloadToken(`/api/v1/work-orders/${id}/receipt?dl=eyJhbGciOi.abc.def`)).toBe(
      `/api/v1/work-orders/${id}/receipt?dl=[REDACTED]`,
    );
    expect(redactDownloadToken('/api/v1/work-orders?page=1')).toBe('/api/v1/work-orders?page=1');
  });
});
