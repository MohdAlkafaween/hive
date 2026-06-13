/**
 * Generate a unique ID string.
 * Uses crypto.randomUUID() when available (secure contexts / Node.js),
 * falls back to a timestamp+random approach for HTTP / non-secure contexts.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts (e.g. HTTP LAN access)
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}
