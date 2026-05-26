import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/authGuard'
import { isValidId } from '@/lib/sanitize'

// GET — today's waitlist
export async function GET() {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const today = new Date().toISOString().slice(0, 10)
    const entries = await prisma.waitlistEntry.findMany({
      where: { date: today },
      include: { student: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { position: 'asc' },
    })
    return Response.json(entries)
  } catch (e) {
    console.error('[GET /api/waitlist]', e)
    return Response.json({ error: 'Failed to load waitlist' }, { status: 500 })
  }
}

// POST — add student to waitlist
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body?.studentId || !isValidId(body.studentId)) {
      return Response.json({ error: 'Valid studentId required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)

    // Check if already on waitlist
    const existing = await prisma.waitlistEntry.findFirst({
      where: { studentId: Number(body.studentId), date: today, status: 'WAITING' },
    })
    if (existing) return Response.json({ error: 'Already on waitlist' }, { status: 409 })

    // Get next position
    const lastEntry = await prisma.waitlistEntry.findFirst({
      where: { date: today },
      orderBy: { position: 'desc' },
    })
    const position = (lastEntry?.position || 0) + 1

    const entry = await prisma.waitlistEntry.create({
      data: { studentId: Number(body.studentId), date: today, position },
      include: { student: { select: { id: true, fullName: true, phone: true } } },
    })
    return Response.json(entry, { status: 201 })
  } catch (e) {
    console.error('[POST /api/waitlist]', e)
    return Response.json({ error: 'Failed to add to waitlist' }, { status: 500 })
  }
}

// PATCH — admit or cancel a waitlist entry
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN', 'MANAGER', 'REGISTERATION_COUNTER')
    if (session instanceof Response) return session

    const body = await req.json().catch(() => null)
    if (!body?.id || !isValidId(body.id)) return Response.json({ error: 'Valid id required' }, { status: 400 })
    if (!['ADMITTED', 'CANCELLED'].includes(body.status)) {
      return Response.json({ error: 'status must be ADMITTED or CANCELLED' }, { status: 400 })
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id: Number(body.id) },
      data: { status: body.status },
    })
    return Response.json(updated)
  } catch (e: any) {
    if (e?.code === 'P2025') return Response.json({ error: 'Entry not found' }, { status: 404 })
    console.error('[PATCH /api/waitlist]', e)
    return Response.json({ error: 'Failed to update waitlist' }, { status: 500 })
  }
}
