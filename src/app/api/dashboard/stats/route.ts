import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'

// GET — lightweight dashboard stats (accessible to all authenticated roles)
// Returns: active subscription count, expiring-soon students, today's occupancy
// This replaces the pattern of fetching ALL students client-side just for counts.
export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'STAFF', 'MANAGER')
    if (session instanceof Response) return session

    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000)

    const [
      activeSubsCount,
      expiringSubscriptions,
    ] = await Promise.all([
      // Count students with at least one active subscription
      prisma.subscription.count({
        where: { isActive: true, expiryDate: { gte: now } },
      }),
      // Find subscriptions expiring within 3 days (for ExpiryBanner)
      prisma.subscription.findMany({
        where: {
          isActive: true,
          expiryDate: { gte: now, lte: threeDaysFromNow },
        },
        include: {
          student: { select: { id: true, fullName: true } },
        },
        orderBy: { expiryDate: 'asc' },
        take: 20,
      }),
    ])

    const expiring = expiringSubscriptions
      .filter(sub => sub.student)
      .map(sub => ({
        id: sub.student!.id,
        fullName: sub.student!.fullName,
        daysLeft: Math.ceil((new Date(sub.expiryDate).getTime() - now.getTime()) / 86400000),
        planType: sub.planType,
      }))

    return Response.json({
      activeSubsCount,
      expiring,
    })
  } catch (e) {
    console.error('[GET /api/dashboard/stats]', e)
    return Response.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
