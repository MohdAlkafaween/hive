import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { todayString } from '@/lib/subscriptionLogic'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const url = new URL(req.url)
    const todayStart = new Date(`${todayString()}T00:00:00`)

    // ?count=true — lightweight endpoint for sidebar badge
    if (url.searchParams.get('count') === 'true') {
      const pendingCount = await prisma.baristaOrder.count({
        where: { orderedBy: 'CUSTOMER', status: 'PENDING', createdAt: { gte: todayStart } },
      })
      return Response.json({ pendingCount })
    }

    const orders = await prisma.baristaOrder.findMany({
      where: {
        orderedBy: 'CUSTOMER',
        createdAt: { gte: todayStart },
      },
      include: {
        menuItem: { select: { name: true, nameAr: true } },
        student: { select: { id: true, fullName: true, studentNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })

    // Group by orderGroupId
    const groups = new Map<string, typeof orders>()
    for (const order of orders) {
      const key = order.orderGroupId || order.id.toString()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(order)
    }

    const statusPriority: Record<string, number> = { PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELLED: 5 }

    const result = Array.from(groups.entries()).map(([groupId, items]) => {
      const first = items[0]
      const total = items.reduce((s, i) => s + i.finalPrice, 0)
      const groupStatus = items.reduce((lowest, i) => {
        return (statusPriority[i.status] ?? 99) < (statusPriority[lowest] ?? 99) ? i.status : lowest
      }, items[0].status)

      return {
        orderGroupId: groupId,
        receiptNumber: first.receiptNumber,
        status: groupStatus,
        createdAt: first.createdAt,
        studentName: first.student?.fullName || 'Unknown',
        studentNumber: first.student?.studentNumber,
        paymentMethod: first.paymentMethod,
        items: items.map(i => ({
          id: i.id,
          name: i.menuItem?.name || 'Unknown',
          nameAr: i.menuItem?.nameAr,
          quantity: i.quantity,
          options: i.selectedOptions,
          price: i.finalPrice,
          status: i.status,
          note: i.customerNote,
        })),
        total: Math.round(total * 100) / 100,
      }
    })

    // Sort: PENDING first, then by status priority, then by time
    result.sort((a, b) => {
      const pa = statusPriority[a.status] ?? 99
      const pb = statusPriority[b.status] ?? 99
      if (pa !== pb) return pa - pb
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    return Response.json({ orders: result })
  } catch (e) {
    console.error('[GET /api/orders/queue]', e)
    return Response.json({ error: 'Failed to load queue' }, { status: 500 })
  }
}
