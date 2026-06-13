import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { auditLog } from '@/lib/auditLog'
import prisma from '@/lib/prisma'
import { todayString } from '@/lib/subscriptionLogic'
import { STAFF_COOKIE_NAME, CUSTOMER_COOKIE_NAME, getClearCookieOptions } from '@/lib/cookieConfig'

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
        const today = todayString()
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
  // Clear both cookies to handle any session type
  const clearOpts = getClearCookieOptions()
  res.cookies.set(STAFF_COOKIE_NAME, '', clearOpts)
  res.cookies.set(CUSTOMER_COOKIE_NAME, '', clearOpts)
  return res
}
