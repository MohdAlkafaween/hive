import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const orders = await prisma.baristaOrder.findMany({
      include: { menuItem: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(orders)
  } catch {
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const { menuItemId, quantity, totalPrice } = body

    if (!menuItemId || !isValidId(menuItemId)) {
      return NextResponse.json({ error: 'Valid menu item ID required' }, { status: 400 })
    }

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty < 1 || qty > 100) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 100' }, { status: 400 })
    }

    const price = parseFloat(totalPrice)
    if (isNaN(price) || price < 0 || price > 100000) {
      return NextResponse.json({ error: 'Invalid total price' }, { status: 400 })
    }

    // Verify the menu item exists before creating order
    const menuItem = await prisma.menuItem.findUnique({ where: { id: parseInt(String(menuItemId)) } })
    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    const order = await prisma.baristaOrder.create({
      data: {
        menuItemId: menuItem.id,
        quantity: qty,
        totalPrice: price
      },
      include: { menuItem: true }
    })
    return NextResponse.json(order)
  } catch {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
