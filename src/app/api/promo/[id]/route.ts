import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// PATCH — toggle active / update promo code / record usage
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Allow staff to record usage, admin for everything else
    const session = await requireAuth('ADMIN', 'STAFF')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid promo ID' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return Response.json({ error: 'isActive must be boolean' }, { status: 400 })
      data.isActive = body.isActive
    }
    if (body.discountAmount !== undefined) {
      const d = Number(body.discountAmount)
      if (isNaN(d) || d <= 0 || d > 10000) return Response.json({ error: 'Invalid discount' }, { status: 400 })
      data.discountAmount = d
    }
    if (body.maxUses !== undefined) {
      const m = Number(body.maxUses)
      if (isNaN(m) || m < 0) return Response.json({ error: 'Invalid max uses' }, { status: 400 })
      data.maxUses = m
    }
    // Increment timesUsed atomically and record usage when a promo is redeemed
    if (body.timesUsed === true) {
      // Atomic increment with maxUses guard to prevent race conditions
      const promoId = Number(id)
      const promo = await prisma.promoCode.findUnique({ where: { id: promoId } })
      if (!promo) return Response.json({ error: 'Promo code not found' }, { status: 404 })

      // Use updateMany with condition to atomically check maxUses
      const maxUsesCondition = promo.maxUses > 0 ? { timesUsed: { lt: promo.maxUses } } : {}
      const atomicUpdate = await prisma.promoCode.updateMany({
        where: { id: promoId, ...maxUsesCondition },
        data: { timesUsed: { increment: 1 } },
      })
      if (atomicUpdate.count === 0) {
        return Response.json({ error: 'Promo code usage limit reached' }, { status: 400 })
      }

      // Record promo usage linked to student
      if (body.studentId && body.discountApplied !== undefined) {
        const student = await prisma.student.findUnique({ where: { id: Number(body.studentId) }, select: { fullName: true } })
        await prisma.promoUsage.create({
          data: {
            promoCodeId: promoId,
            studentId: Number(body.studentId),
            studentName: student?.fullName || '',
            discount: Number(body.discountApplied),
          },
        })
      }
      // Don't add timesUsed to data — already incremented atomically
      // Return early — the promo was already updated atomically above
      const updated = await prisma.promoCode.findUnique({ where: { id: Number(id) } })
      return Response.json(updated)
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const promo = await prisma.promoCode.update({
      where: { id: Number(id) },
      data,
    })
    return Response.json(promo)
  } catch (e: any) {
    console.error('[PATCH /api/promo/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Promo code not found' }, { status: 404 })
    return Response.json({ error: 'Failed to update promo code' }, { status: 500 })
  }
}

// DELETE a promo code
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { id } = await ctx.params
    if (!isValidId(id)) return Response.json({ error: 'Invalid promo ID' }, { status: 400 })

    const numId = Number(id)
    await prisma.promoUsage.deleteMany({ where: { promoCodeId: numId } })
    await prisma.promoCode.delete({ where: { id: numId } })
    return Response.json({ ok: true })
  } catch (e: any) {
    console.error('[DELETE /api/promo/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Promo code not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete promo code' }, { status: 500 })
  }
}
