import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'

// GET — barista order logs, optionally filtered by date
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

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
      })
      return Response.json(orders)
    }

    // All dates — return dates with revenue totals
    const allOrders = await prisma.baristaOrder.findMany({
      select: { createdAt: true, totalPrice: true },
      orderBy: { createdAt: 'desc' },
    })

    // Group by date
    const dateMap = new Map<string, { count: number; revenue: number }>()
    for (const order of allOrders) {
      const d = order.createdAt.toISOString().slice(0, 10)
      const entry = dateMap.get(d) || { count: 0, revenue: 0 }
      entry.count++
      entry.revenue += order.totalPrice
      dateMap.set(d, entry)
    }

    const dates = Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.date.localeCompare(a.date))

    return Response.json(dates)
  } catch (e) {
    console.error('[GET /api/barista/logs]', e)
    return Response.json({ error: 'Failed to fetch barista logs' }, { status: 500 })
  }
}
