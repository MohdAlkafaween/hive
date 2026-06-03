import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { computeExpiryDate, PLAN_DEFAULTS, PlanType } from '@/lib/subscriptionLogic'
import { isValidId } from '@/lib/sanitize'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { studentId, planType, gateway, amountPaid, customStartDate, planId } = body

    if (!studentId || !isValidId(studentId)) return Response.json({ error: 'Valid student ID required' }, { status: 400 })
    if (!planType || !gateway || amountPaid === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // If planId provided, look up the plan from DB — otherwise use PLAN_DEFAULTS
    let plan = planType as PlanType
    let defaults = PLAN_DEFAULTS[plan]
    let resolvedPlanId: number | null = null

    if (planId) {
      const dbPlan = await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } })
      if (dbPlan) {
        resolvedPlanId = dbPlan.id
        plan = dbPlan.name as PlanType
        defaults = {
          price: dbPlan.price,
          totalVisitsAllowed: dbPlan.totalVisits === -1 ? 999 : dbPlan.totalVisits,
          durationDays: dbPlan.durationDays,
        }
      }
    }

    if (!defaults) return Response.json({ error: 'Invalid plan type' }, { status: 400 })

    // Validate gateway — aligned with frontend RenewModal GATEWAYS array
    const allowedGateways = ['Cash', 'CliQ', 'eFAWATEERcom', 'Credit Card', 'Card']
    if (!allowedGateways.includes(gateway)) {
      return Response.json({ error: 'Invalid payment gateway' }, { status: 400 })
    }

    // Validate amount and round to prevent floating point accumulation errors
    const rawAmount = Number(amountPaid)
    if (isNaN(rawAmount) || rawAmount < 0 || rawAmount > 10000) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 })
    }
    const amount = Math.round(rawAmount * 100) / 100

    const startDate = customStartDate ? new Date(customStartDate) : new Date()
    if (isNaN(startDate.getTime())) return Response.json({ error: 'Invalid start date' }, { status: 400 })

    // Compute expiry: use DB plan's durationDays if available, else use planType defaults
    let expiryDate: Date
    if (resolvedPlanId && defaults) {
      expiryDate = new Date(startDate)
      expiryDate.setDate(expiryDate.getDate() + defaults.durationDays)
      expiryDate.setHours(23, 59, 59, 999)
    } else {
      expiryDate = computeExpiryDate(plan, startDate)
    }
    const discountAmount = Math.round(Math.max(0, defaults.price - amount) * 100) / 100

    // Fetch student name for denormalized log fields
    const student = await prisma.student.findUnique({ where: { id: Number(studentId) }, select: { fullName: true } })
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 })

    // Use interactive transaction for atomic receipt number generation
    const result = await prisma.$transaction(async (tx) => {
      // Deactivate existing subscriptions and clear windowStart (F11)
      await tx.subscription.updateMany({
        where: { studentId: Number(studentId), isActive: true },
        data: { isActive: false, windowStart: null },
      })

      // Generate receipt number atomically
      const receiptSetting = await tx.appSetting.findUnique({ where: { key: 'nextReceiptNumber' } })
      const nextNum = receiptSetting ? parseInt(receiptSetting.value) : 1
      const receiptNumber = `RCP-${String(nextNum).padStart(5, '0')}`
      await tx.appSetting.upsert({
        where: { key: 'nextReceiptNumber' },
        create: { key: 'nextReceiptNumber', value: String(nextNum + 1) },
        update: { value: String(nextNum + 1) },
      })

      const subscription = await tx.subscription.create({
        data: {
          studentId: Number(studentId),
          studentName: student.fullName,
          planType: plan,
          startDate,
          expiryDate,
          totalVisitsAllowed: defaults.totalVisitsAllowed,
          visitsUsed: 0,
          isActive: true,
          createdBy: session.userId as number,
          planId: resolvedPlanId,
        },
      })

      const transaction = await tx.transaction.create({
        data: {
          studentId: Number(studentId),
          subscriptionId: subscription.id, // F15: FK link to subscription
          studentName: student.fullName,
          amountPaid: amount,
          planType: plan,
          gateway,
          discountAmount,
          receiptNumber,
        },
      })

      return { subscription, transaction, receiptNumber }
    })

    // F12: Check if student has an open log (active session under previous subscription)
    const openLog = await prisma.log.findFirst({
      where: { studentId: Number(studentId), checkOutTime: null },
    })

    return Response.json({
      ...result,
      activeSessionWarning: !!openLog,
      activeSessionMessage: openLog ? 'Student is currently checked in. Their session will continue until auto-checkout.' : undefined,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/subscriptions]', e)
    if (e?.code === 'P2003') return Response.json({ error: 'Student not found' }, { status: 404 })
    return Response.json({ error: 'Failed to issue subscription' }, { status: 500 })
  }
}
