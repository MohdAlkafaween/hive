import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// GET barista orders for a specific student
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER', 'BARISTA')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(Number(id))) {
      return Response.json({ error: 'Invalid student ID' }, { status: 400 })
    }

    const orders = await prisma.baristaOrder.findMany({
      where: { studentId: Number(id) },
      include: { menuItem: { select: { name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return Response.json(orders)
  } catch (e) {
    console.error('[GET /api/students/[id]/orders]', e)
    return Response.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
