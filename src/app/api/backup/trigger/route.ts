import { requireAuth } from '@/lib/authGuard'
import { runScheduledBackup } from '@/lib/backupScheduler'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function POST() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const result = await runScheduledBackup('MANUAL')
    return Response.json(result)
  } catch (e) {
    console.error('[POST /api/backup/trigger]', e)
    return Response.json({ error: 'Backup trigger failed' }, { status: 500 })
  }
}
