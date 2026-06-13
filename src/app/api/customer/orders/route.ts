import prisma from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customerAuth'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizeString } from '@/lib/sanitize'
import { generateReceiptNumber } from '@/lib/receiptNumber'

export async function GET() {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  try {
    const orders = await prisma.baristaOrder.findMany({
      where: { studentId: student.id, orderedBy: 'CUSTOMER' },
      include: { menuItem: { select: { name: true, nameAr: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // Group by orderGroupId
    const groups = new Map<string, typeof orders>()
    for (const order of orders) {
      const key = order.orderGroupId || order.id.toString()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(order)
    }

    const result = Array.from(groups.entries()).map(([groupId, items]) => {
      const first = items[0]
      const total = items.reduce((sum, i) => sum + i.finalPrice, 0)
      // Group status: lowest status wins
      const statusPriority: Record<string, number> = { PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELLED: 5 }
      const groupStatus = items.reduce((lowest, i) => {
        return (statusPriority[i.status] ?? 99) < (statusPriority[lowest] ?? 99) ? i.status : lowest
      }, items[0].status)

      return {
        orderGroupId: groupId,
        receiptNumber: first.receiptNumber,
        status: groupStatus,
        createdAt: first.createdAt,
        paymentMethod: first.paymentMethod,
        items: items.map(i => ({
          id: i.id,
          menuItemId: i.menuItemId,
          name: i.menuItem?.name || 'Unknown',
          nameAr: i.menuItem?.nameAr || null,
          quantity: i.quantity,
          options: i.selectedOptions,
          price: i.finalPrice,
          status: i.status,
          note: i.customerNote,
        })),
        total: Math.round(total * 100) / 100,
        note: first.customerNote,
      }
    }).slice(0, 50)

    return Response.json({ orders: result })
  } catch (e) {
    console.error('[GET /api/customer/orders]', e)
    return Response.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const student = await requireCustomerAuth()
  if (student instanceof Response) return student

  const limit = checkRateLimit(`customer-order:${student.id}`, 20, 60 * 60 * 1000)
  if (limit.limited) {
    return Response.json({ error: 'Too many orders. Try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { items, orderNote } = body
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return Response.json({ error: 'Order must contain 1-20 items' }, { status: 400 })
    }

    const sanitizedOrderNote = orderNote ? sanitizeString(orderNote).slice(0, 200) : null

    // Validate and price all items server-side
    const validatedItems: Array<{
      menuItemId: number
      quantity: number
      totalPrice: number
      finalPrice: number
      selectedOptions: string
      customerNote: string | null
    }> = []

    // Batch fetch all menu items in one query (avoids N+1)
    const menuItemIds = [...new Set(items.map((i: { menuItemId: number }) => i.menuItemId).filter((id: number) => typeof id === 'number'))]
    if (menuItemIds.length === 0) {
      return Response.json({ error: 'No valid menu item IDs' }, { status: 400 })
    }
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { options: { include: { values: true } } },
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    for (const item of items) {
      const { menuItemId, quantity, selectedOptions, note } = item

      if (!menuItemId || typeof menuItemId !== 'number') {
        return Response.json({ error: 'Invalid menu item ID' }, { status: 400 })
      }

      const menuItem = menuItemMap.get(menuItemId)

      if (!menuItem || menuItem.isDeleted || menuItem.isOutOfStock || menuItem.isCustom) {
        return Response.json({ error: 'One or more items are not available' }, { status: 400 })
      }

      // Validate quantity
      const qty = parseInt(quantity) || 1
      if (qty < 1 || qty > 10) {
        return Response.json({ error: 'Quantity must be 1-10' }, { status: 400 })
      }

      // Calculate price from options (server-side - never trust client)
      let unitPrice = menuItem.price
      const resolvedOptions: Array<{ optionId: number; valueId: number; name: string; price: number }> = []

      if (Array.isArray(selectedOptions) && selectedOptions.length > 0) {
        for (const sel of selectedOptions) {
          const option = menuItem.options.find(o => o.id === sel.optionId)
          if (!option) {
            return Response.json({ error: `Invalid option ${sel.optionId}` }, { status: 400 })
          }
          const value = option.values.find(v => v.id === sel.valueId)
          if (!value) {
            return Response.json({ error: `Invalid option value ${sel.valueId}` }, { status: 400 })
          }

          if (option.type === 'SET_PRICE') {
            unitPrice = value.price
          } else {
            unitPrice += value.price
          }
          resolvedOptions.push({ optionId: option.id, valueId: value.id, name: value.label, price: value.price })
        }
      }

      // Check required options
      for (const opt of menuItem.options) {
        if (opt.required) {
          const selected = (selectedOptions || []).find((s: { optionId: number }) => s.optionId === opt.id)
          if (!selected) {
            return Response.json({ error: `Option "${opt.name}" is required for "${menuItem.name}"` }, { status: 400 })
          }
        }
      }

      const finalPrice = Math.round(unitPrice * qty * 100) / 100
      const itemNote = note ? sanitizeString(note).slice(0, 200) : null
      // Combine per-item note with order note for the first item
      const combinedNote = validatedItems.length === 0 && sanitizedOrderNote
        ? [itemNote, `[Order: ${sanitizedOrderNote}]`].filter(Boolean).join(' | ')
        : itemNote

      validatedItems.push({
        menuItemId: menuItem.id,
        quantity: qty,
        totalPrice: Math.round(menuItem.price * qty * 100) / 100,
        finalPrice,
        selectedOptions: JSON.stringify(resolvedOptions),
        customerNote: combinedNote,
      })
    }

    if (validatedItems.length === 0) {
      return Response.json({ error: 'No valid items' }, { status: 400 })
    }

    // Create order in transaction
    const orderGroupId = crypto.randomUUID()

    const result = await prisma.$transaction(async (tx) => {
      const receiptNumber = await generateReceiptNumber(tx)
      const createdOrders = []
      let total = 0

      for (const vi of validatedItems) {
        const order = await tx.baristaOrder.create({
          data: {
            menuItemId: vi.menuItemId,
            quantity: vi.quantity,
            totalPrice: vi.totalPrice,
            finalPrice: vi.finalPrice,
            selectedOptions: vi.selectedOptions,
            customerNote: vi.customerNote,
            paymentMethod: 'CASH', // default — updated when staff completes the order
            receiptNumber,
            orderGroupId,
            status: 'PENDING',
            orderedBy: 'CUSTOMER',
            studentId: student.id,
          },
          include: { menuItem: { select: { name: true } } },
        })
        createdOrders.push(order)
        total += vi.finalPrice
      }

      return { receiptNumber, orders: createdOrders, total: Math.round(total * 100) / 100 }
    })

    return Response.json({
      success: true,
      orderGroupId,
      receiptNumber: result.receiptNumber,
      items: result.orders.map(o => ({
        name: o.menuItem?.name,
        quantity: o.quantity,
        price: o.finalPrice,
      })),
      total: result.total,
      status: 'PENDING',
    }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/customer/orders]', e)
    return Response.json({ error: 'Failed to place order' }, { status: 500 })
  }
}
