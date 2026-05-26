import prisma from '@/lib/prisma'

// Public endpoint — no auth required
// Returns current occupancy data for the display page
export async function GET() {
  try {
    // Check if display is enabled
    const displaySetting = await prisma.appSetting.findUnique({ where: { key: 'displayEnabled' } })
    if (!displaySetting || displaySetting.value !== 'true') {
      return Response.json({ enabled: false }, { status: 403 })
    }

    const maxCapSetting = await prisma.appSetting.findUnique({ where: { key: 'maxCapacity' } })
    const maxCapacity = maxCapSetting ? parseInt(maxCapSetting.value, 10) : 30

    const today = new Date().toISOString().slice(0, 10)

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
        name: l.student?.fullName?.split(' ')[0] ?? 'Guest', // First name only for privacy
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
