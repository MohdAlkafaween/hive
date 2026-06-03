import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isSubscriptionActive, todayString } from '@/lib/subscriptionLogic'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitizeString } from '@/lib/sanitize'
import { autoExpireSubscriptions } from '@/lib/autoExpire'
import { autoCheckoutExpired } from '@/lib/autoCheckout'
import { getCapacityInfo } from '@/lib/capacity'
import { verifyAuth } from '@/lib/auth'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

// POST — check-in via QR token (public, rate-limited like kiosk)
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit(`checkin-qr:${ip}`, 30, 60 * 1000)
    if (limit.limited) return Response.json({ error: 'Too many requests' }, { status: 429 })

    // Auto-expire stale subscriptions and auto-checkout expired 24h sessions (F2 fix)
    await autoExpireSubscriptions().catch(() => {})
    await autoCheckoutExpired().catch(() => {})

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const token = sanitizeString(body.token)
    if (!token) return Response.json({ status: 'NOT_FOUND', reason: 'Invalid QR code.' }, { status: 400 })

    const student = await prisma.student.findUnique({
      where: { qrToken: token },
      include: {
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

    // Check if this subscription has an active 24h window (even if deactivated by autoExpire)
    const now = new Date()
    const hasActiveWindow = sub.windowStart &&
      (now.getTime() - new Date(sub.windowStart).getTime()) < TWENTY_FOUR_HOURS_MS

    // If subscription is deactivated AND no active window, block
    if (!sub.isActive && !hasActiveWindow) {
      return Response.json({ status: 'EXPIRED', reason: 'Subscription has expired.', student })
    }

    // If subscription is active, validate fully; skip if inactive but has active window
    if (sub.isActive) {
      const check = isSubscriptionActive(sub)
      if (!check.active) {
        if (!hasActiveWindow) {
          await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
          return Response.json({ status: 'EXPIRED', reason: check.reason, student })
        }
        await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      }
    }

    // Step 1: Is the student currently checked in (has open log)?
    const existingActiveLog = await prisma.log.findFirst({
      where: { studentId: student.id, checkOutTime: null },
    })

    if (existingActiveLog) {
      return Response.json({
        status: 'ALREADY_IN',
        reason: 'Student is already checked in.',
        student, subscription: sub,
        remainingVisits: sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed,
        logId: existingActiveLog.id, alreadyCheckedInToday: true,
      })
    }

    // F1 fix: Check capacity limit (same as RFID route)
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

    // F3 fix: Detect staff session for processedBy attribution
    const session = await verifyAuth().catch(() => null)
    const staffUserId = session?.userId ? (session.userId as number) : null

    const today = todayString()

    if (hasActiveWindow) {
      // WITHIN 24h window: create log, NO entry deduction
      const result = await prisma.$transaction(async (tx) => {
        const existingInTx = await tx.log.findFirst({
          where: { studentId: student.id, checkOutTime: null },
        })
        if (existingInTx) return { duplicate: true, logId: existingInTx.id }

        const log = await tx.log.create({
          data: { studentId: student.id, studentName: student.fullName, date: today, method: 'QR', processedBy: staffUserId },
        })

        await tx.student.update({ where: { id: student.id }, data: { lifetimeCheckIns: { increment: 1 } } })

        return { duplicate: false, logId: log.id }
      })

      if (result.duplicate) {
        return Response.json({
          status: 'ALREADY_IN', student, subscription: sub,
          remainingVisits: sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed,
          logId: result.logId, alreadyCheckedInToday: true,
        })
      }

      // F9: Audit log for QR check-in (window reuse)
      await prisma.staffAuditLog.create({
        data: {
          userId: staffUserId,
          email: staffUserId ? '' : 'kiosk',
          role: staffUserId ? '' : 'KIOSK',
          event: 'CHECKIN' as any,
          details: `Checked in student ${student.fullName} (ID: ${student.id}) via QR [window reuse]`,
        },
      }).catch(() => {})

      return Response.json({
        status: 'OK', student, subscription: sub,
        remainingVisits: sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed,
        logId: result.logId, windowReuse: true,
      })
    }

    // OUTSIDE window: deduct 1 entry, start new 24h window
    if (sub.totalVisitsAllowed !== -1 && sub.visitsUsed >= sub.totalVisitsAllowed) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      return Response.json({ status: 'EXPIRED', reason: 'All entries have been used.', student })
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingInTx = await tx.log.findFirst({
        where: { studentId: student.id, checkOutTime: null },
      })
      if (existingInTx) return { duplicate: true, logId: existingInTx.id }

      const log = await tx.log.create({
        data: { studentId: student.id, studentName: student.fullName, date: today, method: 'QR', processedBy: staffUserId },
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
        // Unlimited: still set windowStart for auto-checkout
        txSub = await tx.subscription.update({
          where: { id: sub.id },
          data: { windowStart: now },
        })
      }

      await tx.student.update({ where: { id: student.id }, data: { lifetimeCheckIns: { increment: 1 } } })

      return { duplicate: false, logId: log.id, updatedSub: txSub }
    })

    if (result.duplicate) {
      return Response.json({
        status: 'ALREADY_IN', student, subscription: sub,
        remainingVisits: sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed,
        logId: result.logId, alreadyCheckedInToday: true,
      })
    }

    const { updatedSub } = result as { updatedSub: typeof sub; logId: number; duplicate: false }

    // F9: Audit log for QR check-in (new window)
    await prisma.staffAuditLog.create({
      data: {
        userId: staffUserId,
        email: staffUserId ? '' : 'kiosk',
        role: staffUserId ? '' : 'KIOSK',
        event: 'CHECKIN' as any,
        details: `Checked in student ${student.fullName} (ID: ${student.id}) via QR [new window, entry deducted]`,
      },
    }).catch(() => {})

    return Response.json({
      status: 'OK', student, subscription: updatedSub,
      remainingVisits: updatedSub.totalVisitsAllowed === -1 ? null : updatedSub.totalVisitsAllowed - updatedSub.visitsUsed,
      logId: result.logId,
    })
  } catch (e) {
    console.error('[POST /api/checkin/qr]', e)
    return Response.json({ error: 'QR check-in failed' }, { status: 500 })
  }
}
