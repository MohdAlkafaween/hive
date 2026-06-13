import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(req: Request) {
  const ip = getClientIp(req)
  const limit = checkRateLimit(`menu-public:${ip}`, 200, 60 * 1000)
  if (limit.limited) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const categories = await prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        sortOrder: true,
        items: {
          where: { isDeleted: false, isOutOfStock: false, isCustom: false },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            nameAr: true,
            price: true,
            imageUrl: true,
            categoryId: true,
            options: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                nameAr: true,
                type: true,
                required: true,
                sortOrder: true,
                values: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    label: true,
                    labelAr: true,
                    price: true,
                    isDefault: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Also include uncategorized items
    const uncategorized = await prisma.menuItem.findMany({
      where: { isDeleted: false, isOutOfStock: false, isCustom: false, categoryId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        price: true,
        imageUrl: true,
        categoryId: true,
        options: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            nameAr: true,
            type: true,
            required: true,
            sortOrder: true,
            values: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                label: true,
                labelAr: true,
                price: true,
                isDefault: true,
              },
            },
          },
        },
      },
    })

    const result = [...categories]
    if (uncategorized.length > 0) {
      result.push({
        id: 0,
        name: 'Other',
        nameAr: 'أخرى',
        sortOrder: 999,
        items: uncategorized,
      })
    }

    return Response.json({ categories: result })
  } catch (e) {
    console.error('[GET /api/menu/public]', e)
    return Response.json({ error: 'Failed to load menu' }, { status: 500 })
  }
}
