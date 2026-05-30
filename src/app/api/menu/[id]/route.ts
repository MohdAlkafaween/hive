import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// GET — single item with options
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF', 'MANAGER')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const item = await prisma.menuItem.findUnique({
      where: { id: Number(id) },
      include: {
        category: true,
        options: { orderBy: { sortOrder: 'asc' }, include: { values: { orderBy: { sortOrder: 'asc' } } } },
      },
    })
    if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(item)
  } catch {
    return Response.json({ error: 'Failed to load item' }, { status: 500 })
  }
}

// PATCH — update menu item fields
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid menu item ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (typeof body.isOutOfStock === 'boolean') data.isOutOfStock = body.isOutOfStock
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 100)
    if (typeof body.nameAr === 'string') data.nameAr = body.nameAr.trim().slice(0, 100) || null
    if (typeof body.price === 'number') data.price = body.price
    if (typeof body.costPrice === 'number') data.costPrice = body.costPrice
    if (body.categoryId !== undefined) data.categoryId = typeof body.categoryId === 'number' ? body.categoryId : null

    // Handle imageUrl updates (with SSRF protection matching POST handler)
    if (body.imageUrl !== undefined) {
      if (body.imageUrl === null || body.imageUrl === '') {
        data.imageUrl = null
      } else if (typeof body.imageUrl === 'string') {
        const url = body.imageUrl.trim()
        if (url.startsWith('/uploads/menu/')) {
          data.imageUrl = url.slice(0, 500)
        } else if (url.startsWith('https://')) {
          // Block internal IPs / metadata endpoints (SSRF protection)
          if (/^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0)/i.test(url)) {
            return Response.json({ error: 'Internal URLs are not allowed' }, { status: 400 })
          }
          data.imageUrl = url.slice(0, 500)
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const item = await prisma.menuItem.update({
      where: { id: Number(id) },
      data,
      include: { category: true, options: { include: { values: true } } },
    })
    return Response.json(item)
  } catch (e: unknown) {
    console.error('[PATCH /api/menu/[id]]', e)
    if ((e as { code?: string })?.code === 'P2025') return Response.json({ error: 'Menu item not found' }, { status: 404 })
    return Response.json({ error: 'Failed to update menu item' }, { status: 500 })
  }
}

// DELETE a menu item (soft-delete to preserve order history)
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid menu item ID' }, { status: 400 })

    // Soft-delete: mark as deleted but preserve for order history
    await prisma.menuItem.update({
      where: { id: Number(id) },
      data: { isDeleted: true, isOutOfStock: true },
    })

    return Response.json({ ok: true })
  } catch (e: unknown) {
    console.error('[DELETE /api/menu/[id]]', e)
    if ((e as { code?: string })?.code === 'P2025') return Response.json({ error: 'Menu item not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete menu item' }, { status: 500 })
  }
}
