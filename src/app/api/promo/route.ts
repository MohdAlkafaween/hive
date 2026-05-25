import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

// GET all promo codes (ADMIN only)
export async function GET() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usages: {
          include: { student: { select: { id: true, fullName: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    return Response.json(promos)
  } catch (e) {
    console.error('[GET /api/promo]', e)
    return Response.json({ error: 'Failed to load promo codes' }, { status: 500 })
  }
}

// CREATE a promo code (ADMIN only)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const code = sanitizeString(body.code)?.toUpperCase().replace(/\s+/g, '')
    if (!code || code.length < 2 || code.length > 30) {
      return Response.json({ error: 'Promo code must be 2-30 characters' }, { status: 400 })
    }

    const validTypes = ['AMOUNT', 'PERCENTAGE', 'BONUS_ENTRIES']
    const discountType = validTypes.includes(body.discountType) ? body.discountType : 'AMOUNT'

    const discountAmount = Number(body.discountAmount) || 0
    const bonusEntries = Number(body.bonusEntries) || 0

    if (discountType === 'BONUS_ENTRIES') {
      if (!Number.isInteger(bonusEntries) || bonusEntries <= 0 || bonusEntries > 999) {
        return Response.json({ error: 'Bonus entries must be between 1 and 999' }, { status: 400 })
      }
    } else if (discountType === 'PERCENTAGE') {
      if (isNaN(discountAmount) || discountAmount <= 0 || discountAmount > 100) {
        return Response.json({ error: 'Percentage discount must be between 1 and 100' }, { status: 400 })
      }
    } else {
      if (isNaN(discountAmount) || discountAmount <= 0 || discountAmount > 10000) {
        return Response.json({ error: 'Discount must be between 0.01 and 10,000 JD' }, { status: 400 })
      }
    }

    const maxUses = body.maxUses !== undefined ? Number(body.maxUses) : 0
    if (isNaN(maxUses) || maxUses < 0 || maxUses > 100000) {
      return Response.json({ error: 'Invalid max uses' }, { status: 400 })
    }

    let expiresAt: Date | null = null
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt)
      if (isNaN(expiresAt.getTime())) {
        return Response.json({ error: 'Invalid expiry date' }, { status: 400 })
      }
    }

    // Check for duplicate
    const existing = await prisma.promoCode.findUnique({ where: { code } })
    if (existing) {
      return Response.json({ error: 'Promo code already exists' }, { status: 409 })
    }

    const promo = await prisma.promoCode.create({
      data: { code, discountType, discountAmount, bonusEntries, maxUses, expiresAt },
    })
    return Response.json(promo, { status: 201 })
  } catch (e) {
    console.error('[POST /api/promo]', e)
    return Response.json({ error: 'Failed to create promo code' }, { status: 500 })
  }
}
