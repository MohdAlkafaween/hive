import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const data: Record<string, unknown> = { updatedAt: new Date() }
    if (typeof body.description === 'string') data.description = body.description.trim().slice(0, 200)
    if (typeof body.amount === 'number') {
      if (body.amount <= 0) return Response.json({ error: 'Amount must be positive' }, { status: 400 })
      data.amount = body.amount
    }
    if (body.date) data.date = new Date(body.date)
    if (typeof body.category === 'string') {
      const validCategories = ['ingredients', 'supplies', 'utilities', 'maintenance', 'other']
      const cat = body.category.trim().toLowerCase().slice(0, 50) || null
      if (cat && !validCategories.includes(cat)) {
        return Response.json({ error: 'Invalid expense category' }, { status: 400 })
      }
      data.category = cat
    }

    const expense = await prisma.cafeExpense.update({ where: { id: Number(id) }, data })
    return Response.json(expense)
  } catch {
    return Response.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    await prisma.cafeExpense.delete({ where: { id: Number(id) } })
    return Response.json({ message: 'Expense deleted' })
  } catch {
    return Response.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
