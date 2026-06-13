import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const options = await prisma.menuItemOption.findMany({
      where: { menuItemId: Number(id) },
      orderBy: { sortOrder: 'asc' },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    })
    return Response.json(options)
  } catch {
    return Response.json({ error: 'Failed to load options' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body?.name?.trim()) return Response.json({ error: 'Option name required' }, { status: 400 })

    const option = await prisma.menuItemOption.create({
      data: {
        menuItemId: Number(id),
        name: body.name.trim().slice(0, 100),
        nameAr: body.nameAr?.trim()?.slice(0, 100) || null,
        type: body.type === 'SET_PRICE' ? 'SET_PRICE' : 'ADD_TO_PRICE',
        required: body.required === true,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      },
      include: { values: true },
    })
    return Response.json(option, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to create option' }, { status: 500 })
  }
}
