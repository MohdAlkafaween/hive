import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString, isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid plan ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = sanitizeString(body.name)
    if (body.nameAr !== undefined) data.nameAr = body.nameAr ? sanitizeString(body.nameAr) : null
    if (body.durationDays !== undefined) data.durationDays = Number(body.durationDays)
    if (body.totalVisits !== undefined) data.totalVisits = Number(body.totalVisits)
    if (body.price !== undefined) data.price = Number(body.price)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)

    const plan = await prisma.subscriptionPlan.update({
      where: { id: Number(id) },
      data,
    })

    return Response.json(plan)
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') return Response.json({ error: 'Plan not found' }, { status: 404 })
    console.error('[PATCH /api/plans/[id]]', e)
    return Response.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid plan ID' }, { status: 400 })

    await prisma.subscriptionPlan.delete({ where: { id: Number(id) } })
    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') return Response.json({ error: 'Plan not found' }, { status: 404 })
    console.error('[DELETE /api/plans/[id]]', e)
    return Response.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
