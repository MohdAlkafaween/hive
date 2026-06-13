import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

// DELETE — admin deletes a single log entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { id } = await params
    if (!isValidId(id)) return Response.json({ error: 'Valid log ID required' }, { status: 400 })

    await prisma.log.delete({ where: { id: Number(id) } })
    return Response.json({ success: true })
  } catch (e) {
    console.error('[DELETE /api/logs/[id]]', e)
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') return Response.json({ error: 'Log not found' }, { status: 404 })
    return Response.json({ error: 'Failed to delete log' }, { status: 500 })
  }
}
