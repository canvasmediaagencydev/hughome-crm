/**
 * Minimal in-memory sliding-window rate limiter (Phase 1).
 *
 * ⚠️ SCALE NOTE: state lives in this process's memory only. It is correct for a
 * single instance (Phase 1). When the app scales to multiple instances/serverless
 * (Vercel), this must be replaced with a shared store (e.g. Upstash Redis),
 * otherwise each instance keeps its own counters and the limit is effectively
 * multiplied by the instance count.
 */
type Timestamps = number[]
const store = new Map<string, Timestamps>()

export interface RateResult {
  ok: boolean
  retryAfterSec: number
}

/**
 * Allow at most `max` hits per `windowMs` for `key`. Records the hit when allowed.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateResult {
  const now = Date.now()
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs)

  if (hits.length >= max) {
    store.set(key, hits)
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000))
    return { ok: false, retryAfterSec }
  }

  hits.push(now)
  store.set(key, hits)
  return { ok: true, retryAfterSec: 0 }
}
