import prisma from '@/lib/prisma'

// TIMEZONE: All date calculations depend on the server's system timezone.
// Ensure TZ=Asia/Amman (or your business timezone) is set in .env.
// See README.md for deployment details.

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Auto-checkout students whose 24-hour window has expired.
 *
 * Logic: find active subscriptions where windowStart + 24h <= now,
 * then close any open logs for those students.
 * Sets checkOutTime = windowStart + 24h (the exact window end, not "now").
 * Clears windowStart on the subscription after checkout.
 *
 * Also handles orphaned logs: any log with no checkOut and checkInTime > 24h ago
 * (safety net for students without a subscription or with cleared windowStart).
 *
 * F9: Writes StaffAuditLog entries for each auto-checked-out student.
 */
export async function autoCheckoutExpired(): Promise<{
  count: number
  expiredSubscriptions: { studentId: number; studentName: string }[]
}> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS)
  const expiredSubscriptions: { studentId: number; studentName: string }[] = []
  let totalCheckedOut = 0

  // 1. Window-based auto-checkout: subscriptions with expired windowStart
  const expiredWindowSubs = await prisma.subscription.findMany({
    where: {
      windowStart: { not: null, lt: cutoff },
    },
    include: {
      student: true,
    },
  })

  for (const sub of expiredWindowSubs) {
    if (!sub.studentId || !sub.student) continue

    const windowEnd = new Date(new Date(sub.windowStart!).getTime() + TWENTY_FOUR_HOURS_MS)

    // Close any open logs for this student
    const openLogs = await prisma.log.findMany({
      where: { studentId: sub.studentId, checkOutTime: null },
    })

    for (const log of openLogs) {
      await prisma.log.update({
        where: { id: log.id },
        data: { checkOutTime: windowEnd, method: 'AUTO_CHECKOUT' },
      })
      totalCheckedOut++
    }

    // Clear windowStart
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { windowStart: null },
    })

    // F9: Audit log for auto-checkout
    if (openLogs.length > 0) {
      await prisma.staffAuditLog.create({
        data: {
          email: 'system',
          role: 'SYSTEM',
          event: 'AUTO_CHECKOUT' as any,
          details: `Auto-checkout: student ${sub.student.fullName} (ID: ${sub.studentId}) — 24h window expired`,
        },
      }).catch(() => {})
    }

    // Check if subscription has zero entries remaining
    const remaining = sub.totalVisitsAllowed - sub.visitsUsed
    if (remaining <= 0 && sub.totalVisitsAllowed !== -1) {
      expiredSubscriptions.push({
        studentId: sub.studentId,
        studentName: sub.student.fullName,
      })
    }
  }

  // 2. Safety net: orphaned logs with no checkout and checkIn > 24h ago
  //    (for students with no active subscription or edge cases)
  const orphanedLogs = await prisma.log.findMany({
    where: {
      checkOutTime: null,
      checkInTime: { lt: cutoff },
    },
    include: { student: true },
  })

  for (const log of orphanedLogs) {
    const autoCheckoutTime = new Date(new Date(log.checkInTime).getTime() + TWENTY_FOUR_HOURS_MS)
    await prisma.log.update({
      where: { id: log.id },
      data: { checkOutTime: autoCheckoutTime, method: 'AUTO_CHECKOUT' },
    })
    totalCheckedOut++

    // F9: Audit log for orphaned auto-checkout
    if (log.student) {
      await prisma.staffAuditLog.create({
        data: {
          email: 'system',
          role: 'SYSTEM',
          event: 'AUTO_CHECKOUT' as any,
          details: `Auto-checkout (orphaned): student ${log.student.fullName} (ID: ${log.studentId}) — checkIn > 24h ago`,
        },
      }).catch(() => {})
    }
  }

  return { count: totalCheckedOut, expiredSubscriptions }
}

/**
 * Manual "Check Out All" button for staff.
 * Checks out all currently checked-in students immediately (sets checkOutTime = now).
 * Also clears windowStart on all active subscriptions.
 *
 * F4: Accepts staffUserId for audit logging.
 */
export async function autoCheckoutAll(staffUserId?: number): Promise<number> {
  const result = await prisma.log.updateMany({
    where: { checkOutTime: null },
    data: { checkOutTime: new Date() },
  })

  // Clear all windowStart values since we're force-checking everyone out
  await prisma.subscription.updateMany({
    where: { windowStart: { not: null } },
    data: { windowStart: null },
  })

  // F4: Audit log for bulk checkout
  if (result.count > 0) {
    await prisma.staffAuditLog.create({
      data: {
        userId: staffUserId ?? null,
        email: staffUserId ? '' : 'system',
        role: staffUserId ? '' : 'SYSTEM',
        event: 'BULK_CHECKOUT' as any,
        details: `Manual bulk checkout: ${result.count} student(s) checked out, all windows cleared`,
      },
    }).catch(() => {})
  }

  return result.count
}

/**
 * Get students approaching the 24-hour window expiry.
 * Uses windowStart from subscription (not log.checkInTime) so that
 * re-check-ins within a window still show the correct remaining time.
 * Returns students between 23h and 24h into their window who are currently checked in.
 */
export async function getExpiringCheckIns(): Promise<{
  id: number
  studentName: string
  studentId: number | null
  checkInTime: string
  minutesRemaining: number
}[]> {
  const now = Date.now()
  const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000)
  const twentyFourHoursAgo = new Date(now - TWENTY_FOUR_HOURS_MS)

  // Find subscriptions whose window is between 23h and 24h old
  const expiringSubs = await prisma.subscription.findMany({
    where: {
      windowStart: {
        gt: twentyFourHoursAgo,
        lt: twentyThreeHoursAgo,
      },
    },
    include: {
      student: {
        include: {
          logs: {
            where: { checkOutTime: null },
            take: 1,
            orderBy: { checkInTime: 'desc' },
          },
        },
      },
    },
  })

  const results: {
    id: number
    studentName: string
    studentId: number | null
    checkInTime: string
    minutesRemaining: number
  }[] = []

  for (const sub of expiringSubs) {
    if (!sub.student || !sub.windowStart) continue

    // Only include students who are currently checked in
    const activeLog = sub.student.logs[0]
    if (!activeLog) continue

    const windowStartMs = new Date(sub.windowStart).getTime()
    const expiresAt = windowStartMs + TWENTY_FOUR_HOURS_MS
    const minutesRemaining = Math.max(0, Math.floor((expiresAt - now) / 60000))

    results.push({
      id: activeLog.id,
      studentName: activeLog.studentName || sub.student.fullName,
      studentId: sub.studentId,
      checkInTime: sub.windowStart.toISOString(), // use windowStart as the reference time
      minutesRemaining,
    })
  }

  return results
}
