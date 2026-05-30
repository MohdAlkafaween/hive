import { requireAuth } from '@/lib/authGuard'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

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
