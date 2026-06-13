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
    if (!dateParam || !isValidDateString(dateParam)) {
      return Response.json({ error: 'Invalid date. Use YYYY-MM-DD format.' }, { status: 400 })
    }

    // Reject future dates
    const today = todayString()
    if (dateParam > today) {
      return Response.json({ error: 'Cannot generate report for future dates' }, { status: 400 })
    }

    const start = new Date(`${dateParam}T00:00:00`)
    const end = new Date(`${dateParam}T23:59:59.999`)

    // Fetch all data for the date in parallel
    const [transactions, logs, baristaOrders, expenses] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          student: { select: { fullName: true, phone: true } },
          subscription: {
            select: {
              planType: true,
              startDate: true,
              expiryDate: true,
              visitsUsed: true,
              totalVisitsAllowed: true,
              isActive: true,
              isFrozen: true,
              createdByUser: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      }),
      prisma.log.findMany({
        where: { date: dateParam },
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
        take: 2000,
      }),
      prisma.baristaOrder.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          menuItem: { select: { name: true } },
          student: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      }),
      prisma.cafeExpense.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: 'asc' },
        take: 1000,
      }),
    ])

    // Compute totals
    const activeTx = transactions.filter(t => t.type !== 'VOID')
    const subscriptionRevenue = activeTx.reduce((s, t) => s + t.amountPaid, 0)
    const totalDiscounts = activeTx.filter(t => t.type === 'SALE').reduce((s, t) => s + t.discountAmount, 0)
    const baristaRevenue = baristaOrders.reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0)
    const baristaCost = baristaOrders.reduce((s, o) => s + (o.costPrice || 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

    // Unique students who checked in
    const uniqueStudentIds = new Set(logs.filter(l => l.studentId).map(l => l.studentId))

    // New subscriptions vs renewals
    const newSubscriptions = activeTx.filter(t => t.type === 'SALE').length

    return Response.json({
      date: dateParam,
      summary: {
        subscriptionRevenue: Math.round(subscriptionRevenue * 100) / 100,
        cafeRevenue: Math.round(baristaRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netRevenue: Math.round((subscriptionRevenue + baristaRevenue - totalExpenses) * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        totalCheckIns: logs.length,
        uniqueStudents: uniqueStudentIds.size,
        newSubscriptions,
        cafeProfit: Math.round((baristaRevenue - baristaCost) * 100) / 100,
      },
      transactions: transactions.map(t => ({
        receiptNumber: t.receiptNumber || '-',
        studentName: t.student?.fullName || t.studentName || 'Deleted Student',
        studentPhone: t.student?.phone || '',
        planType: t.subscription?.planType || t.planType,
        amountPaid: t.amountPaid,
        discountAmount: t.discountAmount,
        netAmount: Math.round((t.amountPaid - t.discountAmount) * 100) / 100,
        gateway: t.gateway,
        type: t.type,
        time: t.createdAt,
        startDate: t.subscription?.startDate || null,
        expiryDate: t.subscription?.expiryDate || null,
        visitsUsed: t.subscription?.visitsUsed ?? null,
        totalVisitsAllowed: t.subscription?.totalVisitsAllowed ?? null,
        subStatus: t.subscription ? (t.subscription.isFrozen ? 'Frozen' : t.subscription.isActive ? 'Active' : 'Expired') : '-',
        createdBy: t.subscription?.createdByUser?.name || '-',
      })),
      logs: logs.map(l => ({
        studentName: l.student?.fullName || l.studentName || 'Deleted Student',
        studentPhone: l.student?.phone || '',
        subscriptionType: l.student?.subscriptions?.[0]?.planType || '-',
        checkInTime: l.checkInTime,
        checkOutTime: l.checkOutTime,
        method: l.method || 'MANUAL',
        processedBy: l.processedByUser?.name || '-',
      })),
      baristaOrders: baristaOrders.map(o => ({
        receiptNumber: o.receiptNumber || '-',
        itemName: o.menuItem?.name || 'Deleted Item',
        quantity: o.quantity,
        unitPrice: Math.round(((o.finalPrice || o.totalPrice) / o.quantity) * 100) / 100,
        selectedOptions: o.selectedOptions,
        totalPrice: o.finalPrice || o.totalPrice,
        paymentMethod: o.paymentMethod,
        studentName: o.student?.fullName || null,
        time: o.createdAt,
      })),
      expenses: expenses.map(e => ({
        description: e.description,
        category: e.category || '-',
        amount: e.amount,
        addedBy: e.addedByName || '-',
        time: e.date,
      })),
    })
  } catch (e) {
    console.error('[GET /api/reports/daily]', e)
    return Response.json({ error: 'Failed to generate daily report' }, { status: 500 })
  }
}
