import { isPermanentStatus } from './mailgun-mail.adapter';

describe('isPermanentStatus', () => {
  it.each([
    [400, true],
    [401, true],
    [404, true],
    [408, false],
    [429, false],
    [500, false],
    [503, false],
    [undefined, false],
  ])('status %s -> permanente=%s', (status, expected) => {
    expect(isPermanentStatus(status)).toBe(expected);
  });
});
