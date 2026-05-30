import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// GET subscription receipt by transaction ID — redirects to the unified receipt API
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF', 'MANAGER')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 })

    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: { student: { select: { id: true, fullName: true, studentNumber: true, phone: true } } },
    })

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Build a standalone subscription receipt (with linked barista orders if sharing receipt number)
    // If this transaction shares a receipt number, also include any barista orders
    let linkedOrders: Array<{ menuItem: { name: string } | null; quantity: number; finalPrice: number; totalPrice: number }> = []
    if (transaction.receiptNumber) {
      linkedOrders = await prisma.baristaOrder.findMany({
        where: { receiptNumber: transaction.receiptNumber },
        include: { menuItem: { select: { name: true } } },
      })
    }

    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['businessName', 'receiptFooter'] } },
    })
    const businessName = settings.find(s => s.key === 'businessName')?.value || 'HIVE Study House'
    const receiptFooter = settings.find(s => s.key === 'receiptFooter')?.value || 'Thank you for your purchase!'

    const receipt = {
      receiptNumber: transaction.receiptNumber || `TXN-${String(transaction.id).padStart(5, '0')}`,
      date: transaction.createdAt,
      staffName: (session.email as string).split('@')[0],
      studentName: transaction.student?.fullName || transaction.studentName || null,
      studentId: transaction.student?.studentNumber ? `STD-${String(transaction.student.studentNumber).padStart(4, '0')}` : null,
      items: [
        {
          name: `Subscription: ${transaction.planType}`,
          basePrice: transaction.amountPaid + transaction.discountAmount,
          options: transaction.discountAmount > 0 ? [{ name: 'Discount', price: -transaction.discountAmount }] : [],
          finalPrice: transaction.amountPaid,
          quantity: 1,
        },
        ...linkedOrders.map(o => ({
          name: o.menuItem?.name ?? 'Deleted Item',
          basePrice: o.totalPrice,
          options: [],
          finalPrice: o.finalPrice || o.totalPrice,
          quantity: o.quantity,
        })),
      ],
      total: transaction.amountPaid + linkedOrders.reduce((s, o) => s + (o.finalPrice || o.totalPrice), 0),
      paymentMethod: transaction.gateway,
      businessName,
      receiptFooter,
      hasSubscription: true,
      hasBaristaOrders: linkedOrders.length > 0,
    }

    return Response.json(receipt)
  } catch {
    return Response.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}
