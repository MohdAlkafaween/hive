import { requireAuth } from '@/lib/authGuard'
import { autoExpireSubscriptions } from '@/lib/autoExpire'

// POST — auto-expire subscriptions past their expiry date
export async function POST() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const count = await autoExpireSubscriptions()
    return Response.json({ expired: count })
  } catch (e) {
    console.error('[POST /api/subscriptions/expire]', e)
    return Response.json({ error: 'Failed to expire subscriptions' }, { status: 500 })
  }
}
