import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(req: Request) {
  try {
    // STAFF needs read access to expenses for the barista POS page (fix #8)
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = {}
    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, unknown>).gte = new Date(from)
      if (to) (where.date as Record<string, unknown>).lte = new Date(to + 'T23:59:59.999')
    }

    const expenses = await prisma.cafeExpense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 2000,
    })
    return Response.json(expenses)
  } catch {
    return Response.json({ error: 'Failed to load expenses' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body?.description?.trim() || typeof body.amount !== 'number' || body.amount <= 0) {
      return Response.json({ error: 'Description and a positive amount are required' }, { status: 400 })
    }

    // Validate category against known values (fix #20)
    const validCategories = ['ingredients', 'supplies', 'utilities', 'maintenance', 'other']
    const category = body.category?.trim()?.toLowerCase()?.slice(0, 50) || null
    if (category && !validCategories.includes(category)) {
      return Response.json({ error: 'Invalid expense category' }, { status: 400 })
    }

    const expense = await prisma.cafeExpense.create({
      data: {
        description: body.description.trim().slice(0, 200),
        amount: body.amount,
        date: body.date ? new Date(body.date) : new Date(),
        category: category,
        addedBy: session.userId as number,
        addedByName: (session.email as string).split('@')[0],
      },
    })
    return Response.json(expense, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
