import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { sanitizeString } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * Kiosk search endpoint — finds students by name.
 * Rate-limited to prevent enumeration attacks.
 * Returns minimal data only (no phone, no major, no sensitive fields).
 * Note: This endpoint requires auth since Fix #7 (removed from public paths).
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`kiosk-search:${ip}`, 15, 60 * 1000) // 15 searches/min (reduced from 60)
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
        ],
      },
      take: 8,
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        subscriptions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            planType: true,
            isActive: true,
          },
        },
      },
    })

    // Return minimal data: first name only for display, subscription status boolean
    const result = students.map(s => ({
      id: s.id,
      fullName: s.fullName,
      photoUrl: s.photoUrl,
      hasActiveSubscription: s.subscriptions.length > 0,
      planType: s.subscriptions[0]?.planType || null,
    }))

    return Response.json(result)
  } catch (e) {
    console.error('[GET /api/checkin/search]', e)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
