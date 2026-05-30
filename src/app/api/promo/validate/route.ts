import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { sanitizeString } from '@/lib/sanitize'

// Validate a promo code — requires auth (staff use only)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const code = sanitizeString(body.code)?.toUpperCase().replace(/\s+/g, '')
    if (!code) return Response.json({ error: 'Code is required' }, { status: 400 })

    const promo = await prisma.promoCode.findUnique({ where: { code } })

    if (!promo) {
      return Response.json({ valid: false, error: 'Promo code not found' })
    }

    if (!promo.isActive) {
      return Response.json({ valid: false, error: 'Promo code is disabled' })
    }

    if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
      return Response.json({ valid: false, error: 'Promo code has expired' })
    }

    if (promo.maxUses > 0 && promo.timesUsed >= promo.maxUses) {
      return Response.json({ valid: false, error: 'Promo code usage limit reached' })
    }

    return Response.json({
      valid: true,
      discountType: promo.discountType,
      discountAmount: promo.discountAmount,
      bonusEntries: promo.bonusEntries,
      code: promo.code,
      id: promo.id,
    })
  } catch (e) {
    console.error('[POST /api/promo/validate]', e)
    return Response.json({ error: 'Validation failed' }, { status: 500 })
  }
}
