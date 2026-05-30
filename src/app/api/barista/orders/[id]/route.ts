import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// DELETE a single barista order — also reverses cash register update (fix #7)
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid order ID' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      const order = await tx.baristaOrder.findUnique({ where: { id: Number(id) } })
      if (!order) throw { code: 'P2025' }

      // Reverse cash register — prefer the order's linked register if stored,
      // otherwise fall back to the deleting user's open register.
      const amount = order.finalPrice || order.totalPrice
      const openRegister = order.registerId
        ? await tx.cashRegister.findUnique({ where: { id: order.registerId } })
        : await tx.cashRegister.findFirst({
            where: { userId: session.userId as number, status: 'OPEN' },
          })
      if (openRegister) {
        const update: Record<string, number> = {}
        if (order.paymentMethod === 'CASH') update.cashSales = Math.max(0, openRegister.cashSales - amount)
        else if (order.paymentMethod === 'CARD') update.cardSales = Math.max(0, openRegister.cardSales - amount)
        if (Object.keys(update).length > 0) {
          await tx.cashRegister.update({ where: { id: openRegister.id }, data: update })
        }
      }

      await tx.baristaOrder.delete({ where: { id: Number(id) } })
    })

    return Response.json({ ok: true })
  } catch (e: any) {
    console.error('[DELETE /api/barista/orders/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Order not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
