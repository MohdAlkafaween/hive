import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { saveReceiptToFile } from '@/lib/receiptWriter'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params

    // Support lookup by receipt number (RCP-XXXXX) or by order ID
    let orders
    let receiptNumber: string | null = null

    if (id.startsWith('RCP-')) {
      receiptNumber = id
      orders = await prisma.baristaOrder.findMany({
        where: { receiptNumber: id },
        include: {
          menuItem: true,
          student: { select: { id: true, fullName: true, studentNumber: true, phone: true } },
        },
        orderBy: { id: 'asc' },
      })
    } else {
      if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

      // First find the order to get its receipt number
      const order = await prisma.baristaOrder.findUnique({
        where: { id: Number(id) },
        select: { receiptNumber: true },
      })
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

      receiptNumber = order.receiptNumber

      // Then fetch ALL orders with the same receipt number
      if (order.receiptNumber) {
        orders = await prisma.baristaOrder.findMany({
          where: { receiptNumber: order.receiptNumber },
          include: {
            menuItem: true,
            student: { select: { id: true, fullName: true, studentNumber: true, phone: true } },
          },
          orderBy: { id: 'asc' },
        })
      } else {
        // Fallback: single order without receipt number
        orders = await prisma.baristaOrder.findMany({
          where: { id: Number(id) },
          include: {
            menuItem: true,
            student: { select: { id: true, fullName: true, studentNumber: true, phone: true } },
          },
        })
      }
    }

    // Also look for subscription transactions with the same receipt number (unified receipts)
    let subscriptionItems: { name: string; basePrice: number; options: { name: string; price: number }[]; finalPrice: number; quantity: number }[] = []
    let subscriptionTotal = 0
    if (receiptNumber) {
      const transactions = await prisma.transaction.findMany({
        where: { receiptNumber },
        include: { student: { select: { id: true, fullName: true, studentNumber: true, phone: true } } },
      })
      for (const txn of transactions) {
        const item = {
          name: `Subscription: ${txn.planType}`,
          basePrice: txn.amountPaid + txn.discountAmount,
          options: txn.discountAmount > 0 ? [{ name: `Discount`, price: -txn.discountAmount }] : [],
          finalPrice: txn.amountPaid,
          quantity: 1,
        }
        subscriptionItems.push(item)
        subscriptionTotal += txn.amountPaid
      }
    }

    if ((!orders || orders.length === 0) && subscriptionItems.length === 0) {
      return Response.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Get business info from settings
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['businessName', 'receiptFooter'] } },
    })
    const businessName = settings.find(s => s.key === 'businessName')?.value || 'HIVE Study House'
    const receiptFooter = settings.find(s => s.key === 'receiptFooter')?.value || 'Thank you for your purchase!'

    const firstOrder = orders?.[0]
    const student = firstOrder?.student || null

    // Build items array from barista orders
    const baristaItems = (orders || []).map(order => {
      let options: { optionName?: string; valueLabel?: string; name?: string; value?: string; price: number }[] = []
      try { options = JSON.parse(order.selectedOptions || '[]') } catch {}

      return {
        name: order.menuItem?.name ?? 'Deleted Item',
        basePrice: order.menuItem?.price ?? order.totalPrice,
        options: options.map(o => ({
          name: `${o.optionName || o.name || ''}: ${o.valueLabel || o.value || ''}`,
          price: o.price || 0,
        })),
        finalPrice: order.finalPrice || order.totalPrice,
        quantity: order.quantity,
      }
    })

    // Combine barista + subscription items
    const allItems = [...subscriptionItems, ...baristaItems]
    const baristaTotal = (orders || []).reduce((sum, o) => sum + (o.finalPrice || o.totalPrice), 0)
    const total = baristaTotal + subscriptionTotal

    // Determine payment method display
    let paymentMethod = firstOrder?.paymentMethod || 'CASH'
    if (subscriptionItems.length > 0 && (!orders || orders.length === 0)) {
      // Pure subscription receipt — check the transaction gateway
      const txn = await prisma.transaction.findFirst({ where: { receiptNumber: receiptNumber! } })
      paymentMethod = txn?.gateway || 'Cash'
    }

    const receipt = {
      receiptNumber: receiptNumber || (firstOrder ? `RCP-${String(firstOrder.id).padStart(5, '0')}` : 'N/A'),
      date: firstOrder?.createdAt || new Date(),
      staffName: (session.email as string).split('@')[0],
      studentName: student?.fullName || null,
      studentId: student?.studentNumber ? `STD-${String(student.studentNumber).padStart(4, '0')}` : null,
      items: allItems,
      total,
      paymentMethod,
      businessName,
      receiptFooter,
      // Metadata for the frontend
      hasSubscription: subscriptionItems.length > 0,
      hasBaristaOrders: (orders || []).length > 0,
    }

    saveReceiptToFile({
      receiptNumber: receipt.receiptNumber,
      type: 'barista',
      content: receipt,
      date: new Date(),
    }).catch(() => {})

    return Response.json(receipt)
  } catch {
    return Response.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}
