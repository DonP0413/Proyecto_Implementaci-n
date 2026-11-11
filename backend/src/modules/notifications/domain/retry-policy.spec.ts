import { ExponentialBackoffRetryPolicy } from './retry-policy';

describe('ExponentialBackoffRetryPolicy', () => {
  const noJitter = new ExponentialBackoffRetryPolicy(30, 3600, 0.2, () => 0.5);

  it('duplica el tiempo de espera en cada intento', () => {
    expect(noJitter.nextDelayMs(1)).toBe(30_000);
    expect(noJitter.nextDelayMs(2)).toBe(60_000);
    expect(noJitter.nextDelayMs(3)).toBe(120_000);
  });

  it('respeta el tope máximo', () => {
    expect(noJitter.nextDelayMs(20)).toBe(3_600_000);
  });

  it('aplica jitter dentro del ±20%', () => {
    const low = new ExponentialBackoffRetryPolicy(100, 3600, 0.2, () => 0).nextDelayMs(1);
    const high = new ExponentialBackoffRetryPolicy(100, 3600, 0.2, () => 1).nextDelayMs(1);
    expect(low).toBe(80_000);
    expect(high).toBe(120_000);
  });
});
