import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'
import { STAFF_COOKIE_NAME, CUSTOMER_COOKIE_NAME } from '@/lib/cookieConfig'

// Security headers applied to every response
// TODO: Replace 'unsafe-inline' with CSP nonces once Next.js supports nonce propagation in App Router
const isProd = process.env.NODE_ENV === 'production'
const scriptSrc = isProd
  ? "'self' 'unsafe-inline'" // No unsafe-eval in production
  : "'self' 'unsafe-eval' 'unsafe-inline'" // Next.js dev needs unsafe-eval for HMR

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

function buildSecurityHeaders(isHttps: boolean) {
  const directives = isHttps && isProd
    ? [...cspDirectives, "upgrade-insecure-requests"]
    : cspDirectives
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': directives.join('; '),
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isHttps = request.nextUrl.protocol === 'https:'

  // Public paths — no auth required
  const isPublicPath =
    path === '/login' ||
    path === '/customer-login' ||
    path === '/checkin' ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/logout') ||
    path.startsWith('/api/auth/seed') ||
    path.startsWith('/api/auth/me') ||
    path.startsWith('/api/auth/customer/') || // customer register + login
    path === '/api/checkin' ||
    path === '/api/checkin/qr' ||
    path === '/api/checkin/search' ||
    path.startsWith('/api/rfid') ||
    path === '/display' ||
    path.startsWith('/api/display') ||
    path.startsWith('/api/menu/public') || // public menu browsing
    path.startsWith('/api/settings/public') // public settings (kiosk toggle)

  if (isPublicPath) {
    const response = NextResponse.next()
    applySecurityHeaders(response, isHttps)
    return response
  }

  // Block open registration from being accessed without auth at middleware level
  if (path.startsWith('/api/auth/register')) {
    // Let the route handler enforce ADMIN auth — just pass through
    const response = NextResponse.next()
    applySecurityHeaders(response, isHttps)
    return response
  }

  // Check auth for all other routes
  // Read BOTH cookies — staff uses 'session', customer uses 'customer-session'
  // CRITICAL: Each route type ONLY uses its own cookie. No fallback to the other type.
  // This prevents session bleed: staff cookie expiring shouldn't redirect admin to /customer.
  const staffToken = request.cookies.get(STAFF_COOKIE_NAME)?.value
  const customerToken = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value

  const isCustomerPath = path.startsWith('/customer') || path.startsWith('/api/customer/') || path === '/api/checkin/self'
  // Staff routes → ONLY staff cookie. Customer routes → ONLY customer cookie.
  const sessionToken = isCustomerPath ? customerToken : staffToken

  if (!sessionToken) {
    // API routes return 401, page routes redirect to appropriate login
    if (path.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      applySecurityHeaders(response, isHttps)
      return response
    }
    // Customer pages → redirect to customer login
    if (path.startsWith('/customer')) {
      const response = NextResponse.redirect(new URL('/customer-login', request.url))
      applySecurityHeaders(response, isHttps)
      return response
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    applySecurityHeaders(response, isHttps)
    return response
  }

  try {
    const payload = await decrypt(sessionToken)
    if (!payload) throw new Error('Invalid token')

    // ─── Customer token routing ───
    if (payload.type === 'customer') {
      // Customer tokens can access customer pages, customer API routes, and self-check-in
      if (path.startsWith('/customer') || path.startsWith('/api/customer/') || path === '/api/checkin/self') {
        const response = NextResponse.next()
        applySecurityHeaders(response, isHttps)
        return response
      }
      // Customer can also access auth endpoints (logout, me)
      if (path.startsWith('/api/auth/')) {
        const response = NextResponse.next()
        applySecurityHeaders(response, isHttps)
        return response
      }
      // Customer on login page → redirect to /customer (already logged in)
      if (path === '/login' || path === '/customer-login') {
        const response = NextResponse.redirect(new URL('/customer', request.url))
        applySecurityHeaders(response, isHttps)
        return response
      }
      // Customer on staff pages → redirect to /customer
      if (!path.startsWith('/api/')) {
        const response = NextResponse.redirect(new URL('/customer', request.url))
        applySecurityHeaders(response, isHttps)
        return response
      }
      // Customer on non-customer API routes → let requireAuth() handle rejection
      const response = NextResponse.next()
      applySecurityHeaders(response, isHttps)
      return response
    }

    // ─── Staff token routing (existing behavior) ───
    const role = payload.role as string

    // Parse MANAGER permissions from JWT
    let managerPermissions: string[] = []
    if (role === 'MANAGER') {
      try {
        const permsRaw = payload.permissions as string
        managerPermissions = JSON.parse(permsRaw || '[]')
      } catch { managerPermissions = [] }
    }

    // Helper: check if MANAGER has access to a page path
    const managerCanAccess = (pagePath: string): boolean => {
      if (role !== 'MANAGER') return false
      return managerPermissions.some(p => pagePath === p || (p !== '/' && pagePath.startsWith(p)))
    }

    // ─── Role-based page access control ───
    // ADMIN: unrestricted. MANAGER: per-permission. STAFF & BARISTA: fixed page sets.
    // Denied page routes → redirect to dashboard (not 401, so they stay logged in).
    const STAFF_PAGES = ['/', '/directory', '/barista', '/orders']
    const BARISTA_PAGES = ['/', '/barista', '/orders']
    const ALL_APP_PAGES = ['/', '/directory', '/logs', '/stats', '/barista', '/orders', '/feedback', '/admin']

    if (role !== 'ADMIN') {
      const currentPage = ALL_APP_PAGES.find(p => p === '/' ? path === '/' : path.startsWith(p))
      if (currentPage) {
        let allowed = false
        if (role === 'MANAGER') {
          allowed = managerCanAccess(currentPage)
        } else if (role === 'STAFF') {
          allowed = STAFF_PAGES.includes(currentPage)
        } else if (role === 'BARISTA') {
          allowed = BARISTA_PAGES.includes(currentPage)
        }
        if (!allowed) {
          const redirectTo = role === 'MANAGER' ? (managerPermissions[0] || '/') : (role === 'BARISTA' ? '/barista' : '/')
          const response = NextResponse.redirect(new URL(redirectTo, request.url))
          applySecurityHeaders(response, isHttps)
          return response
        }
      }
    }

    // ─── API route role enforcement ───
    if (path.startsWith('/api/promo') && !path.startsWith('/api/promo/validate')) {
      const method = request.method
      const isPromoIdPatch = /^\/api\/promo\/\d+$/.test(path) && method === 'PATCH'
      if (!isPromoIdPatch && role !== 'ADMIN' && !managerCanAccess('/admin')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }
    if (path.startsWith('/api/stats') && role !== 'ADMIN' && !managerCanAccess('/stats')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/auth/reset-password') && role !== 'ADMIN' && !managerCanAccess('/admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/auth/audit-logs') && role !== 'ADMIN' && !managerCanAccess('/admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/auth/users') && role !== 'ADMIN' && !managerCanAccess('/admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/auth/register') && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/barista') && role !== 'ADMIN' && role !== 'STAFF' && role !== 'BARISTA' && !managerCanAccess('/barista')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/logs') && role !== 'ADMIN' && !managerCanAccess('/logs')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (path.startsWith('/api/feedback') && role !== 'ADMIN' && !managerCanAccess('/feedback')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const response = NextResponse.next()
    applySecurityHeaders(response, isHttps)
    return response
  } catch {
    if (path.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      applySecurityHeaders(response, isHttps)
      return response
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    // Clear invalid cookies
    response.cookies.set(STAFF_COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' })
    response.cookies.set(CUSTOMER_COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' })
    applySecurityHeaders(response, isHttps)
    return response
  }
}

function applySecurityHeaders(response: NextResponse, isHttps: boolean) {
  for (const [key, value] of Object.entries(buildSecurityHeaders(isHttps))) {
    response.headers.set(key, value)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.gif$|.*\\.ico$|.*\\.webp$).*)'],
}
