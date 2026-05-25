import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// DELETE — admin deletes a single log entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Valid log ID required' }, { status: 400 })

    await prisma.log.delete({ where: { id: Number(id) } })
    return Response.json({ success: true })
  } catch (e: any) {
    console.error('[DELETE /api/logs/[id]]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Log not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete log' }, { status: 500 })
  }
}
