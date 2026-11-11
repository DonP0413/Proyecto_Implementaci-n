/**
 * Objetivo: Strategy Pattern para la política de reintentos de correo.
 * Por defecto backoff exponencial con jitter (30s, 60s, 120s, 240s, ...
 * con tope de 1 h) para no saturar Mailgun ante caídas temporales.
 */
export interface RetryPolicy {
  /** @param attempt número de intento que acaba de fallar (1-based) */
  nextDelayMs(attempt: number): number;
}

export const RETRY_POLICY = Symbol('RETRY_POLICY');

export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  constructor(
    private readonly baseDelaySeconds: number,
    private readonly maxDelaySeconds = 3600,
    private readonly jitterRatio = 0.2,
    private readonly random: () => number = Math.random,
  ) {}

  nextDelayMs(attempt: number): number {
    const exponent = Math.max(0, attempt - 1);
    const raw = Math.min(this.baseDelaySeconds * 2 ** exponent, this.maxDelaySeconds);
    const jitter = raw * this.jitterRatio * (this.random() * 2 - 1);
    return Math.round((raw + jitter) * 1000);
  }
}
