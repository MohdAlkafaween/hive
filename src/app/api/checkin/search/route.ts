import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { sanitizeString } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * Public kiosk search endpoint — finds students by name or phone.
 * Rate-limited to prevent enumeration attacks.
 * Returns minimal data (no sensitive fields).
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`kiosk-search:${ip}`, 60, 60 * 1000) // 60 searches/min
    if (limit.limited) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    const rawQ = req.nextUrl.searchParams.get('q') ?? ''
    const q = sanitizeString(rawQ)
    if (!q || q.length < 2) return Response.json([])

    const students = await prisma.student.findMany({
      where: {
        OR: [
          { fullName: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      take: 8,
      select: {
        id: true,
        fullName: true,
        phone: true,
        major: true,
        lifetimeCheckIns: true,
        subscriptions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            planType: true,
            startDate: true,
            expiryDate: true,
            visitsUsed: true,
            totalVisitsAllowed: true,
            isActive: true,
          },
        },
      },
    })

    return Response.json(students)
  } catch (e) {
    console.error('[GET /api/checkin/search]', e)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
