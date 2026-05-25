import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid subscription ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    // Whitelist allowed fields
    const data: Record<string, unknown> = {}
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return Response.json({ error: 'isActive must be boolean' }, { status: 400 })
      data.isActive = body.isActive
    }
    if (body.visitsUsed !== undefined) {
      const v = Number(body.visitsUsed)
      if (!Number.isInteger(v) || v < 0) return Response.json({ error: 'visitsUsed must be a non-negative integer' }, { status: 400 })
      data.visitsUsed = v
    }
    if (body.totalVisitsAllowed !== undefined) {
      const v = Number(body.totalVisitsAllowed)
      if (!Number.isInteger(v) || v < 0) return Response.json({ error: 'totalVisitsAllowed must be a non-negative integer' }, { status: 400 })
      data.totalVisitsAllowed = v
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const sub = await prisma.subscription.update({
      where: { id: Number(id) },
      data,
    })
    return Response.json(sub)
  } catch (e: any) {
    console.error('[PATCH /api/subscriptions/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Subscription not found' }, { status: 404 })
    return Response.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
