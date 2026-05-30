import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'

// GET — monthly financial report
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { searchParams } = new URL(req.url)
    // Support both ?month=2026-05 (YYYY-MM) and ?year=2026&month=5
    const monthParam = searchParams.get('month') || ''
    let year: number, month: number
    if (monthParam.includes('-')) {
      const [y, m] = monthParam.split('-')
      year = Number(y) || new Date().getFullYear()
      month = Number(m) || new Date().getMonth() + 1
    } else {
      year = Number(searchParams.get('year')) || new Date().getFullYear()
      month = Number(monthParam) || new Date().getMonth() + 1
    }

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Use Prisma aggregate for revenue totals instead of loading all records into memory
    const [
      transactionAgg,
      transactionCount,
      totalCheckIns,
      activeSubsCount,
      newStudents,
      newSubscriptions,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { amountPaid: true, discountAmount: true },
      }),
      prisma.transaction.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.log.count({
        where: { checkInTime: { gte: startDate, lte: endDate } },
      }),
      prisma.subscription.count({
        where: { isActive: true, expiryDate: { gte: endDate } },
      }),
      prisma.student.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.subscription.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
    ])

    const totalRevenue = transactionAgg._sum.amountPaid || 0
    const totalDiscounts = transactionAgg._sum.discountAmount || 0

    // Revenue by gateway — use groupBy
    const gatewayGroups = await prisma.transaction.groupBy({
      by: ['gateway'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _sum: { amountPaid: true },
    })
    const revenueByGateway: Record<string, number> = {}
    for (const g of gatewayGroups) {
      revenueByGateway[g.gateway] = g._sum.amountPaid || 0
    }

    // Revenue by plan type — use groupBy
    const planGroups = await prisma.transaction.groupBy({
      by: ['planType'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _sum: { amountPaid: true },
      _count: { id: true },
    })
    const revenueByPlan: Record<string, { count: number; revenue: number }> = {}
    for (const p of planGroups) {
      revenueByPlan[p.planType] = { count: p._count.id, revenue: p._sum.amountPaid || 0 }
    }

    // Parallelize remaining queries
    const [uniqueStudentLogs, transactions, logs, shifts] = await Promise.all([
      // Unique students who checked in this month
      prisma.log.findMany({
        where: { checkInTime: { gte: startDate, lte: endDate } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      // Daily breakdown — transactions grouped by date
      prisma.transaction.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: { createdAt: true, amountPaid: true },
      }),
      // Daily check-ins
      prisma.log.findMany({
        where: { checkInTime: { gte: startDate, lte: endDate } },
        select: { date: true },
      }),
      // Staff shifts this month
      prisma.staffShift.findMany({
        where: { date: { gte: startDate.toISOString().slice(0, 10), lte: endDate.toISOString().slice(0, 10) } },
      }),
    ])

    const uniqueStudents = uniqueStudentLogs.filter(l => l.studentId !== null).length

    const dailyRevenue: Record<string, number> = {}
    for (const t of transactions) {
      const d = t.createdAt.toISOString().slice(0, 10)
      dailyRevenue[d] = (dailyRevenue[d] || 0) + t.amountPaid
    }

    const dailyCheckIns: Record<string, number> = {}
    for (const l of logs) {
      dailyCheckIns[l.date] = (dailyCheckIns[l.date] || 0) + 1
    }
    const staffHoursByEmail: Record<string, number> = {}
    let totalStaffHours = 0
    for (const s of shifts) {
      if (s.clockOut) {
        const hours = (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / (1000 * 60 * 60)
        staffHoursByEmail[s.email] = (staffHoursByEmail[s.email] || 0) + hours
        totalStaffHours += hours
      }
    }

    return Response.json({
      year, month,
      totalRevenue,
      totalDiscounts,
      netRevenue: totalRevenue - totalDiscounts,
      transactionCount,
      totalCheckIns,
      uniqueStudents,
      activeSubsCount,
      newStudents,
      newSubscriptions,
      revenueByGateway,
      revenueByPlan,
      dailyRevenue,
      dailyCheckIns,
      staffHours: totalStaffHours,
      staffHoursByEmail,
    })
  } catch (e) {
    console.error('[GET /api/reports]', e)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
