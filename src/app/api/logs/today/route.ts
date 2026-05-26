import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'
import { autoExpireSubscriptions } from '@/lib/autoExpire'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    // Auto-expire stale subscriptions on dashboard load
    await autoExpireSubscriptions().catch(() => {})

    const dateParam = req.nextUrl.searchParams.get('date')
    const today = (dateParam && isValidDateString(dateParam)) ? dateParam : new Date().toISOString().slice(0, 10)

    const logs = await prisma.log.findMany({
      where: { date: today },
      orderBy: { checkInTime: 'desc' },
      include: { student: true },
    })
    return Response.json(logs)
  } catch (e) {
    console.error('[GET /api/logs/today]', e)
    return Response.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
