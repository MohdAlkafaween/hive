import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

export async function GET() {
  try {
    // Menu is readable by authenticated users (barista page needs it)
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const items = await prisma.menuItem.findMany()
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN', 'BARISTA')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const name = sanitizeString(body.name)
    if (!name || name.length < 1) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 })
    }

    const price = parseFloat(body.price)
    if (isNaN(price) || price < 0 || price > 10000) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
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
          return NextResponse.json({ error: 'Internal URLs are not allowed' }, { status: 400 })
        }
        imageUrl = url.slice(0, 500)
      } else if (url) {
        return NextResponse.json({ error: 'Image must be an uploaded file or HTTPS URL' }, { status: 400 })
      }
    }

    const item = await prisma.menuItem.create({
      data: { name, price, imageUrl }
    })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
