import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// DELETE a transaction — ADMIN only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Valid transaction ID required' }, { status: 400 })

    await prisma.transaction.delete({ where: { id: Number(id) } })
    return Response.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return Response.json({ error: 'Transaction not found' }, { status: 404 })
    console.error('[DELETE /api/transactions/[id]]', e)
    return Response.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
