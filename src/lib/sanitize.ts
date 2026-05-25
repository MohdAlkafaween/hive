/**
 * Input sanitization & validation utilities
 * Prevents XSS, injection, and malformed data
 */

// Strip HTML tags and trim whitespace
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')    // Strip HTML tags
    .replace(/[<>"'&]/g, '')    // Remove dangerous chars
    .trim()
    .slice(0, 500)              // Max length cap
}

// Validate and sanitize phone number (digits, +, -, spaces only)
export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[^\d+\-\s()]/g, '') // Only phone chars
    .trim()
    .slice(0, 20)
}

// Validate email format
export function isValidEmail(input: unknown): boolean {
  if (typeof input !== 'string') return false
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(input) && input.length <= 254
}

// Validate that an ID is a positive integer
export function isValidId(input: unknown): boolean {
  const n = Number(input)
  return Number.isInteger(n) && n > 0
}

// Sanitize RFID UUID (alphanumeric + hyphens only)
export function sanitizeRfid(input: unknown): string | null {
  if (!input || typeof input !== 'string') return null
  const cleaned = input.replace(/[^a-zA-Z0-9\-:]/g, '').trim().slice(0, 100)
  return cleaned || null
}

// Validate date string format (YYYY-MM-DD)
export function isValidDateString(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(input) && !isNaN(Date.parse(input))
}

// Validate password strength
export function isStrongPassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) return { valid: false, reason: 'Password must be at least 8 characters' }
  if (password.length > 128) return { valid: false, reason: 'Password too long' }
  if (!/[a-zA-Z]/.test(password)) return { valid: false, reason: 'Password must contain at least one letter' }
  if (!/[0-9]/.test(password)) return { valid: false, reason: 'Password must contain at least one number' }
  return { valid: true }
}
