import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isSubscriptionActive, todayString } from '@/lib/subscriptionLogic'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitizeString } from '@/lib/sanitize'

// POST — check-in via QR token (public, rate-limited like kiosk)
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`checkin-qr:${ip}`, 30, 60 * 1000)
    if (limit.limited) return Response.json({ error: 'Too many requests' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const token = sanitizeString(body.token)
    if (!token) return Response.json({ status: 'NOT_FOUND', reason: 'Invalid QR code.' }, { status: 400 })

    const student = await prisma.student.findUnique({
      where: { qrToken: token },
      include: { subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!student) return Response.json({ status: 'NOT_FOUND', reason: 'Student not found.' }, { status: 404 })

    // Block SUSPENDED/BANNED students
    if (student.status === 'SUSPENDED' || student.status === 'BANNED') {
      return Response.json({
        status: student.status,
        reason: student.status === 'SUSPENDED' ? 'Account suspended. Please see the front desk.' : 'Access denied. Please see the front desk.',
        student,
      }, { status: 403 })
    }

    const sub = student.subscriptions[0] ?? null
    if (!sub) return Response.json({ status: 'EXPIRED', reason: 'No active subscription.', student })

    if (sub.isFrozen) return Response.json({ status: 'EXPIRED', reason: 'Subscription is frozen.', student })

    const check = isSubscriptionActive(sub)
    if (!check.active) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      return Response.json({ status: 'EXPIRED', reason: check.reason, student })
    }

    const today = todayString()
    const existingLog = await prisma.log.findFirst({
      where: { studentId: student.id, date: today, checkOutTime: null },
    })

    if (existingLog) {
      return Response.json({
        status: 'ALREADY_IN', student, subscription: sub,
        remainingVisits: sub.planType === 'Daily' ? null : sub.totalVisitsAllowed - sub.visitsUsed,
        logId: existingLog.id, alreadyCheckedInToday: true,
      })
    }

    // Wrap in transaction to prevent race conditions from concurrent QR scans
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction
      const existingInTx = await tx.log.findFirst({
        where: { studentId: student.id, date: today, checkOutTime: null },
      })
      if (existingInTx) return { duplicate: true, logId: existingInTx.id }

      const anyLogToday = await tx.log.findFirst({ where: { studentId: student.id, date: today } })
      const shouldDeductVisit = !anyLogToday

      const log = await tx.log.create({
        data: { studentId: student.id, studentName: student.fullName, date: today, method: 'QR' },
      })

      let txSub = sub
      if (shouldDeductVisit && sub.planType !== 'Daily') {
        txSub = await tx.subscription.update({
          where: { id: sub.id },
          data: { visitsUsed: { increment: 1 } },
        })
        if (txSub.visitsUsed >= txSub.totalVisitsAllowed) {
          txSub = await tx.subscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          })
        }
      }

      await tx.student.update({ where: { id: student.id }, data: { lifetimeCheckIns: { increment: 1 } } })

      return { duplicate: false, logId: log.id, updatedSub: txSub, shouldDeductVisit }
    })

    if (result.duplicate) {
      return Response.json({
        status: 'ALREADY_IN', student, subscription: sub,
        remainingVisits: sub.planType === 'Daily' ? null : sub.totalVisitsAllowed - sub.visitsUsed,
        logId: result.logId, alreadyCheckedInToday: true,
      })
    }

    const { updatedSub, shouldDeductVisit } = result as { updatedSub: typeof sub; shouldDeductVisit: boolean; logId: number; duplicate: false }

    return Response.json({
      status: 'OK', student, subscription: updatedSub,
      remainingVisits: sub.planType === 'Daily' ? null : updatedSub.totalVisitsAllowed - updatedSub.visitsUsed,
      logId: result.logId, alreadyCheckedInToday: !shouldDeductVisit,
    })
  } catch (e) {
    console.error('[POST /api/checkin/qr]', e)
    return Response.json({ error: 'QR check-in failed' }, { status: 500 })
  }
}
