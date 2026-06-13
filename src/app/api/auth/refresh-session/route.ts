import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, encrypt } from '@/lib/auth'
import { STAFF_COOKIE_NAME, STAFF_COOKIE_OPTIONS, getClearCookieOptions } from '@/lib/cookieConfig'

/**
 * POST /api/auth/refresh-session
 * Re-signs the JWT with fresh permissions from the database.
 * Called by the app layout on load so MANAGER permission changes
 * take effect without requiring a re-login.
 */
export async function POST() {
  const session = await verifyAuth()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // DB error (SQLITE_BUSY, etc.) — return 503, NOT 500/401, so the client
  // retries instead of logging the user out (same pattern as authGuard.ts)
  let user
  try {
    user = await prisma.user.findUnique({
      where: { id: session.userId as number },
      select: { id: true, email: true, role: true, permissions: true, isActive: true },
    })
  } catch (error) {
    console.error('[refresh-session] DB error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503, headers: { 'Retry-After': '2' } }
    )
  }

  if (!user || !user.isActive) {
    const res = NextResponse.json({ error: 'Account disabled' }, { status: 403 })
    res.cookies.set(STAFF_COOKIE_NAME, '', getClearCookieOptions())
    return res
  }

  // Re-sign token with fresh data
  const sessionToken = await encrypt({
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions || '[]',
  })

  const res = NextResponse.json({ refreshed: true })
  res.cookies.set(STAFF_COOKIE_NAME, sessionToken, STAFF_COOKIE_OPTIONS)

  return res
}
