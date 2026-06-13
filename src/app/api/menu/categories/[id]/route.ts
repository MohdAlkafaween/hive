import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const data: Record<string, unknown> = { updatedAt: new Date() }
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 100)
    if (typeof body.nameAr === 'string') data.nameAr = body.nameAr.trim().slice(0, 100) || null
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive

    const cat = await prisma.menuCategory.update({ where: { id: Number(id) }, data })
    return Response.json(cat)
  } catch {
    return Response.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    // Move items to uncategorized before deleting
    await prisma.menuItem.updateMany({ where: { categoryId: Number(id) }, data: { categoryId: null } })
    await prisma.menuCategory.delete({ where: { id: Number(id) } })

    return Response.json({ message: 'Category deleted' })
  } catch {
    return Response.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
