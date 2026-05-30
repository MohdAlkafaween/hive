import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { todayString } from '@/lib/subscriptionLogic'

// Public endpoint — no auth required, rate-limited
// Returns current occupancy data for the display page
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`display:${ip}`, 30, 60 * 1000)
    if (limit.limited) return Response.json({ error: 'Too many requests' }, { status: 429 })
    // Check if display is enabled
    const displaySetting = await prisma.appSetting.findUnique({ where: { key: 'displayEnabled' } })
    if (!displaySetting || displaySetting.value !== 'true') {
      return Response.json({ enabled: false }, { status: 403 })
    }

    const maxCapSetting = await prisma.appSetting.findUnique({ where: { key: 'maxCapacity' } })
    const maxCapacity = maxCapSetting ? parseInt(maxCapSetting.value, 10) : 30

    const today = todayString()

    // Count students currently checked in (have checkIn but no checkOut today)
    const checkedIn = await prisma.log.count({
      where: { date: today, checkOutTime: null },
    })

    // Get recent check-ins for the feed (last 5)
    const recentLogs = await prisma.log.findMany({
      where: { date: today },
      orderBy: { checkInTime: 'desc' },
      take: 5,
      include: { student: { select: { fullName: true } } },
    })

    const displayConnection = await prisma.appSetting.findUnique({ where: { key: 'displayConnection' } })

    return Response.json({
      enabled: true,
      currentOccupancy: checkedIn,
      maxCapacity,
      connectionType: displayConnection?.value ?? 'browser',
      recentActivity: recentLogs.map(l => ({
        name: (() => {
          const parts = l.student?.fullName?.split(' ') ?? []
          if (parts.length === 0) return 'Guest'
          // Show only initials on public display for privacy
          return parts.map(p => p[0]?.toUpperCase()).filter(Boolean).join('.') + '.'
        })(),
        time: l.checkInTime,
        type: l.checkOutTime ? 'out' : 'in',
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[GET /api/display]', e)
    return Response.json({ error: 'Failed to fetch display data' }, { status: 500 })
  }
}
