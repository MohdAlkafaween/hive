import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { todayString } from '@/lib/subscriptionLogic'
import { generateReceiptNumber } from '@/lib/receiptNumber'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    // Limit to last 200 orders to avoid unbounded query (issue #13)
    const today = new Date(`${todayString()}T00:00:00`)
    const orders = await prisma.baristaOrder.findMany({
      where: { createdAt: { gte: today } },
      include: { menuItem: true, student: { select: { id: true, fullName: true, studentNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return Response.json(orders)
  } catch {
    return Response.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF', 'BARISTA')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    // Support batch orders: { items: [...], paymentMethod, studentId? }
    // Also supports legacy single-item: { menuItemId, quantity, ... }
    const isBatch = Array.isArray(body.items) && body.items.length > 0

    // Validate optional studentId
    let linkedStudentId: number | undefined = undefined
    if (body.studentId) {
      const sid = parseInt(String(body.studentId))
      if (!isNaN(sid) && sid > 0) {
        const student = await prisma.student.findUnique({ where: { id: sid } })
        if (student) linkedStudentId = sid
      }
    }

    const pm = ['CASH', 'CARD', 'OTHER'].includes(body.paymentMethod) ? body.paymentMethod : 'CASH'

    if (isBatch) {
      // ─── Batch order (multiple items, one receipt) ───
      // Pre-validate all items BEFORE generating receipt number (fix #1)
      const validatedItems: Array<{
        resolvedMenuItemId: number
        basePrice: number
        orderCostPrice: number
        actual: number
        optionsJson: string
        qty: number
      }> = []

      // Batch fetch all regular menu items in one query (avoids N+1)
      const regularMenuItemIds: number[] = [...new Set(
        (body.items as Array<{ customName?: string; menuItemId?: number }>)
          .filter(i => !i.customName || (i.menuItemId && Number(i.menuItemId) > 0))
          .map(i => parseInt(String(i.menuItemId)))
          .filter(id => !isNaN(id) && id > 0)
      )]
      const batchMenuItems = regularMenuItemIds.length > 0
        ? await prisma.menuItem.findMany({ where: { id: { in: regularMenuItemIds } } })
        : []
      const menuItemMap = new Map(batchMenuItems.map(mi => [mi.id, mi]))

      for (const item of body.items) {
        const { menuItemId, quantity, selectedOptions, finalPrice, totalPrice, customName, customCostPrice } = item

        const qty = parseInt(quantity) || 1
        if (qty < 1 || qty > 100) continue

        let resolvedMenuItemId: number
        let basePrice: number
        let orderCostPrice: number

        // Handle custom items (negative or missing menuItemId with customName)
        if (customName && (!menuItemId || Number(menuItemId) < 0)) {
          const customItem = await prisma.menuItem.create({
            data: {
              name: String(customName).trim().slice(0, 100),
              price: parseFloat(totalPrice) || parseFloat(String(finalPrice)) || 0,
              costPrice: parseFloat(String(customCostPrice)) || 0,
              isOutOfStock: true,
              isCustom: true,
            },
          })
          resolvedMenuItemId = customItem.id
          basePrice = customItem.price * qty
          orderCostPrice = customItem.costPrice * qty
        } else {
          if (!menuItemId || !isValidId(menuItemId)) continue
          const menuItem = menuItemMap.get(parseInt(String(menuItemId)))
          if (!menuItem) continue
          resolvedMenuItemId = menuItem.id
          basePrice = parseFloat(totalPrice) || menuItem.price * qty
          orderCostPrice = menuItem.costPrice * qty
        }

        const optionsJson = selectedOptions ? JSON.stringify(selectedOptions) : '[]'
        if (Array.isArray(selectedOptions)) {
          for (const opt of selectedOptions) {
            if (opt.costPrice) orderCostPrice += opt.costPrice * qty
          }
        }

        const actual = typeof finalPrice === 'number' ? finalPrice : basePrice

        validatedItems.push({ resolvedMenuItemId, basePrice, orderCostPrice, actual, optionsJson, qty })
      }

      if (validatedItems.length === 0) {
        return Response.json({ error: 'No valid items in order' }, { status: 400 })
      }

      // Find the open register upfront to link to orders
      const openRegister = await prisma.cashRegister.findFirst({
        where: { userId: session.userId as number, status: 'OPEN' },
      })

      // Use transaction to atomically generate receipt + create orders + update register (fix #2)
      const result = await prisma.$transaction(async (tx) => {
        // Connected receipts: if a student has a subscription transaction from today
        // with a receipt number, reuse it so both appear on one receipt
        let receiptNumber: string | null = null
        if (linkedStudentId) {
          const todayStart = new Date(`${todayString()}T00:00:00`)
          const recentTxn = await tx.transaction.findFirst({
            where: {
              studentId: linkedStudentId,
              receiptNumber: { not: null },
              createdAt: { gte: todayStart },
            },
            orderBy: { createdAt: 'desc' },
          })
          if (recentTxn?.receiptNumber) receiptNumber = recentTxn.receiptNumber
        }
        if (!receiptNumber) receiptNumber = await generateReceiptNumber(tx)

        const createdOrders = []
        let totalOrderAmount = 0

        for (const vi of validatedItems) {
          const order = await tx.baristaOrder.create({
            data: {
              menuItemId: vi.resolvedMenuItemId,
              quantity: vi.qty,
              totalPrice: vi.basePrice,
              costPrice: vi.orderCostPrice,
              finalPrice: vi.actual,
              selectedOptions: vi.optionsJson,
              paymentMethod: pm,
              receiptNumber,
              ...(linkedStudentId ? { studentId: linkedStudentId } : {}),
              ...(openRegister ? { registerId: openRegister.id } : {}),
            },
            include: { menuItem: true, student: { select: { id: true, fullName: true, studentNumber: true } } }
          })
          createdOrders.push(order)
          totalOrderAmount += vi.actual
        }

        // Update cash register inside transaction (using register found above)
        if (openRegister) {
          // Re-read the register inside the transaction for consistent data
          const reg = await tx.cashRegister.findUnique({ where: { id: openRegister.id } })
          if (reg) {
            const update: Record<string, number> = {}
            if (pm === 'CASH') update.cashSales = reg.cashSales + totalOrderAmount
            else if (pm === 'CARD') update.cardSales = reg.cardSales + totalOrderAmount
            if (Object.keys(update).length > 0) {
              await tx.cashRegister.update({ where: { id: reg.id }, data: update })
            }
          }
        }

        return { receiptNumber, orders: createdOrders, total: totalOrderAmount, paymentMethod: pm, student: createdOrders[0]?.student || null }
      })

      return Response.json(result)

    } else {
      // ─── Legacy single-item order (also supports customName now — fix #23) ───
      const { menuItemId, quantity, totalPrice, selectedOptions, finalPrice, customName, customCostPrice } = body

      let resolvedMenuItemId: number
      let price: number
      let itemCostPrice: number

      if (customName && (!menuItemId || Number(menuItemId) < 0)) {
        // Custom item in legacy path
        price = parseFloat(totalPrice)
        if (isNaN(price) || price <= 0) {
          return Response.json({ error: 'Invalid price for custom item' }, { status: 400 })
        }
        itemCostPrice = parseFloat(String(customCostPrice)) || 0
        const customItem = await prisma.menuItem.create({
          data: {
            name: String(customName).trim().slice(0, 100),
            price,
            costPrice: itemCostPrice,
            isOutOfStock: true,
            isCustom: true, // flag as ad-hoc item
          },
        })
        resolvedMenuItemId = customItem.id
      } else {
        if (!menuItemId || !isValidId(menuItemId)) {
          return Response.json({ error: 'Valid menu item ID required' }, { status: 400 })
        }
        const menuItem = await prisma.menuItem.findUnique({ where: { id: parseInt(String(menuItemId)) } })
        if (!menuItem) {
          return Response.json({ error: 'Menu item not found' }, { status: 404 })
        }
        resolvedMenuItemId = menuItem.id
        itemCostPrice = menuItem.costPrice
        price = parseFloat(totalPrice)
        if (isNaN(price) || price < 0 || price > 100000) {
          return Response.json({ error: 'Invalid total price' }, { status: 400 })
        }
      }

      const qty = parseInt(quantity) || 1
      if (qty < 1 || qty > 100) {
        return Response.json({ error: 'Quantity must be between 1 and 100' }, { status: 400 })
      }

      let orderCostPrice = itemCostPrice * qty
      const optionsJson = selectedOptions ? JSON.stringify(selectedOptions) : '[]'
      if (Array.isArray(selectedOptions)) {
        for (const opt of selectedOptions) {
          if (opt.costPrice) orderCostPrice += opt.costPrice * qty
        }
      }

      const actual = typeof finalPrice === 'number' ? finalPrice : price * qty

      // Find open register to link to order
      const legacyRegister = await prisma.cashRegister.findFirst({
        where: { userId: session.userId as number, status: 'OPEN' },
      })

      // Use transaction for atomic receipt + order + register (fix #2)
      const order = await prisma.$transaction(async (tx) => {
        // Connected receipts for legacy path
        let receiptNumber: string | null = null
        if (linkedStudentId) {
          const todayStart = new Date(`${todayString()}T00:00:00`)
          const recentTxn = await tx.transaction.findFirst({
            where: {
              studentId: linkedStudentId,
              receiptNumber: { not: null },
              createdAt: { gte: todayStart },
            },
            orderBy: { createdAt: 'desc' },
          })
          if (recentTxn?.receiptNumber) receiptNumber = recentTxn.receiptNumber
        }
        if (!receiptNumber) receiptNumber = await generateReceiptNumber(tx)

        const created = await tx.baristaOrder.create({
          data: {
            menuItemId: resolvedMenuItemId,
            quantity: qty,
            totalPrice: price * qty,
            costPrice: orderCostPrice,
            finalPrice: actual,
            selectedOptions: optionsJson,
            paymentMethod: pm,
            receiptNumber,
            ...(linkedStudentId ? { studentId: linkedStudentId } : {}),
            ...(legacyRegister ? { registerId: legacyRegister.id } : {}),
          },
          include: { menuItem: true, student: { select: { id: true, fullName: true, studentNumber: true } } }
        })

        // Update cash register inside transaction
        if (legacyRegister) {
          const reg = await tx.cashRegister.findUnique({ where: { id: legacyRegister.id } })
          if (reg) {
            const update: Record<string, number> = {}
            if (pm === 'CASH') update.cashSales = reg.cashSales + actual
            else if (pm === 'CARD') update.cardSales = reg.cardSales + actual
            if (Object.keys(update).length > 0) {
              await tx.cashRegister.update({ where: { id: reg.id }, data: update })
            }
          }
        }

        return created
      })

      return Response.json(order)
    }
  } catch {
    return Response.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
