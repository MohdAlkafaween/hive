/**
 * Security audit logger
 * Logs security-relevant events for incident investigation
 * In production, replace with a structured logging service (e.g., Winston, Pino)
 */

type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_RATE_LIMITED'
  | 'LOGOUT'
  | 'USER_CREATED'
  | 'STUDENT_CREATED'
  | 'STUDENT_DELETED'
  | 'SUBSCRIPTION_CREATED'
  | 'AUTH_FAILED'
  | 'AUTH_FORBIDDEN'
  | 'SEED_BLOCKED'
  | 'INVALID_INPUT'
  | 'LOGIN_BLOCKED'

interface AuditEntry {
  timestamp: string
  event: AuditEvent
  ip?: string
  userId?: number | string
  email?: string
  details?: string
}

export function auditLog(event: AuditEvent, context: Omit<AuditEntry, 'timestamp' | 'event'> = {}) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...context,
  }

  // Structured log output — can be piped to a log aggregator
  console.log(`[AUDIT] ${JSON.stringify(entry)}`)
}
