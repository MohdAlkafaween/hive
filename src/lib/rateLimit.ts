/**
 * In-memory rate limiter for API routes
 * Protects against brute-force and abuse
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

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
