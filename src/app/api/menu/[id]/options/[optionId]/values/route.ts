import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function GET(req: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF', 'MANAGER')
    if (session instanceof Response) return session

    const { optionId } = await params
    if (!isValidId(optionId)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const values = await prisma.menuItemOptionValue.findMany({
      where: { optionId: Number(optionId) },
      orderBy: { sortOrder: 'asc' },
    })
    return Response.json(values)
  } catch {
    return Response.json({ error: 'Failed to load values' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { optionId } = await params
    if (!isValidId(optionId)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body?.label?.trim()) return Response.json({ error: 'Label required' }, { status: 400 })

    const value = await prisma.menuItemOptionValue.create({
      data: {
        optionId: Number(optionId),
        label: body.label.trim().slice(0, 100),
        labelAr: body.labelAr?.trim()?.slice(0, 100) || null,
        price: typeof body.price === 'number' ? body.price : 0,
        costPrice: typeof body.costPrice === 'number' ? body.costPrice : 0,
        isDefault: body.isDefault === true,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      },
    })
    return Response.json(value, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to create value' }, { status: 500 })
  }
}
