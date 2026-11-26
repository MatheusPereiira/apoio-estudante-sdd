import { DomainError } from "@app/contracts";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpochSec: number;
  retryAfterSec: number;
}

/**
 * Sliding-window Rate Limiter compatível com RNF10:
 * - Login: 5 req/min por IP+e-mail
 * - API geral: 120 req/min por usuário
 */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  check(key: string, limit: number, windowMs = 60_000): RateLimitResult {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      const resetEpochSec = Math.ceil((oldest + windowMs) / 1000);
      this.buckets.set(key, timestamps);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetEpochSec,
        retryAfterSec,
      };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    const resetEpochSec = Math.ceil((now + windowMs) / 1000);

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - timestamps.length),
      resetEpochSec,
      retryAfterSec: 0,
    };
  }

  enforce(key: string, limit: number, windowMs = 60_000): RateLimitResult {
    const res = this.check(key, limit, windowMs);
    if (!res.allowed) {
      throw new DomainError({
        status: 429,
        code: "LIMITE_REQUISICOES",
        title: "Limite de requisições excedido",
        detail: `Aguarde ${res.retryAfterSec} segundo(s) antes de tentar novamente.`,
        extra: { retryAfter: res.retryAfterSec },
      });
    }
    return res;
  }

  clear(): void {
    this.buckets.clear();
  }
}
