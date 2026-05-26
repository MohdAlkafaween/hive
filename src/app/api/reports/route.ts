import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'

// GET — monthly financial report
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year')) || new Date().getFullYear()
    const month = Number(searchParams.get('month')) || new Date().getMonth() + 1

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Transactions for the month
    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { student: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const totalRevenue = transactions.reduce((s, t) => s + t.amountPaid, 0)
    const totalDiscounts = transactions.reduce((s, t) => s + t.discountAmount, 0)
    const transactionCount = transactions.length

    // Revenue by gateway
    const revenueByGateway: Record<string, number> = {}
    for (const t of transactions) {
      revenueByGateway[t.gateway] = (revenueByGateway[t.gateway] || 0) + t.amountPaid
    }

    // Revenue by plan type
    const revenueByPlan: Record<string, { count: number; revenue: number }> = {}
    for (const t of transactions) {
      if (!revenueByPlan[t.planType]) revenueByPlan[t.planType] = { count: 0, revenue: 0 }
      revenueByPlan[t.planType].count++
      revenueByPlan[t.planType].revenue += t.amountPaid
    }

    // Check-ins for the month
    const logs = await prisma.log.findMany({
      where: { checkInTime: { gte: startDate, lte: endDate } },
    })
    const totalCheckIns = logs.length
    const uniqueStudents = new Set(logs.map(l => l.studentId).filter(Boolean)).size

    // Daily breakdown
    const dailyRevenue: Record<string, number> = {}
    const dailyCheckIns: Record<string, number> = {}
    for (const t of transactions) {
      const d = t.createdAt.toISOString().slice(0, 10)
      dailyRevenue[d] = (dailyRevenue[d] || 0) + t.amountPaid
    }
    for (const l of logs) {
      const d = l.date
      dailyCheckIns[d] = (dailyCheckIns[d] || 0) + 1
    }

    // Active subscriptions at end of month
    const activeSubsCount = await prisma.subscription.count({
      where: { isActive: true, expiryDate: { gte: endDate } },
    })

    // New students this month
    const newStudents = await prisma.student.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    })

    // Staff shifts this month
    const shifts = await prisma.staffShift.findMany({
      where: { date: { gte: startDate.toISOString().slice(0, 10), lte: endDate.toISOString().slice(0, 10) } },
    })
    const staffHours: Record<string, number> = {}
    for (const s of shifts) {
      if (s.clockOut) {
        const hours = (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / (1000 * 60 * 60)
        staffHours[s.email] = (staffHours[s.email] || 0) + hours
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
      revenueByGateway,
      revenueByPlan,
      dailyRevenue,
      dailyCheckIns,
      staffHours,
    })
  } catch (e) {
    console.error('[GET /api/reports]', e)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
