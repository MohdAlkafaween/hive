import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'
import { toLocalDateString } from '@/lib/subscriptionLogic'

// GET — barista order logs, optionally filtered by date
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const date = req.nextUrl.searchParams.get('date')

    if (date && isValidDateString(date)) {
      // Filter by specific date
      const startOfDay = new Date(date + 'T00:00:00')
      const endOfDay = new Date(date + 'T23:59:59.999')

      const orders = await prisma.baristaOrder.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: 'desc' },
        include: { menuItem: true },
        take: 500, // safety limit
      })
      return Response.json(orders)
    }

    // Date range filtering (default: last 30 days) to avoid unbounded queries
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const rangeStart = (startDate && isValidDateString(startDate))
      ? new Date(startDate + 'T00:00:00')
      : thirtyDaysAgo
    const rangeEnd = (endDate && isValidDateString(endDate))
      ? new Date(endDate + 'T23:59:59.999')
      : now

    // Use Prisma groupBy for date aggregation instead of loading all orders into memory
    const ordersByDate = await prisma.baristaOrder.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
      _count: { id: true },
      _sum: { totalPrice: true },
      orderBy: { createdAt: 'desc' },
    })

    // Group by date string in JS (groupBy on DateTime gives per-second, we need per-day)
    const dateMap = new Map<string, { count: number; revenue: number }>()
    for (const entry of ordersByDate) {
      const d = toLocalDateString(entry.createdAt)
      const existing = dateMap.get(d) || { count: 0, revenue: 0 }
      existing.count += entry._count.id
      existing.revenue += entry._sum.totalPrice || 0
      dateMap.set(d, existing)
    }

    const dates = Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 500) // safety limit

    return Response.json(dates)
  } catch (e) {
    console.error('[GET /api/barista/logs]', e)
    return Response.json({ error: 'Failed to fetch barista logs' }, { status: 500 })
  }
}
