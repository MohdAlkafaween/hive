import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { todayString } from '@/lib/subscriptionLogic'

// GET daily summary — admin only
export async function GET() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const today = todayString()
    const start = new Date(`${today}T00:00:00`)
    const end   = new Date(`${today}T23:59:59.999`)

    const [logs, transactions, newStudents, activeSubscriptions, baristaOrders] = await Promise.all([
      prisma.log.findMany({ where: { date: today }, include: { student: { select: { fullName: true } } } }),
      prisma.transaction.findMany({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.student.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.baristaOrder.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { menuItem: { select: { name: true } } },
      }),
    ])

    const totalCheckIns = logs.length
    const currentlyInside = logs.filter(l => !l.checkOutTime).length
    const totalRevenue = transactions.reduce((s, t) => s + t.amountPaid, 0)
    const totalDiscounts = transactions.reduce((s, t) => s + t.discountAmount, 0)
    const subscriptionRevenue = totalRevenue
    const baristaRevenue = baristaOrders.reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0)
    const baristaCost = baristaOrders.reduce((s, o) => s + (o.costPrice || 0), 0)
    const baristaProfit = baristaRevenue - baristaCost

    // Today's expenses
    const todayExpenses = await prisma.cafeExpense.findMany({
      where: { date: { gte: start, lte: end } },
    })
    const totalExpenses = todayExpenses.reduce((s, e) => s + e.amount, 0)
    const netProfit = baristaProfit - totalExpenses

    // Peak hour calculation
    const hourCounts: Record<number, number> = {}
    for (const log of logs) {
      const hour = new Date(log.checkInTime).getHours()
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
    }
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

    // Top menu items
    const menuItemCounts: Record<string, number> = {}
    for (const o of baristaOrders) {
      const name = o.menuItem?.name ?? 'Deleted Item'
      menuItemCounts[name] = (menuItemCounts[name] ?? 0) + o.quantity
    }
    const topMenuItems = Object.entries(menuItemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return Response.json({
      date: today,
      checkIns: totalCheckIns,
      currentlyInside,
      newStudents,
      activeSubscriptions,
      revenue: {
        subscriptions: subscriptionRevenue,
        barista: baristaRevenue,
        total: subscriptionRevenue + baristaRevenue,
        discounts: totalDiscounts,
      },
      profit: {
        totalSales: baristaRevenue,
        totalCost: baristaCost,
        totalProfit: baristaProfit,
        totalExpenses,
        netProfit,
      },
      peakHour: peakHour ? { hour: parseInt(peakHour[0]), count: peakHour[1] } : null,
      baristaOrders: baristaOrders.length,
      topMenuItems,
    })
  } catch (e) {
    console.error('[GET /api/stats/summary]', e)
    return Response.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
