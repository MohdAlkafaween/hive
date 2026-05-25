import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'

export async function GET(req: NextRequest) {
  try {
    // Stats are ADMIN-only
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const dateParam = req.nextUrl.searchParams.get('date')
    const today = (dateParam && isValidDateString(dateParam)) ? dateParam : new Date().toISOString().slice(0, 10)

    const start = new Date(`${today}T00:00:00.000Z`)
    const end   = new Date(`${today}T23:59:59.999Z`)

    const [logs, transactions] = await Promise.all([
      prisma.log.findMany({
        where: { date: today },
        include: { student: { select: { fullName: true } } },
        orderBy: { checkInTime: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { student: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const totalRevenue   = transactions.reduce((s, t) => s + t.amountPaid,    0)
    const totalDiscounts = transactions.reduce((s, t) => s + t.discountAmount, 0)
    const totalCheckIns  = logs.length

    const revenueByGateway: Record<string, number> = {}
    for (const t of transactions) {
      revenueByGateway[t.gateway] = (revenueByGateway[t.gateway] ?? 0) + t.amountPaid
    }

    return Response.json({
      date: today,
      totalRevenue,
      totalDiscounts,
      totalCheckIns,
      revenueByGateway,
      transactions,
      logs,
    })
  } catch (e) {
    console.error('[GET /api/stats/daily]', e)
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
