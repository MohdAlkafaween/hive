import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// POST — freeze or unfreeze a subscription
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Valid subscription ID required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const sub = await prisma.subscription.findUnique({ where: { id: Number(id) } })
    if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 })
    if (!sub.isActive) return Response.json({ error: 'Cannot freeze an inactive subscription' }, { status: 400 })

    if (body.action === 'freeze') {
      if (sub.isFrozen) return Response.json({ error: 'Already frozen' }, { status: 400 })

      // Enforce maximum cumulative freeze duration (configurable, default 30 days)
      const maxFreezeSetting = await prisma.appSetting.findUnique({ where: { key: 'maxFreezeDays' } })
      const maxFreezeDays = maxFreezeSetting ? parseInt(maxFreezeSetting.value) : 30
      if (sub.freezeDays >= maxFreezeDays) {
        return Response.json({ error: `Maximum freeze duration exceeded (${maxFreezeDays} days)` }, { status: 400 })
      }

      const updated = await prisma.subscription.update({
        where: { id: Number(id) },
        data: { isFrozen: true, frozenAt: new Date() },
      })
      return Response.json({ success: true, subscription: updated })

    } else if (body.action === 'unfreeze') {
      if (!sub.isFrozen || !sub.frozenAt) return Response.json({ error: 'Not frozen' }, { status: 400 })

      // Calculate days frozen and extend expiry
      const frozenDays = Math.ceil((Date.now() - new Date(sub.frozenAt).getTime()) / (1000 * 60 * 60 * 24))
      const newExpiry = new Date(sub.expiryDate)
      newExpiry.setDate(newExpiry.getDate() + frozenDays)

      const updated = await prisma.subscription.update({
        where: { id: Number(id) },
        data: {
          isFrozen: false,
          frozenAt: null,
          freezeDays: sub.freezeDays + frozenDays,
          expiryDate: newExpiry,
        },
      })
      return Response.json({ success: true, subscription: updated, daysAdded: frozenDays })

    } else {
      return Response.json({ error: 'action must be "freeze" or "unfreeze"' }, { status: 400 })
    }
  } catch (e) {
    console.error('[POST /api/subscriptions/[id]/freeze]', e)
    return Response.json({ error: 'Freeze operation failed' }, { status: 500 })
  }
}
