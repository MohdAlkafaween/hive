import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'
import { todayString } from '@/lib/subscriptionLogic'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const dateParam = req.nextUrl.searchParams.get('date')
    const today = (dateParam && isValidDateString(dateParam)) ? dateParam : todayString()
    const start = new Date(`${today}T00:00:00`)
    const end   = new Date(`${today}T23:59:59.999`)

    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { fullName: true, phone: true } } },
    })
    return Response.json(transactions)
  } catch (e) {
    console.error('[GET /api/transactions/today]', e)
    return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
