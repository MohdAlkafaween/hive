import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isSubscriptionActive, todayString } from '@/lib/subscriptionLogic'
import { isValidId, sanitizeRfid } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getCapacityInfo } from '@/lib/capacity'

// Check-in is public (kiosk mode) but rate-limited
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30 check-ins per minute per IP (generous for kiosk, blocks abuse)
    const ip = getClientIp(req)
    const limit = checkRateLimit(`checkin:${ip}`, 30, 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

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

    // Check if they had a previous check-in today (checked out already) — don't deduct visit again
    const anyLogToday = await prisma.log.findFirst({
      where: { studentId: student.id, date: today },
    })
    const shouldDeductVisit = !anyLogToday

    const log = await prisma.log.create({
      data: { studentId: student.id, studentName: student.fullName, date: today },
    })

    let updatedSub = sub
    if (shouldDeductVisit && sub.planType !== 'Daily') {
      const newVisitsUsed = sub.visitsUsed + 1
      const exhausted = newVisitsUsed >= sub.totalVisitsAllowed
      updatedSub = await prisma.subscription.update({
        where: { id: sub.id },
        data: { visitsUsed: newVisitsUsed, ...(exhausted && { isActive: false }) },
      })
    }

    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: { lifetimeCheckIns: { increment: 1 } },
    })

    const remainingVisits =
      sub.planType === 'Daily'
        ? null
        : updatedSub.totalVisitsAllowed - updatedSub.visitsUsed

    return Response.json({
      status: 'OK',
      student: updatedStudent,
      subscription: updatedSub,
      remainingVisits,
      logId: log.id,
      alreadyCheckedInToday: !shouldDeductVisit,
    })
  } catch (e) {
    console.error('[POST /api/checkin]', e)
    return Response.json({ error: 'Check-in failed' }, { status: 500 })
  }
}
