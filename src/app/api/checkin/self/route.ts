import prisma from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customerAuth'
import { isSubscriptionActive, todayString } from '@/lib/subscriptionLogic'
import { checkRateLimit } from '@/lib/rateLimit'
import { getCapacityInfo } from '@/lib/capacity'
import { autoExpireSubscriptions } from '@/lib/autoExpire'
import { autoCheckoutExpired } from '@/lib/autoCheckout'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export async function POST() {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  // Rate limit: 10 self-check-ins per customer per hour
  const limit = checkRateLimit(`self-checkin:${student.id}`, 10, 60 * 60 * 1000)
  if (limit.limited) {
    return Response.json({ error: 'Too many check-in attempts. Try again later.' }, { status: 429 })
  }

  try {
    // Auto-maintenance
    await autoExpireSubscriptions().catch(() => {})
    await autoCheckoutExpired().catch(() => {})

    // Fetch student with subscription — select only what the check-in logic needs
    const fullStudent = await prisma.student.findUnique({
      where: { id: student.id },
      select: {
        id: true,
        fullName: true,
        status: true,
        subscriptions: {
          where: {
            OR: [
              { isActive: true },
              { windowStart: { not: null } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!fullStudent) {
      return Response.json({ status: 'NOT_FOUND', reason: 'Student not found.' }, { status: 404 })
    }

    if (fullStudent.status === 'SUSPENDED' || fullStudent.status === 'BANNED') {
      return Response.json({
        status: fullStudent.status,
        reason: fullStudent.status === 'SUSPENDED' ? 'Account suspended.' : 'Access denied.',
      }, { status: 403 })
    }

    const sub = fullStudent.subscriptions[0] ?? null
    if (!sub) {
      return Response.json({ status: 'EXPIRED', reason: 'No active subscription found.' })
    }

    if (sub.isFrozen) {
      return Response.json({ status: 'EXPIRED', reason: 'Subscription is frozen.' })
    }

    const now = new Date()
    const hasActiveWindow = sub.windowStart &&
      (now.getTime() - new Date(sub.windowStart).getTime()) < TWENTY_FOUR_HOURS_MS

    if (!sub.isActive && !hasActiveWindow) {
      return Response.json({ status: 'EXPIRED', reason: 'Subscription has expired.' })
    }

    if (sub.isActive) {
      const check = isSubscriptionActive(sub)
      if (!check.active && !hasActiveWindow) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
        return Response.json({ status: 'EXPIRED', reason: check.reason })
      }
      if (!check.active) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      }
    }

    // Check if already checked in
    const existingLog = await prisma.log.findFirst({
      where: { studentId: fullStudent.id, checkOutTime: null },
    })

    if (existingLog) {
      const remainingVisits = sub.totalVisitsAllowed === -1
        ? null : sub.totalVisitsAllowed - sub.visitsUsed
      return Response.json({
        status: 'ALREADY_IN',
        reason: 'You are already checked in.',
        subscription: sub,
        remainingVisits,
      })
    }

    // Check capacity
    const capacity = await getCapacityInfo()
    if (capacity.isFull) {
      return Response.json({
        status: 'FULL',
        reason: `Venue is at full capacity (${capacity.maxCapacity}).`,
      })
    }

    const today = todayString()

    if (hasActiveWindow) {
      // Within window: no entry deduction
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.log.findFirst({
          where: { studentId: fullStudent.id, checkOutTime: null },
        })
        if (existing) return { duplicate: true }

        await tx.log.create({
          data: { studentId: fullStudent.id, studentName: fullStudent.fullName, date: today, method: 'SELF' },
        })
        await tx.student.update({
          where: { id: fullStudent.id },
          data: { lifetimeCheckIns: { increment: 1 } },
        })
        return { duplicate: false }
      })

      if (result.duplicate) {
        return Response.json({ status: 'ALREADY_IN', reason: 'You are already checked in.' })
      }

      const remainingVisits = sub.totalVisitsAllowed === -1
        ? null : sub.totalVisitsAllowed - sub.visitsUsed
      return Response.json({
        status: 'OK',
        subscription: sub,
        remainingVisits,
        windowReuse: true,
      })
    }

    // Outside window: deduct entry, start new window
    if (sub.totalVisitsAllowed !== -1 && sub.visitsUsed >= sub.totalVisitsAllowed) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      return Response.json({ status: 'EXPIRED', reason: 'All entries have been used.' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.log.findFirst({
        where: { studentId: fullStudent.id, checkOutTime: null },
      })
      if (existing) return { duplicate: true, updatedSub: sub }

      await tx.log.create({
        data: { studentId: fullStudent.id, studentName: fullStudent.fullName, date: today, method: 'SELF' },
      })

      let txSub = sub
      if (sub.totalVisitsAllowed !== -1) {
        txSub = await tx.subscription.update({
          where: { id: sub.id },
          data: { visitsUsed: { increment: 1 }, windowStart: now },
        })
        if (txSub.visitsUsed >= txSub.totalVisitsAllowed) {
          txSub = await tx.subscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          })
        }
      } else {
        txSub = await tx.subscription.update({
          where: { id: sub.id },
          data: { windowStart: now },
        })
      }

      await tx.student.update({
        where: { id: fullStudent.id },
        data: { lifetimeCheckIns: { increment: 1 } },
      })

      return { duplicate: false, updatedSub: txSub }
    })

    if (result.duplicate) {
      return Response.json({ status: 'ALREADY_IN', reason: 'You are already checked in.' })
    }

    const remainingVisits = result.updatedSub.totalVisitsAllowed === -1
      ? null : result.updatedSub.totalVisitsAllowed - result.updatedSub.visitsUsed

    return Response.json({
      status: 'OK',
      subscription: result.updatedSub,
      remainingVisits,
    })
  } catch (e) {
    console.error('[POST /api/checkin/self]', e)
    return Response.json({ error: 'Check-in failed' }, { status: 500 })
  }
}
