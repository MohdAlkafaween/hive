import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const register = await prisma.cashRegister.findUnique({ where: { id: Number(id) } })
    if (!register) return Response.json({ error: 'Register not found' }, { status: 404 })

    // Non-ADMIN users can only modify their own register
    const role = session.role as string
    if (role !== 'ADMIN' && register.userId !== (session.userId as number)) {
      return Response.json({ error: 'You can only modify your own register' }, { status: 403 })
    }

    // Close register
    if (typeof body.closingCash === 'number') {
      const expectedCash = register.openingCash + register.cashSales
      const discrepancy = body.closingCash - expectedCash

      const updated = await prisma.cashRegister.update({
        where: { id: Number(id) },
        data: {
          closingCash: body.closingCash,
          expectedCash,
          cashDiscrepancy: discrepancy,
          notes: body.notes?.trim()?.slice(0, 500) || null,
          status: 'CLOSED',
          updatedAt: new Date(),
        },
      })
      return Response.json(updated)
    }

    // Update sales totals (called internally when orders are placed)
    const data: Record<string, unknown> = { updatedAt: new Date() }
    if (typeof body.cashSales === 'number') data.cashSales = body.cashSales
    if (typeof body.cardSales === 'number') data.cardSales = body.cardSales

    const updated = await prisma.cashRegister.update({ where: { id: Number(id) }, data })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to update register' }, { status: 500 })
  }
}
