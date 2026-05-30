import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { optionId } = await params
    if (!isValidId(optionId)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 100)
    if (typeof body.nameAr === 'string') data.nameAr = body.nameAr.trim().slice(0, 100) || null
    if (body.type === 'SET_PRICE' || body.type === 'ADD_TO_PRICE') data.type = body.type
    if (typeof body.required === 'boolean') data.required = body.required
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder

    const option = await prisma.menuItemOption.update({
      where: { id: Number(optionId) },
      data,
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    })
    return Response.json(option)
  } catch {
    return Response.json({ error: 'Failed to update option' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { optionId } = await params
    if (!isValidId(optionId)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    await prisma.menuItemOption.delete({ where: { id: Number(optionId) } })
    return Response.json({ message: 'Option deleted' })
  } catch {
    return Response.json({ error: 'Failed to delete option' }, { status: 500 })
  }
}
