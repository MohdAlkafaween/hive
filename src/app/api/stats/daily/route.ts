import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidDateString } from '@/lib/sanitize'
import { todayString } from '@/lib/subscriptionLogic'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const dateParam = req.nextUrl.searchParams.get('date')
    const today = (dateParam && isValidDateString(dateParam)) ? dateParam : todayString()

    const start = new Date(`${today}T00:00:00`)
    const end   = new Date(`${today}T23:59:59.999`)

    const [logs, transactions, baristaOrders, expenses] = await Promise.all([
      prisma.log.findMany({
        where: { date: today },
        include: {
          student: {
            select: {
              fullName: true,
              phone: true,
              subscriptions: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { planType: true },
              },
            },
          },
          processedByUser: { select: { name: true } },
        },
        orderBy: { checkInTime: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          student: { select: { fullName: true } },
          subscription: { select: { planType: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.baristaOrder.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { menuItem: { select: { name: true } }, student: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.cafeExpense.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: 'asc' },
      }),
    ])

    const activeTx = transactions.filter(t => t.type !== 'VOID')
    const subscriptionRevenue = activeTx.reduce((s, t) => s + t.amountPaid, 0)
    const totalDiscounts = activeTx.filter(t => t.type === 'SALE').reduce((s, t) => s + t.discountAmount, 0)
    const totalCheckIns  = logs.length

    const baristaRevenue = baristaOrders.reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0)
    const baristaCost = baristaOrders.reduce((s, o) => s + (o.costPrice || 0), 0)
    const baristaProfit = baristaRevenue - baristaCost

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const totalRevenue = subscriptionRevenue + baristaRevenue

    const revenueByGateway: Record<string, number> = {}
    for (const t of activeTx) {
      revenueByGateway[t.gateway] = (revenueByGateway[t.gateway] ?? 0) + t.amountPaid
    }

    // Add barista payment methods to gateway breakdown
    for (const o of baristaOrders) {
      const gw = o.paymentMethod === 'CASH' ? 'Cash (Café)' : 'Card (Café)'
      revenueByGateway[gw] = (revenueByGateway[gw] ?? 0) + (o.finalPrice || o.totalPrice)
    }

    // Top menu items sold today
    const menuItemCounts: Record<string, number> = {}
    for (const o of baristaOrders) {
      const itemName = o.menuItem?.name ?? 'Deleted Item'
      menuItemCounts[itemName] = (menuItemCounts[itemName] ?? 0) + o.quantity
    }
    const topMenuItems = Object.entries(menuItemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return Response.json({
      date: today,
      totalRevenue,
      totalDiscounts,
      totalCheckIns,
      revenueByGateway,
      transactions,
      logs,
      // Barista data
      baristaOrders: baristaOrders.map(o => ({
        id: o.id,
        menuItem: o.menuItem?.name ?? 'Deleted Item',
        quantity: o.quantity,
        totalPrice: o.finalPrice || o.totalPrice,
        costPrice: o.costPrice,
        paymentMethod: o.paymentMethod,
        receiptNumber: o.receiptNumber,
        student: o.student,
        createdAt: o.createdAt,
      })),
      baristaRevenue,
      baristaCost,
      baristaProfit,
      subscriptionRevenue,
      topMenuItems,
      // Expenses
      expenses: expenses.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category,
        addedByName: e.addedByName,
        createdAt: e.createdAt,
      })),
      totalExpenses,
      netProfit: totalRevenue - baristaCost - totalExpenses,
    })
  } catch (e) {
    console.error('[GET /api/stats/daily]', e)
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
