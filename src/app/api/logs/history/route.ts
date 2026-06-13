import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// GET — fetch logs for a specific date, or all dates grouped
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const date = req.nextUrl.searchParams.get('date')

    if (date && isValidDateString(date)) {
      // Specific date
      const logs = await prisma.log.findMany({
        where: { date },
        orderBy: { checkInTime: 'desc' },
        include: {
          student: {
            select: {
              id: true, fullName: true, phone: true, major: true,
              subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1, select: { planType: true } },
            },
          },
          processedByUser: { select: { name: true, email: true } },
        },
        take: 500,
      })
      return Response.json(logs)
    }

    // All dates — return unique dates with counts for the calendar view
    const allDates = await prisma.log.groupBy({
      by: ['date'],
      _count: { id: true },
      orderBy: { date: 'desc' },
    })

    return Response.json(allDates.map(d => ({ date: d.date, count: d._count.id })))
  } catch (e) {
    console.error('[GET /api/logs/history]', e)
    return Response.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
