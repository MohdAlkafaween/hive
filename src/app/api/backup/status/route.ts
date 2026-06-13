import { requireAuth } from '@/lib/authGuard'
import prisma from '@/lib/prisma'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const logs = await prisma.backupLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    })

    const lastSuccess = logs.find(l => l.success)

    return Response.json({ logs, lastSuccess: lastSuccess ?? null })
  } catch (e) {
    console.error('[GET /api/backup/status]', e)
    return Response.json({ error: 'Failed to fetch backup status' }, { status: 500 })
  }
}
