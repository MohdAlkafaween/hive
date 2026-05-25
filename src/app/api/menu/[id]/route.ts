import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// PATCH — toggle out of stock
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid menu item ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (body.isOutOfStock !== undefined) {
      if (typeof body.isOutOfStock !== 'boolean') return Response.json({ error: 'isOutOfStock must be boolean' }, { status: 400 })
      data.isOutOfStock = body.isOutOfStock
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const item = await prisma.menuItem.update({
      where: { id: Number(id) },
      data,
    })
    return Response.json(item)
  } catch (e: any) {
    console.error('[PATCH /api/menu/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Menu item not found' }, { status: 404 })
    return Response.json({ error: 'Failed to update menu item' }, { status: 500 })
  }
}

// DELETE a menu item (cascades orders)
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid menu item ID' }, { status: 400 })

    const numId = Number(id)

    // Delete related orders first
    await prisma.baristaOrder.deleteMany({ where: { menuItemId: numId } })
    await prisma.menuItem.delete({ where: { id: numId } })

    return Response.json({ ok: true })
  } catch (e: any) {
    console.error('[DELETE /api/menu/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Menu item not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete menu item' }, { status: 500 })
  }
}
