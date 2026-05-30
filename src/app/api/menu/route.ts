import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

export async function GET() {
  try {
    // Menu is readable by authenticated users (barista page needs it)
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const items = await prisma.menuItem.findMany({
      where: { isDeleted: false, isCustom: false }, // Hide soft-deleted and ad-hoc custom items
      include: {
        category: { select: { id: true, name: true, nameAr: true } },
        options: { orderBy: { sortOrder: 'asc' }, include: { values: { orderBy: { sortOrder: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json(items)
  } catch {
    return Response.json({ error: 'Failed to load menu' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const name = sanitizeString(body.name)
    if (!name || name.length < 1) {
      return Response.json({ error: 'Item name is required' }, { status: 400 })
    }

    const price = parseFloat(body.price)
    if (isNaN(price) || price < 0 || price > 10000) {
      return Response.json({ error: 'Invalid price' }, { status: 400 })
    }

    // Validate imageUrl — allow https URLs, local uploads, or null
    let imageUrl: string | null = null
    if (body.imageUrl && typeof body.imageUrl === 'string') {
      const url = body.imageUrl.trim()
      if (url.startsWith('/uploads/menu/')) {
        // Local uploaded file — allowed
        imageUrl = url.slice(0, 500)
      } else if (url.startsWith('https://')) {
        // Block internal IPs / metadata endpoints
        if (/^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0)/i.test(url)) {
          return Response.json({ error: 'Internal URLs are not allowed' }, { status: 400 })
        }
        imageUrl = url.slice(0, 500)
      } else if (url) {
        return Response.json({ error: 'Image must be an uploaded file or HTTPS URL' }, { status: 400 })
      }
    }

    const costPrice = typeof body.costPrice === 'number' ? body.costPrice : 0
    const categoryId = typeof body.categoryId === 'number' ? body.categoryId : null
    const nameAr = body.nameAr?.trim()?.slice(0, 100) || null

    const item = await prisma.menuItem.create({
      data: { name, nameAr, price, costPrice, imageUrl, categoryId },
      include: { category: true, options: { include: { values: true } } },
    })
    return Response.json(item)
  } catch {
    return Response.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
