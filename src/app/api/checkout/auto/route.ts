import { requireAuth } from '@/lib/authGuard'
import { autoCheckoutAll } from '@/lib/autoCheckout'

export async function POST() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const count = await autoCheckoutAll(session.userId as number)
    return Response.json({ count, message: `Checked out ${count} student(s)` })
  } catch (e) {
    console.error('[POST /api/checkout/auto]', e)
    return Response.json({ error: 'Auto-checkout failed' }, { status: 500 })
  }
}
