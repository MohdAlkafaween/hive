import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// PATCH — void or refund a transaction
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Valid transaction ID required' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

    const { action, reason } = body
    if (!['VOID', 'REFUND'].includes(action)) return Response.json({ error: 'action must be VOID or REFUND' }, { status: 400 })
    if (!reason?.trim()) return Response.json({ error: 'Reason is required' }, { status: 400 })

    const transaction = await prisma.transaction.findUnique({ where: { id: Number(id) } })
    if (!transaction) return Response.json({ error: 'Transaction not found' }, { status: 404 })
    if (transaction.type !== 'SALE') return Response.json({ error: 'Can only void/refund SALE transactions' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      // Mark original as voided
      const voided = await tx.transaction.update({
        where: { id: Number(id) },
        data: {
          type: 'VOID',
          voidedAt: new Date(),
          voidedBy: session.userId as number,
          voidReason: reason.trim().slice(0, 500),
        },
      })

      // Deactivate linked subscription: prefer FK, fall back to planType match for legacy data
      if (transaction.subscriptionId) {
        await tx.subscription.update({ where: { id: transaction.subscriptionId }, data: { isActive: false } }).catch(() => {})
      } else if (transaction.studentId) {
        const sub = await tx.subscription.findFirst({
          where: { studentId: transaction.studentId, isActive: true, planType: transaction.planType },
          orderBy: { createdAt: 'desc' },
        })
        if (sub) {
          await tx.subscription.update({ where: { id: sub.id }, data: { isActive: false } })
        }
      }

      let refundTx = null
      if (action === 'REFUND') {
        refundTx = await tx.transaction.create({
          data: {
            studentId: transaction.studentId,
            studentName: transaction.studentName,
            amountPaid: -transaction.amountPaid,
            planType: transaction.planType,
            gateway: transaction.gateway,
            discountAmount: 0,
            type: 'REFUND',
            refundOf: transaction.id,
          },
        })
      }

      return { voided, refundTx }
    })

    return Response.json(result)
  } catch (e) {
    console.error('[PATCH /api/transactions/[id]]', e)
    return Response.json({ error: 'Failed to process void/refund' }, { status: 500 })
  }
}

// DELETE a transaction — ADMIN only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Valid transaction ID required' }, { status: 400 })

    await prisma.transaction.delete({ where: { id: Number(id) } })
    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') return Response.json({ error: 'Transaction not found' }, { status: 404 })
    console.error('[DELETE /api/transactions/[id]]', e)
    return Response.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
