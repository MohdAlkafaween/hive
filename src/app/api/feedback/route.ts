import { requireAuth } from '@/lib/authGuard'
import prisma from '@/lib/prisma'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// GET — admin/manager: list menu items with average ratings
export async function GET() {
  const auth = await requireAuth('ADMIN', 'MANAGER')
  if (auth instanceof Response) return auth

  try {
    const feedbacks = await prisma.itemFeedback.groupBy({
      by: ['menuItemId'],
      _avg: { rating: true },
      _count: { rating: true },
    })

    // Get menu item details
    const menuItemIds = feedbacks.map(f => f.menuItemId).filter((id): id is number => id !== null)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true, nameAr: true, imageUrl: true, category: { select: { name: true, nameAr: true } } },
    })
    const itemMap = new Map(menuItems.map(m => [m.id, m]))

    const items = feedbacks
      .filter(f => f.menuItemId !== null)
      .map(f => {
        const item = itemMap.get(f.menuItemId!)
        return {
          menuItemId: f.menuItemId,
          name: item?.name ?? 'Unknown',
          nameAr: item?.nameAr ?? null,
          imageUrl: item?.imageUrl ?? null,
          category: item?.category?.name ?? null,
          categoryAr: item?.category?.nameAr ?? null,
          avgRating: Math.round((f._avg.rating ?? 0) * 10) / 10,
          totalReviews: f._count.rating,
        }
      })
      .sort((a, b) => b.totalReviews - a.totalReviews)

    return Response.json({ items })
  } catch (e) {
    console.error('[GET /api/feedback]', e)
    return Response.json({ error: 'Failed to load feedback' }, { status: 500 })
  }
}
