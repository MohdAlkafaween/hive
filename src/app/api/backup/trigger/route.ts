import { requireAuth } from '@/lib/authGuard'
import { runScheduledBackup } from '@/lib/backupScheduler'

export async function POST() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const result = await runScheduledBackup('MANUAL' as any)
    return Response.json(result)
  } catch (e) {
    console.error('[POST /api/backup/trigger]', e)
    return Response.json({ error: 'Backup trigger failed' }, { status: 500 })
  }
}
