import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// DELETE a single barista order
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid order ID' }, { status: 400 })

    await prisma.baristaOrder.delete({ where: { id: Number(id) } })
    return Response.json({ ok: true })
  } catch (e: any) {
    console.error('[DELETE /api/barista/orders/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Order not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
