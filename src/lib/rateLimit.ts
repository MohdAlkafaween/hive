/**
 * In-memory rate limiter for API routes
 * Protects against brute-force and abuse
 *
 * DEPLOYMENT NOTES:
 * - TRUST_PROXY=true must be set when behind a reverse proxy (Nginx, Cloudflare, etc.)
 *   Without it, all proxied users share one rate-limit bucket ('direct-client'),
 *   meaning one user hitting the limit blocks everyone.
 * - This is an in-memory store — it resets on server restart and does NOT work
 *   across multiple server instances. For multi-instance deployments, replace with
 *   Redis-backed rate limiting (e.g., @upstash/ratelimit or ioredis).
 * - For the single-instance SQLite deployment HIVE targets, in-memory is acceptable.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()
const MAX_STORE_SIZE = 10_000 // Prevent unbounded memory growth

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Clear/reset rate limit for a specific identifier (e.g., on successful login)
 */
export function clearRateLimit(identifier: string): void {
  store.delete(identifier)
}

/**
 * Check if a request should be rate-limited
 * @param identifier - Unique key (e.g., IP address, email)
 * @param maxAttempts - Max requests per window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { limited: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    // Guard against memory exhaustion from distributed attacks
    if (store.size >= MAX_STORE_SIZE) {
      // Evict expired entries first
      for (const [k, v] of store) {
        if (v.resetAt < now) store.delete(k)
      }
      // If still too large, evict oldest entries
      if (store.size >= MAX_STORE_SIZE) {
        const keysToDelete = Array.from(store.keys()).slice(0, Math.floor(MAX_STORE_SIZE / 4))
        for (const k of keysToDelete) store.delete(k)
      }
    }
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: maxAttempts - 1, retryAfterMs: 0 }
  }

  entry.count++
  if (entry.count > maxAttempts) {
    return {
      limited: true,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    }
  }

  return { limited: false, remaining: maxAttempts - entry.count, retryAfterMs: 0 }
}

/**
 * Get client IP from request headers.
 * SECURITY: Only trusts X-Forwarded-For when TRUST_PROXY is explicitly set.
 * Without it, X-Forwarded-For can be spoofed to bypass rate limiting.
 * Falls back to x-real-ip or a constant — rate limiting still works
 * because login also rate-limits per email address.
 */
export function getClientIp(req: Request): string {
  // Only trust proxy headers if explicitly configured (e.g., behind nginx/cloudflare)
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0].trim()
  }

  // x-real-ip is set by reverse proxies (nginx) — more trustworthy than x-forwarded-for
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp

  // In direct deployment without proxy, all requests appear as same IP
  // This is still useful — combined with per-email rate limiting, it provides defense
  return 'direct-client'
}
