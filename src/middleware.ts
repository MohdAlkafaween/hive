import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

// Security headers applied to every response
// TODO: Implement CSP nonces for Next.js scripts to remove 'unsafe-inline' in production
const isProd = process.env.NODE_ENV === 'production'
const scriptSrc = isProd
  ? "'self' 'unsafe-inline'" // No unsafe-eval in production
  : "'self' 'unsafe-eval' 'unsafe-inline'" // Next.js dev needs unsafe-eval for HMR

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths — no auth required
  const isPublicPath =
    path === '/login' ||
    path === '/checkin' ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/logout') ||
    path.startsWith('/api/auth/seed') ||
    path.startsWith('/api/auth/me') ||
    path === '/api/checkin' ||
    path === '/api/checkin/qr' ||
    path === '/api/checkin/search' ||
    path.startsWith('/api/rfid') ||
    path === '/display' ||
    path.startsWith('/api/display')

  if (isPublicPath) {
    const response = NextResponse.next()
    applySecurityHeaders(response)
    return response
  }

  // Block open registration from being accessed without auth at middleware level
  if (path.startsWith('/api/auth/register')) {
    // Let the route handler enforce ADMIN auth — just pass through
    const response = NextResponse.next()
    applySecurityHeaders(response)
    return response
  }

  // Check auth for all other routes
  const sessionToken = request.cookies.get('session')?.value

  if (!sessionToken) {
    // API routes return 401, page routes redirect to login
    if (path.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      applySecurityHeaders(response)
      return response
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    applySecurityHeaders(response)
    return response
  }

  try {
    const payload = await decrypt(sessionToken)
    if (!payload) throw new Error('Invalid token')

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

    // Role-based access control
    if (path.startsWith('/admin')) {
      if (role !== 'ADMIN' && !managerCanAccess('/admin')) {
        const response = NextResponse.redirect(new URL('/', request.url))
        applySecurityHeaders(response)
        return response
      }
    }

    if (path.startsWith('/stats')) {
      if (role !== 'ADMIN' && !managerCanAccess('/stats')) {
        const response = NextResponse.redirect(new URL('/', request.url))
        applySecurityHeaders(response)
        return response
      }
    }

    if (path.startsWith('/barista')) {
      if (role !== 'ADMIN' && role !== 'STAFF' && !managerCanAccess('/barista')) {
        const response = NextResponse.redirect(new URL('/', request.url))
        applySecurityHeaders(response)
        return response
      }
    }

    if (path.startsWith('/logs')) {
      if (role !== 'ADMIN' && role !== 'STAFF' && !managerCanAccess('/logs')) {
        const response = NextResponse.redirect(new URL('/', request.url))
        applySecurityHeaders(response)
        return response
      }
    }

    // MANAGER with no access to current page → redirect to first allowed page
    if (role === 'MANAGER') {
      const appPages = ['/', '/directory', '/logs', '/stats', '/barista', '/admin']
      const currentPage = appPages.find(p => p === '/' ? path === '/' : path.startsWith(p))
      if (currentPage && !managerCanAccess(currentPage)) {
        const firstAllowed = managerPermissions[0] || '/'
        const response = NextResponse.redirect(new URL(firstAllowed, request.url))
        applySecurityHeaders(response)
        return response
      }
    }

    // API route role enforcement
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
    if (path.startsWith('/api/barista') && role !== 'ADMIN' && role !== 'STAFF' && !managerCanAccess('/barista')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const response = NextResponse.next()
    applySecurityHeaders(response)
    return response
  } catch {
    if (path.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      applySecurityHeaders(response)
      return response
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    // Clear the invalid cookie
    response.cookies.set('session', '', { httpOnly: true, expires: new Date(0), path: '/' })
    applySecurityHeaders(response)
    return response
  }
}

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
