import prisma from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customerAuth'
import { checkRateLimit } from '@/lib/rateLimit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  const { id } = await params

  try {
    const orders = await prisma.baristaOrder.findMany({
      where: { orderGroupId: id },
      include: { menuItem: { select: { name: true, nameAr: true } } },
    })

    if (orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    // IDOR check — verify ownership
    if (orders[0].studentId !== student.id) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    const total = orders.reduce((s, o) => s + o.finalPrice, 0)
    return Response.json({
      orderGroupId: id,
      receiptNumber: orders[0].receiptNumber,
      status: orders[0].status,
      createdAt: orders[0].createdAt,
      items: orders.map(o => ({
        name: o.menuItem?.name || 'Unknown',
        quantity: o.quantity,
        price: o.finalPrice,
        options: o.selectedOptions,
        status: o.status,
        note: o.customerNote,
      })),
      total: Math.round(total * 100) / 100,
    })
  } catch (e) {
    console.error('[GET /api/customer/orders/[id]]', e)
    return Response.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  const limit = checkRateLimit(`customer-cancel:${student.id}`, 20, 60 * 60 * 1000)
  if (limit.limited) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const { id } = await params

  try {
    const orders = await prisma.baristaOrder.findMany({
      where: { orderGroupId: id },
    })

    if (orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    if (orders[0].studentId !== student.id) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    // Can only cancel if ALL items are PENDING
    const allPending = orders.every(o => o.status === 'PENDING')
    if (!allPending) {
      return Response.json({ error: 'Cannot cancel — order is already being prepared' }, { status: 400 })
    }

    await prisma.baristaOrder.updateMany({
      where: { orderGroupId: id, studentId: student.id },
      data: { status: 'CANCELLED' },
    })

    return Response.json({ success: true, status: 'CANCELLED' })
  } catch (e) {
    console.error('[PATCH /api/customer/orders/[id]]', e)
    return Response.json({ error: 'Failed to cancel order' }, { status: 500 })
  }
}
