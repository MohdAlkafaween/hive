import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, encrypt } from '@/lib/auth'

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

  const user = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: { id: true, email: true, role: true, permissions: true, isActive: true },
  })

  if (!user || !user.isActive) {
    const res = NextResponse.json({ error: 'Account disabled' }, { status: 403 })
    res.cookies.set('session', '', { httpOnly: true, expires: new Date(0), path: '/' })
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
  res.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  return res
}
