import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { valueId } = await params
    if (!isValidId(valueId)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (typeof body.label === 'string') data.label = body.label.trim().slice(0, 100)
    if (typeof body.labelAr === 'string') data.labelAr = body.labelAr.trim().slice(0, 100) || null
    if (typeof body.price === 'number') data.price = body.price
    if (typeof body.costPrice === 'number') data.costPrice = body.costPrice
    if (typeof body.isDefault === 'boolean') data.isDefault = body.isDefault
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder

    const val = await prisma.menuItemOptionValue.update({ where: { id: Number(valueId) }, data })
    return Response.json(val)
  } catch {
    return Response.json({ error: 'Failed to update value' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { valueId } = await params
    if (!isValidId(valueId)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    await prisma.menuItemOptionValue.delete({ where: { id: Number(valueId) } })
    return Response.json({ message: 'Value deleted' })
  } catch {
    return Response.json({ error: 'Failed to delete value' }, { status: 500 })
  }
}
