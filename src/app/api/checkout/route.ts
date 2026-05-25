import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { logId } = body
    if (!logId || !isValidId(logId)) return Response.json({ error: 'Valid logId required' }, { status: 400 })

    const log = await prisma.log.update({
      where: { id: Number(logId) },
      data: { checkOutTime: new Date() },
      include: { student: true },
    })
    return Response.json(log)
  } catch (e: any) {
    console.error('[POST /api/checkout]', e)
    if (e?.code === 'P2025') return Response.json({ error: 'Log entry not found' }, { status: 404 })
    return Response.json({ error: 'Check-out failed' }, { status: 500 })
  }
}
