// Single source of truth for cookie names and options.
// Import these constants in EVERY file that sets, reads, or clears cookies.
// This eliminates the category of bugs where one file uses 'session' and another
// uses 'customer-session' or misspells the name.

export const STAFF_COOKIE_NAME = 'session'
export const CUSTOMER_COOKIE_NAME = 'customer-session'

const isSecure = process.env.NODE_ENV === 'production' && process.env.ALLOW_HTTP !== 'true'

/** Build cookie options with the given maxAge (seconds). */
export function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

/** Staff session: 8 hours (one shift). */
export const STAFF_MAX_AGE = 8 * 60 * 60 // 28800s

/** Customer session: 7 days. */
export const CUSTOMER_MAX_AGE = 7 * 24 * 60 * 60 // 604800s

export const STAFF_COOKIE_OPTIONS = getCookieOptions(STAFF_MAX_AGE)
export const CUSTOMER_COOKIE_OPTIONS = getCookieOptions(CUSTOMER_MAX_AGE)

/** Options for clearing a cookie (expire immediately). */
export function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    expires: new Date(0),
    path: '/',
  }
}
