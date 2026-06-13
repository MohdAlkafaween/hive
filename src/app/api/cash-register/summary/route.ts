import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { todayString } from '@/lib/subscriptionLogic'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    // Get current open register for this user
    const openRegister = await prisma.cashRegister.findFirst({
      where: { userId: session.userId as number, status: 'OPEN' },
    })

    // Get today's order totals by payment method
    const todayStr = todayString()
    const today = new Date(`${todayStr}T00:00:00`)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const orders = await prisma.baristaOrder.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      select: { totalPrice: true, finalPrice: true, paymentMethod: true },
    })

    const cashTotal = orders.filter(o => o.paymentMethod === 'CASH').reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0)
    const cardTotal = orders.filter(o => o.paymentMethod === 'CARD').reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0)
    const otherTotal = orders.filter(o => o.paymentMethod !== 'CASH' && o.paymentMethod !== 'CARD').reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0)

    return Response.json({
      openRegister,
      todayCash: cashTotal,
      todayCard: cardTotal,
      todayOther: otherTotal,
      todayTotal: cashTotal + cardTotal + otherTotal,
      orderCount: orders.length,
    })
  } catch {
    return Response.json({ error: 'Failed to load summary' }, { status: 500 })
  }
}
