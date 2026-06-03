import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isSubscriptionActive, todayString } from '@/lib/subscriptionLogic'
import { isValidId, sanitizeRfid } from '@/lib/sanitize'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getCapacityInfo } from '@/lib/capacity'
import { autoExpireSubscriptions } from '@/lib/autoExpire'
import { autoCheckoutExpired } from '@/lib/autoCheckout'
import { verifyAuth } from '@/lib/auth'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

// Check-in is public (kiosk mode) but rate-limited
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30 check-ins per minute per IP (generous for kiosk, blocks abuse)
    const ip = getClientIp(req)
    const limit = checkRateLimit(`checkin:${ip}`, 30, 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Auto-expire stale subscriptions and auto-checkout expired 24h sessions
    await autoExpireSubscriptions().catch(() => {})
    await autoCheckoutExpired().catch(() => {})

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
        subscriptions: {
          where: {
            OR: [
              // Active subscription (normal case)
              { isActive: true },
              // Deactivated but still has an active 24h window (student paid for this window)
              { windowStart: { not: null } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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

    // Check if this subscription has an active 24h window (even if subscription was deactivated by autoExpire)
    const now = new Date()
    const hasActiveWindow = sub.windowStart &&
      (now.getTime() - new Date(sub.windowStart).getTime()) < TWENTY_FOUR_HOURS_MS

    // If subscription is deactivated AND no active window, block
    if (!sub.isActive && !hasActiveWindow) {
      return Response.json({ status: 'EXPIRED', reason: 'Subscription has expired.', student })
    }

    // If subscription is active, validate it fully (date window, entries, etc.)
    // Skip this check if sub is inactive but has active window (already paid for this window)
    if (sub.isActive) {
      const check = isSubscriptionActive(sub)
      if (!check.active) {
        // Subscription failed validation, but check if there's still an active window
        if (!hasActiveWindow) {
          await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
          return Response.json({ status: 'EXPIRED', reason: check.reason, student })
        }
        // Has active window — deactivate sub but allow the window to finish
        await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      }
    }

    // Step 1: Is the student currently checked in (has open log)?
    // An open log means checkOutTime is null. autoCheckoutExpired already ran above,
    // so any log older than the window should be closed. But check broadly just in case.
    const existingActiveLog = await prisma.log.findFirst({
      where: {
        studentId: student.id,
        checkOutTime: null,
      },
    })

    if (existingActiveLog) {
      const remainingVisits = sub.totalVisitsAllowed === -1
        ? null
        : sub.totalVisitsAllowed - sub.visitsUsed

      return Response.json({
        status: 'ALREADY_IN',
        reason: 'Student is already checked in.',
        student,
        subscription: sub,
        remainingVisits,
        logId: existingActiveLog.id,
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

    const today = todayString()
    const method = rfidUuid ? 'RFID' : 'MANUAL'

    if (hasActiveWindow) {
      // WITHIN 24h window: create log, NO entry deduction, NO new window
      const result = await prisma.$transaction(async (tx) => {
        // Re-check for open log inside transaction
        const existingInTx = await tx.log.findFirst({
          where: { studentId: student.id, checkOutTime: null },
        })
        if (existingInTx) return { duplicate: true, logId: existingInTx.id }

        const log = await tx.log.create({
          data: { studentId: student.id, studentName: student.fullName, date: today, method, processedBy: staffUserId },
        })

        const txStudent = await tx.student.update({
          where: { id: student.id },
          data: { lifetimeCheckIns: { increment: 1 } },
        })

        return { duplicate: false, logId: log.id, updatedStudent: txStudent }
      })

      if (result.duplicate) {
        const remainingVisits = sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed
        return Response.json({
          status: 'ALREADY_IN', reason: 'Student is already checked in.',
          student, subscription: sub, remainingVisits, logId: result.logId, alreadyCheckedInToday: true,
        })
      }

      const remainingVisits = sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed
      const windowResult = result as { duplicate: false; logId: number; updatedStudent: typeof student }

      // F9: Audit log for check-in
      await prisma.staffAuditLog.create({
        data: {
          userId: staffUserId,
          email: staffUserId ? '' : 'kiosk',
          role: staffUserId ? '' : 'KIOSK',
          event: 'CHECKIN' as any,
          details: `Checked in student ${student.fullName} (ID: ${student.id}) via ${method} [window reuse]`,
        },
      }).catch(() => {})

      return Response.json({
        status: 'OK',
        student: windowResult.updatedStudent,
        subscription: sub,
        remainingVisits,
        logId: result.logId,
        windowReuse: true, // signal to frontend that no entry was consumed
      })
    }

    // OUTSIDE window (or no window): deduct 1 entry, start new 24h window
    // First check entries remaining (unless unlimited)
    if (sub.totalVisitsAllowed !== -1 && sub.visitsUsed >= sub.totalVisitsAllowed) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
      return Response.json({ status: 'EXPIRED', reason: 'All entries have been used.', student })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-check for open log inside transaction
      const existingInTx = await tx.log.findFirst({
        where: { studentId: student.id, checkOutTime: null },
      })
      if (existingInTx) return { duplicate: true, logId: existingInTx.id }

      const log = await tx.log.create({
        data: { studentId: student.id, studentName: student.fullName, date: today, method, processedBy: staffUserId },
      })

      // Deduct 1 entry and set windowStart (unless unlimited entries)
      let txSub = sub
      if (sub.totalVisitsAllowed !== -1) {
        txSub = await tx.subscription.update({
          where: { id: sub.id },
          data: {
            visitsUsed: { increment: 1 },
            windowStart: now,
          },
        })
        if (txSub.visitsUsed >= txSub.totalVisitsAllowed) {
          txSub = await tx.subscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          })
        }
      } else {
        // Unlimited entries: still set windowStart for auto-checkout tracking
        txSub = await tx.subscription.update({
          where: { id: sub.id },
          data: { windowStart: now },
        })
      }

      const txStudent = await tx.student.update({
        where: { id: student.id },
        data: { lifetimeCheckIns: { increment: 1 } },
      })

      return { duplicate: false, logId: log.id, updatedSub: txSub, updatedStudent: txStudent }
    })

    if (result.duplicate) {
      const remainingVisits = sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed
      return Response.json({
        status: 'ALREADY_IN', reason: 'Student is already checked in.',
        student, subscription: sub, remainingVisits, logId: result.logId, alreadyCheckedInToday: true,
      })
    }

    const { updatedSub, updatedStudent } = result as { updatedSub: typeof sub; updatedStudent: typeof student; logId: number; duplicate: false }
    const remainingVisits = updatedSub.totalVisitsAllowed === -1
      ? null
      : updatedSub.totalVisitsAllowed - updatedSub.visitsUsed

    // F9: Audit log for check-in (new window)
    await prisma.staffAuditLog.create({
      data: {
        userId: staffUserId,
        email: staffUserId ? '' : 'kiosk',
        role: staffUserId ? '' : 'KIOSK',
        event: 'CHECKIN' as any,
        details: `Checked in student ${student.fullName} (ID: ${student.id}) via ${method} [new window, entry deducted]`,
      },
    }).catch(() => {})

    return Response.json({
      status: 'OK',
      student: updatedStudent,
      subscription: updatedSub,
      remainingVisits,
      logId: result.logId,
    })
  } catch (e) {
    console.error('[POST /api/checkin]', e)
    return Response.json({ error: 'Check-in failed' }, { status: 500 })
  }
}
