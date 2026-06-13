import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// GET barista orders for a specific student
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'read')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) {
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
