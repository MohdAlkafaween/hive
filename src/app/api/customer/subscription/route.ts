import prisma from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customerAuth'

export async function GET(req: Request) {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  try {
    const url = new URL(req.url)
    const history = url.searchParams.get('history') === 'true'

    if (history) {
      // Return all subscriptions (current + past)
      const subscriptions = await prisma.subscription.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          planType: true,
          startDate: true,
          expiryDate: true,
          totalVisitsAllowed: true,
          visitsUsed: true,
          isActive: true,
          isFrozen: true,
          createdAt: true,
        },
      })
      return Response.json({ subscriptions })
    }

    // Return active subscription only
    const subscription = await prisma.subscription.findFirst({
      where: { studentId: student.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        planType: true,
        startDate: true,
        expiryDate: true,
        totalVisitsAllowed: true,
        visitsUsed: true,
        isActive: true,
        isFrozen: true,
        frozenAt: true,
        freezeDays: true,
        windowStart: true,
        createdAt: true,
      },
    })

    return Response.json({ subscription: subscription ?? null })
  } catch (e) {
    console.error('[GET /api/customer/subscription]', e)
    return Response.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
