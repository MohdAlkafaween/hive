import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { auditLog } from '@/lib/auditLog'
import prisma from '@/lib/prisma'

export async function POST() {
  // Log who is logging out (best effort — don't block on failure)
  try {
    const session = await verifyAuth()
    if (session) {
      auditLog('LOGOUT', { userId: session.userId as number, email: session.email as string })

      // Persist logout event to DB audit trail
      try {
        await prisma.staffAuditLog.create({
          data: {
            userId: session.userId as number,
            email: session.email as string,
            role: session.role as string,
            event: 'LOGOUT',
            ip: 'session-end',
          },
        })
      } catch { /* don't block logout */ }

      // Auto clock-out on logout
      try {
        const today = new Date().toISOString().slice(0, 10)
        const openShift = await prisma.staffShift.findFirst({
          where: { userId: session.userId as number, date: today, clockOut: null },
        })
        if (openShift) {
          await prisma.staffShift.update({
            where: { id: openShift.id },
            data: { clockOut: new Date() },
          })
        }
      } catch { /* don't block logout */ }
    }
  } catch { /* ignore — clearing cookie is what matters */ }

  const res = NextResponse.json({ message: 'Logout successful' })
  res.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0),
    path: '/'
  })
  return res
}
