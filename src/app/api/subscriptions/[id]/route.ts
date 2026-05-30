import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid subscription ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const role = session.role as string

    // Track changes for audit log
    const existingSub = await prisma.subscription.findUnique({ where: { id: Number(id) } })
    if (!existingSub) return Response.json({ error: 'Subscription not found' }, { status: 404 })

    // Whitelist allowed fields
    const data: Record<string, unknown> = {}
    const changes: string[] = []

    if (body.isActive !== undefined) {
      // Only ADMIN can change isActive status (prevents staff from reactivating expired subscriptions)
      if (role !== 'ADMIN') {
        return Response.json({ error: 'Only administrators can change subscription active status' }, { status: 403 })
      }
      if (typeof body.isActive !== 'boolean') return Response.json({ error: 'isActive must be boolean' }, { status: 400 })
      data.isActive = body.isActive
      changes.push(`isActive: ${existingSub.isActive} -> ${body.isActive}`)
    }
    if (body.visitsUsed !== undefined) {
      const v = Number(body.visitsUsed)
      if (!Number.isInteger(v) || v < 0) return Response.json({ error: 'visitsUsed must be a non-negative integer' }, { status: 400 })
      data.visitsUsed = v
      changes.push(`visitsUsed: ${existingSub.visitsUsed} -> ${v}`)
    }
    if (body.totalVisitsAllowed !== undefined) {
      const v = Number(body.totalVisitsAllowed)
      if (!Number.isInteger(v) || v < 0) return Response.json({ error: 'totalVisitsAllowed must be a non-negative integer' }, { status: 400 })
      data.totalVisitsAllowed = v
      changes.push(`totalVisitsAllowed: ${existingSub.totalVisitsAllowed} -> ${v}`)
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const sub = await prisma.subscription.update({
      where: { id: Number(id) },
      data,
    })

    // Audit trail for subscription modifications
    if (changes.length > 0) {
      await prisma.staffAuditLog.create({
        data: {
          userId: session.userId as number,
          email: session.email as string,
          role,
          event: 'SUBSCRIPTION_MODIFIED',
          details: `Subscription #${id} (student ${existingSub.studentId}): ${changes.join(', ')}`,
        },
      }).catch(() => {})
    }

    return Response.json(sub)
  } catch (e: any) {
    console.error('[PATCH /api/subscriptions/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Subscription not found' }, { status: 404 })
    return Response.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
