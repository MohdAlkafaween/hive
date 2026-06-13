import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { checkStaffRateLimit } from '@/lib/rateLimit'

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { status, paymentMethod } = body

    if (!status || !['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch all orders in this group
    const orders = await prisma.baristaOrder.findMany({
      where: { orderGroupId: id },
      include: { menuItem: { select: { name: true } }, student: { select: { fullName: true } } },
    })

    if (orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate transition from current status
    const currentStatus = orders[0].status
    const allowed = VALID_TRANSITIONS[currentStatus] || []
    if (!allowed.includes(status)) {
      return Response.json({ error: `Cannot transition from ${currentStatus} to ${status}` }, { status: 400 })
    }

    if (status === 'COMPLETED') {
      // Payment method required
      const validPm = ['CASH', 'CARD', 'OTHER']
      const pm = validPm.includes(paymentMethod) ? paymentMethod : null
      if (!pm) {
        return Response.json({ error: 'Payment method required when completing order' }, { status: 400 })
      }

      const totalAmount = orders.reduce((s, o) => s + o.finalPrice, 0)

      await prisma.$transaction(async (tx) => {
        // Update all order records
        await tx.baristaOrder.updateMany({
          where: { orderGroupId: id },
          data: { status: 'COMPLETED', paymentMethod: pm },
        })

        // Update cash register if staff has one open
        const openRegister = await tx.cashRegister.findFirst({
          where: { userId: session.userId as number, status: 'OPEN' },
        })
        if (openRegister) {
          const update: Record<string, number> = {}
          if (pm === 'CASH') update.cashSales = openRegister.cashSales + totalAmount
          else if (pm === 'CARD') update.cardSales = openRegister.cardSales + totalAmount
          if (Object.keys(update).length > 0) {
            await tx.cashRegister.update({ where: { id: openRegister.id }, data: update })
          }
        }
      })
    } else {
      // Simple status update
      await prisma.baristaOrder.updateMany({
        where: { orderGroupId: id },
        data: { status },
      })
    }

    return Response.json({ success: true, orderGroupId: id, status })
  } catch (e) {
    console.error('[PATCH /api/orders/queue/[id]]', e)
    return Response.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
