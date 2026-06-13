import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'STAFF', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    })
    return Response.json(categories)
  } catch {
    return Response.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body?.name?.trim()) {
      return Response.json({ error: 'Category name is required' }, { status: 400 })
    }

    const category = await prisma.menuCategory.create({
      data: {
        name: body.name.trim().slice(0, 100),
        nameAr: body.nameAr?.trim()?.slice(0, 100) || null,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
        isActive: body.isActive !== false,
      },
    })
    return Response.json(category, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
