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

    const anyLogToday = await prisma.log.findFirst({ where: { studentId: student.id, date: today } })
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

    await prisma.student.update({ where: { id: student.id }, data: { lifetimeCheckIns: { increment: 1 } } })

    return Response.json({
      status: 'OK', student, subscription: updatedSub,
      remainingVisits: sub.planType === 'Daily' ? null : updatedSub.totalVisitsAllowed - updatedSub.visitsUsed,
      logId: log.id, alreadyCheckedInToday: !shouldDeductVisit,
    })
  } catch (e) {
    console.error('[POST /api/checkin/qr]', e)
    return Response.json({ error: 'QR check-in failed' }, { status: 500 })
  }
}
