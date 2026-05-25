import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { computeExpiryDate, PLAN_DEFAULTS, PlanType } from '@/lib/subscriptionLogic'
import { isValidId } from '@/lib/sanitize'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { studentId, planType, gateway, amountPaid, customStartDate } = body

    if (!studentId || !isValidId(studentId)) return Response.json({ error: 'Valid student ID required' }, { status: 400 })
    if (!planType || !gateway || amountPaid === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const plan = planType as PlanType
    const defaults = PLAN_DEFAULTS[plan]
    if (!defaults) return Response.json({ error: 'Invalid plan type' }, { status: 400 })

    // Validate gateway
    const allowedGateways = ['Cash', 'CliQ', 'Card']
    if (!allowedGateways.includes(gateway)) {
      return Response.json({ error: 'Invalid payment gateway' }, { status: 400 })
    }

    // Validate amount
    const amount = Number(amountPaid)
    if (isNaN(amount) || amount < 0 || amount > 10000) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const startDate = customStartDate ? new Date(customStartDate) : new Date()
    if (isNaN(startDate.getTime())) return Response.json({ error: 'Invalid start date' }, { status: 400 })

    const expiryDate = computeExpiryDate(plan, startDate)
    const discountAmount = Math.max(0, defaults.price - amount)

    // Fetch student name for denormalized log fields
    const student = await prisma.student.findUnique({ where: { id: Number(studentId) }, select: { fullName: true } })
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 })

    const [, subscription, transaction] = await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { studentId: Number(studentId), isActive: true },
        data: { isActive: false },
      }),
      prisma.subscription.create({
        data: {
          studentId: Number(studentId),
          studentName: student.fullName,
          planType: plan,
          startDate,
          expiryDate,
          totalVisitsAllowed: defaults.totalVisitsAllowed,
          visitsUsed: 0,
          isActive: true,
        },
      }),
      prisma.transaction.create({
        data: {
          studentId: Number(studentId),
          studentName: student.fullName,
          amountPaid: amount,
          planType: plan,
          gateway,
          discountAmount,
        },
      }),
    ])

    return Response.json({ subscription, transaction }, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/subscriptions]', e)
    if (e?.code === 'P2003') return Response.json({ error: 'Student not found' }, { status: 404 })
    return Response.json({ error: 'Failed to issue subscription' }, { status: 500 })
  }
}
