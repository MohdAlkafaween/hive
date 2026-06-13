import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { saveReceiptToFile } from '@/lib/receiptWriter'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id: orderGroupId } = await params

    // Find all orders in this group
    const orders = await prisma.baristaOrder.findMany({
      where: { orderGroupId },
      include: {
        menuItem: { select: { name: true, nameAr: true } },
        student: { select: { id: true, fullName: true, studentNumber: true, phone: true } },
      },
      orderBy: { id: 'asc' },
    })

    if (orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    const first = orders[0]

    // Validate: receipt is only available for COMPLETED orders (proof of payment)
    if (first.status !== 'COMPLETED') {
      return Response.json({ error: 'Order not yet completed' }, { status: 400 })
    }

    // Get business info from settings
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['businessName', 'receiptFooter'] } },
    })
    const businessName = settings.find(s => s.key === 'businessName')?.value || 'HIVE Study House'
    const receiptFooter = settings.find(s => s.key === 'receiptFooter')?.value || 'Thank you for your purchase!'

    // Get staff name from session (the staff who is generating/viewing the receipt)
    const staffName = session.name || session.email || 'Staff'

    const student = first.student

    const items = orders.map(order => {
      let options: { optionName?: string; valueLabel?: string; name?: string; value?: string; price: number }[] = []
      try { options = JSON.parse(order.selectedOptions || '[]') } catch {}

      return {
        name: order.menuItem?.name ?? 'Unknown',
        nameAr: order.menuItem?.nameAr ?? null,
        basePrice: order.totalPrice,
        options: options.map(o => ({
          name: `${o.optionName || o.name || ''}: ${o.valueLabel || o.value || ''}`,
          price: o.price || 0,
        })),
        finalPrice: order.finalPrice,
        quantity: order.quantity,
        note: order.customerNote,
      }
    })

    const total = orders.reduce((s, o) => s + o.finalPrice, 0)

    const receipt = {
      orderGroupId,
      receiptNumber: first.receiptNumber || `ORD-${orderGroupId.slice(0, 6).toUpperCase()}`,
      date: first.createdAt,
      customerName: student?.fullName || null,
      customerId: student?.studentNumber ? `STD-${String(student.studentNumber).padStart(4, '0')}` : null,
      staffName,
      items,
      total: Math.round(total * 100) / 100,
      status: first.status,
      paymentMethod: first.paymentMethod,
      businessName,
      receiptFooter,
    }

    saveReceiptToFile({
      receiptNumber: receipt.receiptNumber,
      type: 'customer-order',
      content: receipt,
      date: new Date(),
    }).catch(() => {})

    return Response.json(receipt)
  } catch (e) {
    console.error('[GET /api/orders/[id]/receipt]', e)
    return Response.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}
