import { requireAuth } from '@/lib/authGuard'
import { autoExpireSubscriptions } from '@/lib/autoExpire'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// POST — auto-expire subscriptions past their expiry date
export async function POST() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const count = await autoExpireSubscriptions()
    return Response.json({ expired: count })
  } catch (e) {
    console.error('[POST /api/subscriptions/expire]', e)
    return Response.json({ error: 'Failed to expire subscriptions' }, { status: 500 })
  }
}
