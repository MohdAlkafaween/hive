import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isSubscriptionActive, todayString } from '@/lib/subscriptionLogic'
import { isValidId, sanitizeRfid } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getCapacityInfo } from '@/lib/capacity'
import { autoExpireSubscriptions } from '@/lib/autoExpire'
import { verifyAuth } from '@/lib/auth'

// Check-in is public (kiosk mode) but rate-limited
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30 check-ins per minute per IP (generous for kiosk, blocks abuse)
    const ip = getClientIp(req)
    const limit = checkRateLimit(`checkin:${ip}`, 30, 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Auto-expire stale subscriptions before processing
    await autoExpireSubscriptions().catch(() => {})

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { studentId, rfidUuid } = body

    if (!studentId && !rfidUuid) {
      return Response.json({ error: 'studentId or rfidUuid required' }, { status: 400 })
    }

    if (studentId && !isValidId(studentId)) {
      return Response.json({ error: 'Invalid student ID' }, { status: 400 })
    }

    const cleanRfid = rfidUuid ? sanitizeRfid(rfidUuid) : null

    const student = await prisma.student.findUnique({
      where: studentId ? { id: Number(studentId) } : { rfidUuid: cleanRfid! },
      include: {
        subscriptions: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!student) {
      return Response.json({ status: 'NOT_FOUND', reason: 'Student not found.' }, { status: 404 })
    }

    // Block SUSPENDED/BANNED students
    if (student.status === 'SUSPENDED' || student.status === 'BANNED') {
      return Response.json({
        status: student.status,
        reason: student.status === 'SUSPENDED' ? 'Account suspended. Please see the front desk.' : 'Access denied. Please see the front desk.',
        student,
      }, { status: 403 })
    }

    const sub = student.subscriptions[0] ?? null
    if (!sub) {
      return Response.json({ status: 'EXPIRED', reason: 'No active subscription found.', student })
    }

    if (sub.isFrozen) {
      return Response.json({ status: 'EXPIRED', reason: 'Subscription is frozen.', student })
    }

    const check = isSubscriptionActive(sub)
    if (!check.active) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      return Response.json({ status: 'EXPIRED', reason: check.reason, student })
    }

    const today = todayString()
    // Check if already checked in today and still inside (no checkout)
    const existingLogToday = await prisma.log.findFirst({
      where: { studentId: student.id, date: today, checkOutTime: null },
    })

    // If already checked in and not checked out, don't create a duplicate — just return existing
    if (existingLogToday) {
      const remainingVisits =
        sub.planType === 'Daily'
          ? null
          : sub.totalVisitsAllowed - sub.visitsUsed

      return Response.json({
        status: 'ALREADY_IN',
        student,
        subscription: sub,
        remainingVisits,
        logId: existingLogToday.id,
        alreadyCheckedInToday: true,
      })
    }

    // Check capacity limit
    const capacity = await getCapacityInfo()
    if (capacity.isFull) {
      return Response.json({
        status: 'FULL',
        reason: `Venue is at full capacity (${capacity.maxCapacity}). Please try again later.`,
        student,
        currentOccupancy: capacity.currentOccupancy,
        maxCapacity: capacity.maxCapacity,
      })
    }

    // Optionally detect staff session for processedBy attribution
    const session = await verifyAuth().catch(() => null)
    const staffUserId = session?.userId ? (session.userId as number) : null

    // Wrap log creation + visit deduction in a transaction to prevent race conditions
    // from concurrent RFID scans creating duplicate check-ins
    const result = await prisma.$transaction(async (tx) => {
      // Re-check for existing log inside transaction for atomicity
      const existingInTx = await tx.log.findFirst({
        where: { studentId: student.id, date: today, checkOutTime: null },
      })
      if (existingInTx) return { duplicate: true, logId: existingInTx.id }

      // Check if they had a previous check-in today (checked out already) — don't deduct visit again
      const anyLogToday = await tx.log.findFirst({
        where: { studentId: student.id, date: today },
      })
      const shouldDeductVisit = !anyLogToday

      const method = rfidUuid ? 'RFID' : 'MANUAL'
      const log = await tx.log.create({
        data: { studentId: student.id, studentName: student.fullName, date: today, method, processedBy: staffUserId },
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

      const txStudent = await tx.student.update({
        where: { id: student.id },
        data: { lifetimeCheckIns: { increment: 1 } },
      })

      return { duplicate: false, logId: log.id, updatedSub: txSub, updatedStudent: txStudent, shouldDeductVisit }
    })

    // Handle duplicate detected inside transaction
    if (result.duplicate) {
      const remainingVisits =
        sub.planType === 'Daily'
          ? null
          : sub.totalVisitsAllowed - sub.visitsUsed
      return Response.json({
        status: 'ALREADY_IN',
        student,
        subscription: sub,
        remainingVisits,
        logId: result.logId,
        alreadyCheckedInToday: true,
      })
    }

    const { updatedSub, updatedStudent } = result as { updatedSub: typeof sub; updatedStudent: typeof student; logId: number; shouldDeductVisit: boolean; duplicate: false }

    const remainingVisits =
      sub.planType === 'Daily'
        ? null
        : updatedSub.totalVisitsAllowed - updatedSub.visitsUsed

    return Response.json({
      status: 'OK',
      student: updatedStudent,
      subscription: updatedSub,
      remainingVisits,
      logId: result.logId,
      alreadyCheckedInToday: !(result as { shouldDeductVisit: boolean }).shouldDeductVisit,
    })
  } catch (e) {
    console.error('[POST /api/checkin]', e)
    return Response.json({ error: 'Check-in failed' }, { status: 500 })
  }
}
