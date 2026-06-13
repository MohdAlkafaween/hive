import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'
import { autoExpireSubscriptions } from '@/lib/autoExpire'
import { todayString } from '@/lib/subscriptionLogic'
import { autoCheckoutExpired, getExpiringCheckIns } from '@/lib/autoCheckout'
import { checkStaffRateLimit } from '@/lib/rateLimit'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    // Auto-expire stale subscriptions on dashboard load
    await autoExpireSubscriptions().catch(() => {})

    // Auto-checkout students whose 24h window expired
    const autoResult = await autoCheckoutExpired().catch(() => ({ count: 0, expiredSubscriptions: [] }))

    const dateParam = req.nextUrl.searchParams.get('date')

    // If a specific historical date is requested, use the old date-based query
    if (dateParam && isValidDateString(dateParam) && dateParam !== todayString()) {
      const logs = await prisma.log.findMany({
        where: { date: dateParam },
        orderBy: { checkInTime: 'desc' },
        include: {
          // SECURITY (D1): feed only needs display fields, never credentials/PII extras
          student: { select: { id: true, studentNumber: true, fullName: true, phone: true, major: true, photoUrl: true } },
          processedByUser: { select: { name: true, email: true } },
        },
      })
      return Response.json(logs)
    }

    // Default: return active check-ins + today's completed visits
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS)
    const today = todayString()

    const logs = await prisma.log.findMany({
      where: {
        OR: [
          // Currently checked in (Rule 8: survives midnight)
          { checkOutTime: null },
          // Completed visits today (for feed history)
          { date: today, checkOutTime: { not: null } },
          // Active window check-ins from before today that completed within 24h
          { checkInTime: { gte: cutoff }, checkOutTime: { not: null } },
        ],
      },
      orderBy: { checkInTime: 'desc' },
      take: 2000,
      include: {
        // SECURITY (D1): feed only needs display fields + active sub, never credentials/PII extras
        student: {
          select: {
            id: true,
            studentNumber: true,
            fullName: true,
            phone: true,
            major: true,
            photoUrl: true,
            subscriptions: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        processedByUser: { select: { name: true, email: true } },
      },
    })

    // Add minutesRemaining for active check-ins using windowStart from subscription
    const now = Date.now()
    const enrichedLogs = logs.map(log => {
      let minutesRemaining: number | null = null
      if (!log.checkOutTime && log.student) {
        const activeSub = log.student.subscriptions[0]
        if (activeSub?.windowStart) {
          // Use windowStart for accurate countdown (not this log's checkInTime)
          const windowStartMs = new Date(activeSub.windowStart).getTime()
          const expiresAt = windowStartMs + TWENTY_FOUR_HOURS_MS
          minutesRemaining = Math.max(0, Math.floor((expiresAt - now) / 60000))
        } else {
          // Fallback: use log's own checkInTime
          const checkInMs = new Date(log.checkInTime).getTime()
          const expiresAt = checkInMs + TWENTY_FOUR_HOURS_MS
          minutesRemaining = Math.max(0, Math.floor((expiresAt - now) / 60000))
        }
      }
      return { ...log, minutesRemaining }
    })

    // Get expiring check-ins (23-24h range) for notifications
    const expiringCheckIns = await getExpiringCheckIns().catch(() => [])

    return Response.json({
      logs: enrichedLogs,
      notifications: {
        expiringCheckIns,
        expiredSubscriptions: autoResult.expiredSubscriptions || [],
        autoCheckedOut: autoResult.count || 0,
      },
    })
  } catch (e) {
    console.error('[GET /api/logs/today]', e)
    return Response.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
