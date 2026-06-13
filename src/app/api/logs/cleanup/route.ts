import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { todayString } from '@/lib/subscriptionLogic'
import { getClientIp , checkStaffRateLimit } from '@/lib/rateLimit'
import { NextRequest } from 'next/server'

// POST — auto-cleanup: delete all checked-out logs from previous days
// Called at midnight from the frontend, or manually by admin
// Supports ?dryRun=true to preview what would be deleted
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'
    const today = todayString()

    // Count before delete for audit trail
    const count = await prisma.log.count({
      where: {
        date: { not: today },
        checkOutTime: { not: null },
      },
    })

    if (dryRun) {
      return Response.json({ dryRun: true, wouldDelete: count })
    }

    const result = await prisma.log.deleteMany({
      where: {
        date: { not: today },
        checkOutTime: { not: null },
      },
    })

    // Audit trail
    const ip = getClientIp(req)
    await prisma.staffAuditLog.create({
      data: {
        userId: session.userId as number,
        email: session.email as string,
        role: session.role as string,
        event: 'LOGS_CLEANUP',
        ip,
        details: `Deleted ${result.count} checked-out logs from previous days`,
      },
    })

    return Response.json({ deleted: result.count })
  } catch (e) {
    console.error('[POST /api/logs/cleanup]', e)
    return Response.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
