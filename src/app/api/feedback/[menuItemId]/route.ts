import { requireAuth } from '@/lib/authGuard'
import prisma from '@/lib/prisma'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// GET — admin: individual reviews for a specific menu item
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ menuItemId: string }> }
) {
  const auth = await requireAuth('ADMIN', 'MANAGER')
  if (auth instanceof Response) return auth

  const { menuItemId: idStr } = await params
  const menuItemId = parseInt(idStr, 10)
  if (isNaN(menuItemId)) {
    return Response.json({ error: 'Invalid menuItemId' }, { status: 400 })
  }

  try {
    const feedbacks = await prisma.itemFeedback.findMany({
      where: { menuItemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        student: { select: { fullName: true, photoUrl: true } },
      },
    })

    const reviews = feedbacks.map(f => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      customerName: f.student?.fullName ?? 'Anonymous',
      customerPhoto: f.student?.photoUrl ?? null,
      createdAt: f.createdAt.toISOString(),
    }))

    // Also get the item info
    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { name: true, nameAr: true, imageUrl: true },
    })

    return Response.json({ item, reviews })
  } catch (e) {
    console.error('[GET /api/feedback/[menuItemId]]', e)
    return Response.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}
