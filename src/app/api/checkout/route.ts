import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'
import { checkStaffRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'STAFF')
    if (session instanceof Response) return session

    const rl = checkStaffRateLimit(session.userId as number, 'write')
    if (rl.limited) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

    const { logId } = body
    if (!logId || !isValidId(logId)) return Response.json({ error: 'Valid logId required' }, { status: 400 })

    // Prevent double checkout — only update if not already checked out
    const existing = await prisma.log.findUnique({ where: { id: Number(logId) } })
    if (!existing) return Response.json({ error: 'Log entry not found' }, { status: 404 })
    if (existing.checkOutTime) {
      return Response.json({ error: 'Student already checked out' }, { status: 400 })
    }

    const log = await prisma.log.update({
      where: { id: Number(logId) },
      data: { checkOutTime: new Date() },
      // SECURITY (D1): response only needs display fields, never credentials/PII extras
      include: { student: { select: { id: true, fullName: true, studentNumber: true, photoUrl: true } } },
    })

    // F9: Audit log for checkout
    await prisma.staffAuditLog.create({
      data: {
        userId: session.userId as number,
        email: session.email as string || '',
        role: session.role as string || '',
        event: 'CHECKOUT',
        details: `Checked out student ${log.student?.fullName || log.studentName} (ID: ${log.studentId})`,
      },
    }).catch(() => {})

    return Response.json(log)
  } catch (e) {
    console.error('[POST /api/checkout]', e)
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') return Response.json({ error: 'Log entry not found' }, { status: 404 })
    return Response.json({ error: 'Check-out failed' }, { status: 500 })
  }
}
